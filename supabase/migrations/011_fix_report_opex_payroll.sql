-- Migration 011: Fix Report OPEX & Staff Payroll Separation
-- Excludes 'Staff Salary' payouts from v_expenses so salary is not double-subtracted
-- from net profit and cash profit. Adds base_amount and extra_amount to KPIs.

create or replace function public.get_company_report(
  p_company_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role app_role;
  v_caller_cid uuid;
  v_period_days int;
  v_prev_start date;
  v_prev_end date;

  -- Thresholds from company settings
  v_thresholds jsonb;
  v_margin_warn numeric;
  v_staff_warn numeric;
  v_staff_bad numeric;
  v_opex_warn numeric;
  v_opex_bad numeric;
  v_unpaid_warn numeric;
  v_unpaid_bad numeric;
  v_adv_warn numeric;
  v_drop_warn numeric;
  v_drop_bad numeric;
  v_exp_growth_bad numeric;

  -- Period metrics
  v_revenue numeric := 0;
  v_base_amount numeric := 0;
  v_extra_amount numeric := 0;
  v_collected numeric := 0;
  v_unpaid numeric := 0;
  v_expenses numeric := 0;
  v_total_salary numeric := 0;
  v_total_advances numeric := 0;
  v_net_profit numeric := 0;
  v_cash_profit numeric := 0;
  v_margin numeric := 0;
  v_vehicles_count int := 0;
  v_avg_per_vehicle numeric := 0;

  -- Customer balances
  v_customer_balances_due numeric := 0;
  v_over_limit_customers text[] := '{}';

  -- Previous period metrics
  v_prev_revenue numeric := 0;
  v_prev_expenses numeric := 0;
  v_prev_salary numeric := 0;
  v_prev_net numeric := 0;
  v_prev_vehicles int := 0;

  -- Growth percentages
  v_sales_growth numeric := 0;
  v_exp_growth numeric := 0;

  -- Health score & warnings
  v_health_score int := 100;
  v_warnings jsonb := '[]'::jsonb;
  v_health_status text := 'healthy';

  -- Sub-tables json
  v_daily_chart jsonb := '[]'::jsonb;
  v_pnl_categories jsonb := '[]'::jsonb;
  v_staff_payroll jsonb := '[]'::jsonb;
  v_sales_work_type jsonb := '[]'::jsonb;
  v_sales_vehicle_type jsonb := '[]'::jsonb;
  v_unpaid_vehicles jsonb := '[]'::jsonb;
  v_customer_accounts jsonb := '[]'::jsonb;

  -- Loop variables
  v_rec record;
  v_cur_bal numeric;
  v_cust_status text;
  v_staff_sal numeric;
  v_staff_adv numeric;
  v_days_present int;
  v_days_leave int;
begin
  -- 1. Security Check
  v_caller_role := public.auth_role();
  v_caller_cid := public.auth_company();

  if not (
    public.is_platform() or
    (v_caller_cid = p_company_id and v_caller_role in ('owner', 'accountant', 'manager') and public.company_live(p_company_id))
  ) then
    raise exception 'Access denied: Reports are restricted to Owner, Manager, Accountant, and Platform roles.';
  end if;

  -- 2. Period calculation
  v_period_days := (p_end_date - p_start_date) + 1;
  if v_period_days <= 0 then
    raise exception 'Invalid date range: start_date must be <= end_date.';
  end if;

  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - (v_period_days - 1);

  -- 3. Load Thresholds
  select coalesce(settings->'thresholds', '{}'::jsonb)
  into v_thresholds
  from public.companies
  where id = p_company_id;

  v_margin_warn := coalesce((v_thresholds->>'margin_warn')::numeric, 0.15);
  v_staff_warn := coalesce((v_thresholds->>'staff_warn')::numeric, 0.40);
  v_staff_bad := coalesce((v_thresholds->>'staff_bad')::numeric, 0.50);
  v_opex_warn := coalesce((v_thresholds->>'opex_warn')::numeric, 0.30);
  v_opex_bad := coalesce((v_thresholds->>'opex_bad')::numeric, 0.40);
  v_unpaid_warn := coalesce((v_thresholds->>'unpaid_warn')::numeric, 0.20);
  v_unpaid_bad := coalesce((v_thresholds->>'unpaid_bad')::numeric, 0.35);
  v_adv_warn := coalesce((v_thresholds->>'advance_warn')::numeric, 0.30);
  v_drop_warn := coalesce((v_thresholds->>'sales_drop_warn')::numeric, -0.10);
  v_drop_bad := coalesce((v_thresholds->>'sales_drop_bad')::numeric, -0.25);
  v_exp_growth_bad := coalesce((v_thresholds->>'expense_growth')::numeric, 0.20);

  -- 4. Calculate Period Revenue, Base Amount, Extra Amount & Vehicles Count
  select
    coalesce(sum(total), 0),
    coalesce(sum(price), 0),
    coalesce(sum(extra_amount), 0),
    count(*)
  into v_revenue, v_base_amount, v_extra_amount, v_vehicles_count
  from public.jobs
  where company_id = p_company_id
    and entry_date between p_start_date and p_end_date;

  if v_vehicles_count > 0 then
    v_avg_per_vehicle := round(v_revenue / v_vehicles_count, 2);
  else
    v_avg_per_vehicle := 0;
  end if;

  -- 5. Calculate Collected (Cash in) = Paid jobs in period + Customer Payments in period
  declare
    v_paid_jobs numeric := 0;
    v_cust_pmts numeric := 0;
  begin
    select coalesce(sum(total), 0)
    into v_paid_jobs
    from public.jobs
    where company_id = p_company_id
      and is_paid = true
      and entry_date between p_start_date and p_end_date;

    select coalesce(sum(amount), 0)
    into v_cust_pmts
    from public.customer_payments
    where company_id = p_company_id
      and entry_date between p_start_date and p_end_date;

    v_collected := v_paid_jobs + v_cust_pmts;
  end;

  v_unpaid := greatest(0, v_revenue - v_collected);

  -- 6. Calculate Operating Expenses (EXCLUDING Staff Salary to prevent double-counting!)
  select coalesce(sum(amount), 0)
  into v_expenses
  from public.expenses
  where company_id = p_company_id
    and category != 'Staff Salary'
    and entry_date between p_start_date and p_end_date;

  -- 7. Staff Payroll calculation
  for v_rec in
    select p.id, p.full_name, p.role, p.pay_type, p.pay_rate
    from public.profiles p
    where p.company_id = p_company_id and p.active = true
    order by p.full_name
  loop
    v_staff_sal := 0;
    v_staff_adv := 0;
    v_days_present := 0;
    v_days_leave := 0;

    select
      count(*) filter (where status = 'present'),
      count(*) filter (where status = 'leave')
    into v_days_present, v_days_leave
    from public.attendance
    where company_id = p_company_id
      and staff_id = v_rec.id
      and entry_date between p_start_date and p_end_date;

    if v_rec.pay_type = 'commission' then
      select coalesce(sum(price), 0) * (v_rec.pay_rate / 100.0)
      into v_staff_sal
      from public.jobs
      where company_id = p_company_id
        and staff_id = v_rec.id
        and entry_date between p_start_date and p_end_date;
    elsif v_rec.pay_type = 'daily' then
      v_staff_sal := v_rec.pay_rate * v_days_present;
    elsif v_rec.pay_type = 'monthly' then
      v_staff_sal := (v_rec.pay_rate / 30.0) * v_period_days;
    end if;

    select coalesce(sum(amount), 0)
    into v_staff_adv
    from public.advances
    where company_id = p_company_id
      and staff_id = v_rec.id
      and entry_date between p_start_date and p_end_date;

    v_total_salary := v_total_salary + v_staff_sal;
    v_total_advances := v_total_advances + v_staff_adv;

    declare
      v_staff_jobs_count int := 0;
      v_staff_jobs_sales numeric := 0;
    begin
      select count(*), coalesce(sum(total), 0)
      into v_staff_jobs_count, v_staff_jobs_sales
      from public.jobs
      where company_id = p_company_id
        and staff_id = v_rec.id
        and entry_date between p_start_date and p_end_date;

      v_staff_payroll := v_staff_payroll || jsonb_build_object(
        'staff_id', v_rec.id,
        'full_name', v_rec.full_name,
        'role', v_rec.role,
        'pay_type', v_rec.pay_type,
        'pay_rate', v_rec.pay_rate,
        'jobs_count', v_staff_jobs_count,
        'jobs_sales', round(v_staff_jobs_sales, 2),
        'present_days', v_days_present,
        'leave_days', v_days_leave,
        'gross_salary', round(v_staff_sal, 2),
        'advances', round(v_staff_adv, 2),
        'balance_to_pay', round(v_staff_sal - v_staff_adv, 2)
      );
    end;
  end loop;

  -- 8. Net and Cash Profit (cleanly calculated: Revenue - OPEX - Staff Payroll)
  v_net_profit := v_revenue - v_expenses - v_total_salary;
  v_cash_profit := v_collected - v_expenses - v_total_salary;
  if v_revenue > 0 then
    v_margin := round(v_net_profit / v_revenue, 4);
  else
    v_margin := 0;
  end if;

  -- 9. Customer accounts & balances due
  for v_rec in
    select
      c.id,
      c.name,
      c.mobile,
      c.credit_limit,
      coalesce((select sum(j.total) from public.jobs j where j.customer_id = c.id and j.is_paid = false), 0) as total_unpaid_jobs,
      coalesce((select sum(cp.amount) from public.customer_payments cp where cp.customer_id = c.id), 0) as total_pmts
    from public.customers c
    where c.company_id = p_company_id
    order by c.name
  loop
    v_cur_bal := greatest(0, v_rec.total_unpaid_jobs - v_rec.total_pmts);
    v_customer_balances_due := v_customer_balances_due + v_cur_bal;

    if v_rec.credit_limit > 0 and v_cur_bal > v_rec.credit_limit then
      v_cust_status := 'over_limit';
      v_over_limit_customers := array_append(v_over_limit_customers, v_rec.name);
    elsif v_rec.credit_limit > 0 and v_cur_bal >= (0.80 * v_rec.credit_limit) then
      v_cust_status := 'near_limit';
    else
      v_cust_status := 'ok';
    end if;

    v_customer_accounts := v_customer_accounts || jsonb_build_object(
      'id', v_rec.id,
      'name', v_rec.name,
      'mobile', v_rec.mobile,
      'credit_limit', v_rec.credit_limit,
      'current_balance', round(v_cur_bal, 2),
      'status', v_cust_status
    );
  end loop;

  -- 10. Previous Period Calculations (Operating expenses excluding salary)
  select coalesce(sum(total), 0), count(*)
  into v_prev_revenue, v_prev_vehicles
  from public.jobs
  where company_id = p_company_id
    and entry_date between v_prev_start and v_prev_end;

  select coalesce(sum(amount), 0)
  into v_prev_expenses
  from public.expenses
  where company_id = p_company_id
    and category != 'Staff Salary'
    and entry_date between v_prev_start and v_prev_end;

  for v_rec in
    select p.id, p.pay_type, p.pay_rate
    from public.profiles p
    where p.company_id = p_company_id and p.active = true
  loop
    if v_rec.pay_type = 'commission' then
      select coalesce(sum(price), 0) * (v_rec.pay_rate / 100.0)
      into v_staff_sal
      from public.jobs
      where company_id = p_company_id
        and staff_id = v_rec.id
        and entry_date between v_prev_start and v_prev_end;
    elsif v_rec.pay_type = 'daily' then
      select count(*) * v_rec.pay_rate
      into v_staff_sal
      from public.attendance
      where company_id = p_company_id
        and staff_id = v_rec.id
        and status = 'present'
        and entry_date between v_prev_start and v_prev_end;
    elsif v_rec.pay_type = 'monthly' then
      v_staff_sal := (v_rec.pay_rate / 30.0) * v_period_days;
    else
      v_staff_sal := 0;
    end if;
    v_prev_salary := v_prev_salary + v_staff_sal;
  end loop;

  v_prev_net := v_prev_revenue - v_prev_expenses - v_prev_salary;

  if v_prev_revenue > 0 then
    v_sales_growth := (v_revenue - v_prev_revenue) / v_prev_revenue;
  else
    v_sales_growth := 0;
  end if;

  if v_prev_expenses > 0 then
    v_exp_growth := (v_expenses - v_prev_expenses) / v_prev_expenses;
  else
    v_exp_growth := 0;
  end if;

  -- 11. Health score rules
  if v_margin < 0 then
    v_health_score := v_health_score - 20;
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'margin_loss',
      'level', 'red',
      'title', 'Net Loss Incurred',
      'description', format('Net margin is negative (%s%%). Expenses exceed revenue.', round(v_margin * 100, 1)),
      'action', 'Audit operating overhead and review pricing immediately.'
    );
  elsif v_margin < v_margin_warn then
    v_health_score := v_health_score - 8;
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'margin_low',
      'level', 'orange',
      'title', 'Low Profit Margin',
      'description', format('Net margin is %s%%, below recommended target of %s%%.', round(v_margin * 100, 1), round(v_margin_warn * 100, 0)),
      'action', 'Increase high-margin services (polishing, detailing) and tighten costs.'
    );
  end if;

  if v_revenue > 0 then
    declare
      v_staff_pct numeric := v_total_salary / v_revenue;
      v_opex_pct numeric := v_expenses / v_revenue;
      v_unpaid_pct numeric := v_unpaid / v_revenue;
    begin
      if v_staff_pct > v_staff_bad then
        v_health_score := v_health_score - 20;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'staff_high',
          'level', 'red',
          'title', 'Severe Staff Cost Overrun',
          'description', format('Payroll consumes %s%% of revenue (critical ceiling: %s%%).', round(v_staff_pct * 100, 1), round(v_staff_bad * 100, 0)),
          'action', 'Shift daily wages to commission structure and optimize technician count.'
        );
      elsif v_staff_pct > v_staff_warn then
        v_health_score := v_health_score - 8;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'staff_warn',
          'level', 'orange',
          'title', 'High Staff Cost Ratio',
          'description', format('Payroll is %s%% of revenue (recommended below %s%%).', round(v_staff_pct * 100, 1), round(v_staff_warn * 100, 0)),
          'action', 'Increase daily job volume per technician.'
        );
      end if;

      if v_opex_pct > v_opex_bad then
        v_health_score := v_health_score - 20;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'opex_high',
          'level', 'red',
          'title', 'Excessive Operating Overhead',
          'description', format('Operating expenses consume %s%% of revenue (critical ceiling: %s%%).', round(v_opex_pct * 100, 1), round(v_opex_bad * 100, 0)),
          'action', 'Audit facility costs, rent, and chemical supplies.'
        );
      elsif v_opex_pct > v_opex_warn then
        v_health_score := v_health_score - 8;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'opex_warn',
          'level', 'orange',
          'title', 'High Operating Expense Ratio',
          'description', format('Operating expenses stand at %s%% of revenue.', round(v_opex_pct * 100, 1)),
          'action', 'Review vendor invoices and chemical consumption rates.'
        );
      end if;

      if v_unpaid_pct > v_unpaid_bad then
        v_health_score := v_health_score - 20;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'unpaid_bad',
          'level', 'red',
          'title', 'Critical Uncollected Revenue',
          'description', format('%s%% of revenue is unpaid (critical limit: %s%%).', round(v_unpaid_pct * 100, 1), round(v_unpaid_bad * 100, 0)),
          'action', 'Enforce cash-on-completion policy and pursue overdue customer accounts.'
        );
      elsif v_unpaid_pct > v_unpaid_warn then
        v_health_score := v_health_score - 8;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'unpaid_warn',
          'level', 'orange',
          'title', 'High Unpaid Revenue Warning',
          'description', format('%s%% of revenue is pending collection.', round(v_unpaid_pct * 100, 1)),
          'action', 'Tighten collection cycles and verify cashier collection logs.'
        );
      end if;
    end;
  end if;

  if v_total_salary > 0 and (v_total_advances / v_total_salary) > v_adv_warn then
    v_health_score := v_health_score - 8;
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'advances_high',
      'level', 'orange',
      'title', 'High Salary Advance Ratio',
      'description', format('Advances make up %s%% of total salary (limit: %s%%).', round((v_total_advances / v_total_salary) * 100, 1), round(v_adv_warn * 100, 0)),
      'action', 'Cap advance disbursements to 15% of projected monthly earnings.'
    );
  end if;

  if v_prev_revenue > 0 then
    if v_sales_growth <= v_drop_bad then
      v_health_score := v_health_score - 20;
      v_warnings := v_warnings || jsonb_build_object(
        'code', 'sales_plunge',
        'level', 'red',
        'title', 'Sharp Revenue Decline',
        'description', format('Sales plunged by %s%% compared to the previous period.', round(abs(v_sales_growth) * 100, 1)),
        'action', 'Launch marketing promotions and reach out to inactive fleet/corporate clients.'
      );
    elsif v_sales_growth <= v_drop_warn then
      v_health_score := v_health_score - 8;
      v_warnings := v_warnings || jsonb_build_object(
        'code', 'sales_dip',
        'level', 'orange',
        'title', 'Revenue Softening',
        'description', format('Sales fell by %s%% compared to the previous period.', round(abs(v_sales_growth) * 100, 1)),
        'action', 'Review peak service hours and offer bundle wash/polish discounts.'
      );
    end if;

    if v_exp_growth > v_exp_growth_bad and v_exp_growth > (v_sales_growth + 0.10) then
      v_health_score := v_health_score - 20;
      v_warnings := v_warnings || jsonb_build_object(
        'code', 'expense_runaway',
        'level', 'red',
        'title', 'Expenses Outpacing Sales',
        'description', format('Expense growth (%s%%) is outpacing sales growth (%s%%) by more than 10 points.', round(v_exp_growth * 100, 1), round(v_sales_growth * 100, 1)),
        'action', 'Freeze discretionary spend and investigate supply purchase prices.'
      );
    end if;
  end if;

  if v_expenses > 0 then
    declare
      v_dom_cat text;
      v_dom_amt numeric;
    begin
      select category, sum(amount)
      into v_dom_cat, v_dom_amt
      from public.expenses
      where company_id = p_company_id
        and category != 'Staff Salary'
        and entry_date between p_start_date and p_end_date
      group by category
      order by sum(amount) desc
      limit 1;

      if (v_dom_amt / v_expenses) > 0.40 and v_dom_cat != 'Rent' then
        v_health_score := v_health_score - 8;
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'category_spike',
          'level', 'orange',
          'title', format('High Concentration in %s', v_dom_cat),
          'description', format('"%s" accounts for %s%% of all operating expenses in this period.', v_dom_cat, round((v_dom_amt / v_expenses) * 100, 1)),
          'action', format('Examine %s invoices for potential supplier negotiations or waste reduction.', v_dom_cat)
        );
      end if;
    end;
  end if;

  if array_length(v_over_limit_customers, 1) > 0 then
    v_health_score := v_health_score - 20;
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'customer_over_limit',
      'level', 'red',
      'title', 'Customer Credit Limits Breached',
      'description', format('%s customer(s) exceeded credit limit: %s.', array_length(v_over_limit_customers, 1), array_to_string(v_over_limit_customers, ', ')),
      'action', 'Suspend further credit service for these accounts until arrears are settled.'
    );
  end if;

  if v_revenue > 0 and v_customer_balances_due > (0.50 * v_revenue) then
    v_health_score := v_health_score - 8;
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'receivables_high',
      'level', 'orange',
      'title', 'High Credit Exposure',
      'description', format('Outstanding customer debt (%s) exceeds 50%% of period revenue (%s).', round(v_customer_balances_due, 2), round(v_revenue, 2)),
      'action', 'Issue account statements and follow up on credit collections.'
    );
  end if;

  if v_health_score < 0 then
    v_health_score := 0;
  elsif v_health_score > 100 then
    v_health_score := 100;
  end if;

  if v_health_score >= 80 then
    v_health_status := 'healthy';
  elsif v_health_score >= 60 then
    v_health_status := 'fair';
  else
    v_health_status := 'at_risk';
  end if;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_pnl_categories
  from (
    select
      category,
      round(sum(amount), 2) as amount,
      case when v_revenue > 0 then round((sum(amount) / v_revenue) * 100, 1) else 0 end as percent_of_revenue,
      case when v_expenses > 0 then round((sum(amount) / v_expenses) * 100, 1) else 0 end as percent_of_expenses
    from public.expenses
    where company_id = p_company_id
      and category != 'Staff Salary'
      and entry_date between p_start_date and p_end_date
    group by category
    order by sum(amount) desc
  ) sub;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_daily_chart
  from (
    select
      d::date as date,
      coalesce((select sum(j.total) from public.jobs j where j.company_id = p_company_id and j.entry_date = d::date), 0) as revenue,
      coalesce((select sum(e.amount) from public.expenses e where e.company_id = p_company_id and e.entry_date = d::date), 0) as expenses
    from generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval) d
    order by d
  ) sub;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_sales_work_type
  from (
    select
      work_type,
      count(*) as count,
      round(sum(total), 2) as total,
      case when v_revenue > 0 then round((sum(total) / v_revenue) * 100, 1) else 0 end as percent
    from public.jobs
    where company_id = p_company_id
      and entry_date between p_start_date and p_end_date
    group by work_type
    order by sum(total) desc
  ) sub;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_sales_vehicle_type
  from (
    select
      vehicle_type,
      count(*) as count,
      round(sum(total), 2) as total,
      case when v_revenue > 0 then round((sum(total) / v_revenue) * 100, 1) else 0 end as percent
    from public.jobs
    where company_id = p_company_id
      and entry_date between p_start_date and p_end_date
    group by vehicle_type
    order by sum(total) desc
  ) sub;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_unpaid_vehicles
  from (
    select
      j.id,
      j.entry_date,
      j.plate,
      j.mobile,
      j.work_type,
      j.vehicle_type,
      round(j.total, 2) as total,
      p.full_name as staff_name
    from public.jobs j
    join public.profiles p on p.id = j.staff_id
    where j.company_id = p_company_id
      and j.is_paid = false
      and j.entry_date between p_start_date and p_end_date
    order by j.entry_date asc, j.created_at asc
  ) sub;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'vehicles_count', v_vehicles_count,
      'revenue', round(v_revenue, 2),
      'base_amount', round(v_base_amount, 2),
      'extra_amount', round(v_extra_amount, 2),
      'avg_per_vehicle', v_avg_per_vehicle,
      'collected', round(v_collected, 2),
      'unpaid', round(v_unpaid, 2),
      'customer_balances_due', round(v_customer_balances_due, 2),
      'expenses', round(v_expenses, 2),
      'total_salary', round(v_total_salary, 2),
      'total_advances', round(v_total_advances, 2),
      'net_profit', round(v_net_profit, 2),
      'cash_profit', round(v_cash_profit, 2),
      'net_margin', v_margin
    ),
    'previous_comparison', jsonb_build_object(
      'prev_start_date', v_prev_start,
      'prev_end_date', v_prev_end,
      'prev_revenue', round(v_prev_revenue, 2),
      'prev_expenses', round(v_prev_expenses, 2),
      'prev_salary', round(v_prev_salary, 2),
      'prev_net_profit', round(v_prev_net, 2),
      'prev_vehicles_count', v_prev_vehicles,
      'sales_growth_pct', round(v_sales_growth * 100, 1),
      'expense_growth_pct', round(v_exp_growth * 100, 1)
    ),
    'health', jsonb_build_object(
      'score', v_health_score,
      'status', v_health_status,
      'warnings', v_warnings
    ),
    'daily_chart', v_daily_chart,
    'pnl_categories', v_pnl_categories,
    'staff_payroll', v_staff_payroll,
    'sales_by_work_type', v_sales_work_type,
    'sales_by_vehicle_type', v_sales_vehicle_type,
    'unpaid_vehicles', v_unpaid_vehicles,
    'customer_accounts', v_customer_accounts
  );
end;
$$;
