-- =================================================================================
-- Migration: Professional Backend Analytics (RPC Functions)
-- Pushes heavy calculations from the frontend to the PostgreSQL backend
-- =================================================================================

-- 1. EXPENSE ANALYTICS TOTALS
-- Calculates total operating, fixed, advances, and inventory outflows securely on the server
CREATE OR REPLACE FUNCTION expense_analytics_totals(p_from date, p_to date)
RETURNS TABLE(
    total_operating numeric, 
    total_fixed numeric, 
    total_advances numeric, 
    total_inventory numeric,
    combined_outflow numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH 
    op_exp AS (
      SELECT COALESCE(SUM(amount), 0) AS amt 
      FROM expenses 
      WHERE company_id = public.auth_company() AND entry_date BETWEEN p_from AND p_to
    ),
    fix_exp AS (
      SELECT COALESCE(SUM(amount), 0) AS amt 
      FROM fixed_expenses 
      WHERE company_id = public.auth_company()
    ),
    adv_exp AS (
      SELECT COALESCE(SUM(amount), 0) AS amt 
      FROM advances 
      WHERE company_id = public.auth_company() AND entry_date BETWEEN p_from AND p_to
    ),
    inv_exp AS (
      SELECT COALESCE(SUM(total_cost), 0) AS amt 
      FROM inventory_logs 
      WHERE company_id = public.auth_company() 
        AND action_type = 'add_stock' 
        AND entry_date BETWEEN p_from AND p_to
    )
  SELECT 
    op_exp.amt AS total_operating,
    fix_exp.amt AS total_fixed,
    adv_exp.amt AS total_advances,
    inv_exp.amt AS total_inventory,
    (op_exp.amt + fix_exp.amt + adv_exp.amt + inv_exp.amt) AS combined_outflow
  FROM op_exp, fix_exp, adv_exp, inv_exp;
$$;


-- 2. UNIFIED CATEGORY BREAKDOWN
-- Aggregates all expenses (Operating, Fixed, Advances, Inventory) grouped by category
CREATE OR REPLACE FUNCTION expense_category_breakdown(p_from date, p_to date)
RETURNS TABLE(category text, total_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Operating Expenses
  SELECT category, SUM(amount) AS total_amount
  FROM expenses
  WHERE company_id = public.auth_company() AND entry_date BETWEEN p_from AND p_to
  GROUP BY category

  UNION ALL

  -- Fixed Expenses
  SELECT name AS category, SUM(amount) AS total_amount
  FROM fixed_expenses
  WHERE company_id = public.auth_company()
  GROUP BY name

  UNION ALL

  -- Staff Advances
  SELECT 'Staff Advances' AS category, SUM(amount) AS total_amount
  FROM advances
  WHERE company_id = public.auth_company() AND entry_date BETWEEN p_from AND p_to
  HAVING SUM(amount) > 0

  UNION ALL

  -- Inventory Purchases
  SELECT 'Inventory Purchases' AS category, SUM(total_cost) AS total_amount
  FROM inventory_logs
  WHERE company_id = public.auth_company() 
    AND action_type = 'add_stock' 
    AND entry_date BETWEEN p_from AND p_to
  HAVING SUM(total_cost) > 0

  ORDER BY total_amount DESC;
$$;


-- 3. ENHANCED DASHBOARD KPIs (Includes Expenses)
-- Adds expense deduction to calculate true Net Profit
CREATE OR REPLACE FUNCTION company_financial_kpis(p_from date, p_to date)
RETURNS TABLE(
    total_revenue numeric, 
    total_paid_revenue numeric, 
    total_unpaid_revenue numeric, 
    total_outflow numeric,
    net_profit numeric,
    total_jobs bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH 
    rev AS (
      SELECT 
        COALESCE(SUM(price + extra_amount), 0) AS revenue,
        COALESCE(SUM(CASE WHEN is_paid THEN price + extra_amount ELSE 0 END), 0) AS paid,
        COALESCE(SUM(CASE WHEN NOT is_paid THEN price + extra_amount ELSE 0 END), 0) AS unpaid,
        COUNT(*) AS jobs
      FROM jobs
      WHERE company_id = public.auth_company() AND entry_date BETWEEN p_from AND p_to
    ),
    outflows AS (
      SELECT combined_outflow FROM expense_analytics_totals(p_from, p_to)
    )
  SELECT 
    rev.revenue AS total_revenue,
    rev.paid AS total_paid_revenue,
    rev.unpaid AS total_unpaid_revenue,
    outflows.combined_outflow AS total_outflow,
    (rev.paid - outflows.combined_outflow) AS net_profit, -- Cash-basis Net Profit
    rev.jobs AS total_jobs
  FROM rev, outflows;
$$;
