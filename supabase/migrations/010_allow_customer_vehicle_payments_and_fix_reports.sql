-- ==============================================================================
-- Migration 010: Fix Customer Vehicle Payment Constraints and Ledger Accounting
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wzddoscnrcclgkmwedhd/sql/new
-- ==============================================================================

-- 1. Drop the legacy check constraints that forced is_paid = false for customer vehicles
alter table if exists public.jobs drop constraint if exists jobs_check;
alter table if exists public.jobs drop constraint if exists jobs_customer_id_check;

-- 2. Drop ANY check constraint on public.jobs that inspects customer_id and is_paid
do $$
declare
    r record;
begin
    for r in (
        select conname 
        from pg_constraint 
        where conrelid = 'public.jobs'::regclass 
          and contype = 'c' 
          and (pg_get_constraintdef(oid) ilike '%customer_id%' or pg_get_constraintdef(oid) ilike '%is_paid%')
    ) loop
        execute 'alter table public.jobs drop constraint if exists ' || quote_ident(r.conname);
    end loop;
end $$;

-- 3. Confirm is_paid column default is false and nullable is clean
alter table if exists public.jobs alter column is_paid set default false;

-- 4. Recreate get_company_report RPC to properly handle paid customer vehicles:
--    a) All jobs with is_paid = true are included in cash collected (both walk-ins and paid customer vehicles)
--    b) Customer balances due = sum(unpaid customer jobs) - sum(customer payments)
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
  v_rev_growth numeric := 0;
  v_net_growth numeric := 0;
  v_exp_growth numeric := 0;

  -- Cost / revenue ratios
  v_staff_cost_ratio numeric := 0;
  v_opex_ratio numeric := 0;
  v_unpaid_ratio numeric := 0;
  v_adv_ratio numeric := 0;

  -- Health score & breakdown
  v_health_score int := 100;
  v_reasons jsonb := '[]'::jsonb;
  v_status text := 'healthy';

  -- Staff breakdowns
  v_staff_breakdown jsonb := '[]'::jsonb;
  v_staff_rec record;

  -- Customer ledger loop
  v_rec record;
  v_cur_bal numeric;
  v_cust_status text;

  -- Top expense categories
  v_expense_categories jsonb := '[]'::jsonb;
begin
  -- 1. Authorization check
  select role, company_id into v_caller_role, v_caller_cid
  from public.profiles
  where id = auth.uid();

  if v_caller_role != 'admin' and v_caller_cid != p_company_id then
    raise exception 'Unauthorized: caller does not belong to this company';
  end if;

  -- 2. Fetch company health thresholds
  select health_thresholds into v_thresholds
  from public.companies
  where id = p_company_id;

  v_margin_warn     := coalesce((v_thresholds->>'margin_warn')::numeric, 15);
  v_staff_warn      := coalesce((v_thresholds->>'staff_warn')::numeric, 50);
  v_staff_bad       := coalesce((v_thresholds->>'staff_bad')::numeric, 65);
  v_opex_warn       := coalesce((v_thresholds->>'opex_warn')::numeric, 30);
  v_opex_bad        := coalesce((v_thresholds->>'opex_bad')::numeric, 45);
  v_unpaid_warn     := coalesce((v_thresholds->>'unpaid_warn')::numeric, 25);
  v_unpaid_bad      := coalesce((v_thresholds->>'unpaid_bad')::numeric, 40);
  v_adv_warn        := coalesce((v_thresholds->>'adv_warn')::numeric, 20);
  v_drop_warn       := coalesce((v_thresholds->>'drop_warn')::numeric, 15);
  v_drop_bad        := coalesce((v_thresholds->>'drop_bad')::numeric, 30);
  v_exp_growth_bad  := coalesce((v_thresholds->>'exp_growth_bad')::numeric, 25);

  -- 3. Calculate period lengths for comparison
  v_period_days := (p_end_date - p_start_date) + 1;
  v_prev_end    := p_start_date - interval '1 day';
  v_prev_start  := v_prev_end - ((v_period_days - 1) || ' days')::interval;

  -- 4. Calculate Revenue in current period
  select
    coalesce(sum(total), 0),
    count(*)
  into v_revenue, v_vehicles_count
  from public.jobs
  where company_id = p_company_id
    and entry_date between p_start_date and p_end_date;

  if v_vehicles_count > 0 then
    v_avg_per_vehicle := round(v_revenue / v_vehicles_count, 2);
  else
    v_avg_per_vehicle := 0;
  end if;

  -- 5. Calculate Collected (Cash in) = All Paid jobs (walk-in and paid customer vehicles) + Customer Account Payments
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

  -- Unpaid for period
  v_unpaid := greatest(0, v_revenue - v_collected);

  -- 6. Calculate Expenses in period
  select coalesce(sum(amount), 0)
  into v_expenses
  from public.expenses
  where company_id = p_company_id
    and entry_date between p_start_date and p_end_date;

  -- Top Expense categories breakdown
  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_expense_categories
  from (
    select category, sum(amount) as total, count(*) as count
    from public.expenses
    where company_id = p_company_id
      and entry_date between p_start_date and p_end_date
    group by category
    order by total desc
    limit 5
  ) sub;

  -- 7. Calculate Staff Salaries, Commissions, and Advances
  for v_staff_rec in
    select id, full_name, role, salary_type, base_salary, commission_rate
    from public.profiles
    where company_id = p_company_id and is_active = true
  loop
    declare
      v_staff_salary numeric := 0;
      v_staff_advances numeric := 0;
      v_staff_jobs_count int := 0;
      v_staff_jobs_sales numeric := 0;
    begin
      -- Commission: sum(price) * rate% of jobs handled (price only, extra excluded!)
      select
        count(*),
        coalesce(sum(price), 0)
      into v_staff_jobs_count, v_staff_jobs_sales
      from public.jobs
      where staff_id = v_staff_rec.id
        and entry_date between p_start_date and p_end_date;

      if v_staff_rec.salary_type = 'commission' then
        v_staff_salary := (v_staff_jobs_sales * coalesce(v_staff_rec.commission_rate, 0)) / 100.0;
      elsif v_staff_rec.salary_type = 'daily' then
        -- Daily: base_salary * distinct days with attendance or jobs
        declare
          v_days int := 0;
        begin
          select count(distinct entry_date) into v_days
          from public.attendance
          where staff_id = v_staff_rec.id
            and is_present = true
            and entry_date between p_start_date and p_end_date;

          if v_days = 0 then
            select count(distinct entry_date) into v_days
            from public.jobs
            where staff_id = v_staff_rec.id
              and entry_date between p_start_date and p_end_date;
          end if;

          v_staff_salary := coalesce(v_staff_rec.base_salary, 0) * v_days;
        end;
      elsif v_staff_rec.salary_type = 'monthly' then
        -- Pro-rate monthly for period
        v_staff_salary := (coalesce(v_staff_rec.base_salary, 0) / 30.0) * v_period_days;
      end if;

      -- Advances in period
      select coalesce(sum(amount), 0)
      into v_staff_advances
      from public.advances
      where staff_id = v_staff_rec.id
        and entry_date between p_start_date and p_end_date;

      v_total_salary := v_total_salary + v_staff_salary;
      v_total_advances := v_total_advances + v_staff_advances;

      v_staff_breakdown := v_staff_breakdown || jsonb_build_object(
        'staff_id', v_staff_rec.id,
        'name', v_staff_rec.full_name,
        'role', v_staff_rec.role,
        'salary_type', v_staff_rec.salary_type,
        'jobs_count', v_staff_jobs_count,
        'jobs_sales', round(v_staff_jobs_sales, 2),
        'earned_salary', round(v_staff_salary, 2),
        'advances', round(v_staff_advances, 2),
        'net_payable', round(greatest(0, v_staff_salary - v_staff_advances), 2)
      );
    end;
  end loop;

  -- 8. Calculate Profits & Margins
  v_net_profit := v_revenue - (v_expenses + v_total_salary);
  v_cash_profit := v_collected - (v_expenses + v_total_salary);

  if v_revenue > 0 then
    v_margin := round((v_net_profit / v_revenue) * 100, 2);
  else
    v_margin := 0;
  end if;

  -- 9. Customer accounts & balances due:
  -- Current balance = sum(unpaid customer jobs) - sum(customer payments)
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
    v_cur_bal := v_rec.total_unpaid_jobs - v_rec.total_pmts;
    if v_cur_bal > 0 then
      v_customer_balances_due := v_customer_balances_due + v_cur_bal;
    end if;

    if v_rec.credit_limit > 0 and v_cur_bal > v_rec.credit_limit then
      v_cust_status := 'over_limit';
      v_over_limit_customers := array_append(v_over_limit_customers, v_rec.name);
    elsif v_rec.credit_limit > 0 and v_cur_bal >= (v_rec.credit_limit * 0.80) then
      v_cust_status := 'near_limit';
    else
      v_cust_status := 'ok';
    end if;
  end loop;

  -- 10. Previous Period Comparison
  select coalesce(sum(total), 0), count(*)
  into v_prev_revenue, v_prev_vehicles
  from public.jobs
  where company_id = p_company_id
    and entry_date between v_prev_start and v_prev_end;

  select coalesce(sum(amount), 0)
  into v_prev_expenses
  from public.expenses
  where company_id = p_company_id
    and entry_date between v_prev_start and v_prev_end;

  v_prev_net := v_prev_revenue - (v_prev_expenses + (v_total_salary * 0.9));

  if v_prev_revenue > 0 then
    v_rev_growth := round(((v_revenue - v_prev_revenue) / v_prev_revenue) * 100, 1);
  end if;
  if v_prev_expenses > 0 then
    v_exp_growth := round(((v_expenses - v_prev_expenses) / v_prev_expenses) * 100, 1);
  end if;
  if v_prev_net > 0 then
    v_net_growth := round(((v_net_profit - v_prev_net) / abs(v_prev_net)) * 100, 1);
  end if;

  -- 11. Cost Ratios
  if v_revenue > 0 then
    v_staff_cost_ratio := round((v_total_salary / v_revenue) * 100, 1);
    v_opex_ratio       := round((v_expenses / v_revenue) * 100, 1);
    v_unpaid_ratio     := round((v_unpaid / v_revenue) * 100, 1);
  end if;
  if v_total_salary > 0 then
    v_adv_ratio := round((v_total_advances / v_total_salary) * 100, 1);
  end if;

  -- 12. Evaluate 10 Health Rules
  if v_revenue > 0 and v_margin < 0 then
    v_health_score := v_health_score - 25;
    v_reasons := v_reasons || jsonb_build_object('rule', 'negative_margin', 'deduction', 25, 'message', 'Net profit is negative for this period.');
  elsif v_revenue > 0 and v_margin < v_margin_warn then
    v_health_score := v_health_score - 10;
    v_reasons := v_reasons || jsonb_build_object('rule', 'low_margin', 'deduction', 10, 'message', format('Net profit margin is low (%s%%). Threshold is %s%%.', v_margin, v_margin_warn));
  end if;

  if v_staff_cost_ratio > v_staff_bad then
    v_health_score := v_health_score - 20;
    v_reasons := v_reasons || jsonb_build_object('rule', 'critical_staff_costs', 'deduction', 20, 'message', format('Staff costs consume %s%% of revenue (critical > %s%%).', v_staff_cost_ratio, v_staff_bad));
  elsif v_staff_cost_ratio > v_staff_warn then
    v_health_score := v_health_score - 10;
    v_reasons := v_reasons || jsonb_build_object('rule', 'high_staff_costs', 'deduction', 10, 'message', format('Staff costs consume %s%% of revenue (warning > %s%%).', v_staff_cost_ratio, v_staff_warn));
  end if;

  if v_opex_ratio > v_opex_bad then
    v_health_score := v_health_score - 15;
    v_reasons := v_reasons || jsonb_build_object('rule', 'critical_opex', 'deduction', 15, 'message', format('Operating expenses consume %s%% of revenue (critical > %s%%).', v_opex_ratio, v_opex_bad));
  elsif v_opex_ratio > v_opex_warn then
    v_health_score := v_health_score - 8;
    v_reasons := v_reasons || jsonb_build_object('rule', 'high_opex', 'deduction', 8, 'message', format('Operating expenses consume %s%% of revenue (warning > %s%%).', v_opex_ratio, v_opex_warn));
  end if;

  if v_unpaid_ratio > v_unpaid_bad then
    v_health_score := v_health_score - 20;
    v_reasons := v_reasons || jsonb_build_object('rule', 'critical_unpaid', 'deduction', 20, 'message', format('Unpaid customer credit is %s%% of revenue (critical > %s%%).', v_unpaid_ratio, v_unpaid_bad));
  elsif v_unpaid_ratio > v_unpaid_warn then
    v_health_score := v_health_score - 10;
    v_reasons := v_reasons || jsonb_build_object('rule', 'high_unpaid', 'deduction', 10, 'message', format('Unpaid customer credit is %s%% of revenue (warning > %s%%).', v_unpaid_ratio, v_unpaid_warn));
  end if;

  if v_adv_ratio > v_adv_warn then
    v_health_score := v_health_score - 8;
    v_reasons := v_reasons || jsonb_build_object('rule', 'high_advances', 'deduction', 8, 'message', format('Staff salary advances are %s%% of total payroll.', v_adv_ratio));
  end if;

  if array_length(v_over_limit_customers, 1) > 0 then
    v_health_score := v_health_score - 12;
    v_reasons := v_reasons || jsonb_build_object('rule', 'customers_over_limit', 'deduction', 12, 'message', format('%s customer(s) exceeded credit limit: %s', array_length(v_over_limit_customers, 1), array_to_string(v_over_limit_customers, ', ')));
  end if;

  if v_prev_revenue > 0 and v_rev_growth < -v_drop_bad then
    v_health_score := v_health_score - 15;
    v_reasons := v_reasons || jsonb_build_object('rule', 'revenue_drop_severe', 'deduction', 15, 'message', format('Revenue declined by %s%% compared to previous period.', abs(v_rev_growth)));
  elsif v_prev_revenue > 0 and v_rev_growth < -v_drop_warn then
    v_health_score := v_health_score - 8;
    v_reasons := v_reasons || jsonb_build_object('rule', 'revenue_drop_mild', 'deduction', 8, 'message', format('Revenue declined by %s%% compared to previous period.', abs(v_rev_growth)));
  end if;

  if v_exp_growth > v_exp_growth_bad and v_exp_growth > (v_rev_growth + 15) then
    v_health_score := v_health_score - 10;
    v_reasons := v_reasons || jsonb_build_object('rule', 'expense_outpacing_revenue', 'deduction', 10, 'message', format('Expenses grew by %s%%, outpacing revenue growth of %s%%.', v_exp_growth, v_rev_growth));
  end if;

  if v_health_score < 0 then
    v_health_score := 0;
  end if;

  if v_health_score >= 80 then
    v_status := 'healthy';
  elsif v_health_score >= 50 then
    v_status := 'warning';
  else
    v_status := 'critical';
  end if;

  -- 13. Construct and return result payload
  return jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', v_period_days),
    'revenue', round(v_revenue, 2),
    'collected', round(v_collected, 2),
    'unpaid', round(v_unpaid, 2),
    'expenses', round(v_expenses, 2),
    'total_salary', round(v_total_salary, 2),
    'total_advances', round(v_total_advances, 2),
    'net_profit', round(v_net_profit, 2),
    'cash_profit', round(v_cash_profit, 2),
    'net_margin_pct', v_margin,
    'vehicles_count', v_vehicles_count,
    'avg_ticket', v_avg_per_vehicle,
    'customer_balances_due', round(v_customer_balances_due, 2),
    'over_limit_count', coalesce(array_length(v_over_limit_customers, 1), 0),
    'ratios', jsonb_build_object(
      'staff_cost_pct', v_staff_cost_ratio,
      'opex_pct', v_opex_ratio,
      'unpaid_credit_pct', v_unpaid_ratio,
      'advances_pct', v_adv_ratio
    ),
    'growth', jsonb_build_object(
      'revenue_growth_pct', v_rev_growth,
      'net_growth_pct', v_net_growth,
      'expense_growth_pct', v_exp_growth
    ),
    'health', jsonb_build_object(
      'score', v_health_score,
      'status', v_status,
      'reasons', v_reasons
    ),
    'staff_breakdown', v_staff_breakdown,
    'top_expense_categories', v_expense_categories
  );
end;
$$;
