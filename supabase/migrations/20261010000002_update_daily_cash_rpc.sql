-- =================================================================================
-- Migration: Update Daily Cash Closing RPC
-- Updates the backend calculation to use manual daily_cash_adjustments 
-- instead of automatically tracking individual job payment dates.
-- =================================================================================

CREATE OR REPLACE FUNCTION daily_cash_closing(p_date date)
RETURNS TABLE(
    actual_revenue numeric,         
    today_paid_sales numeric,       
    today_unpaid_sales numeric,     
    past_cash_collected numeric,    
    total_cash_in_drawer numeric    
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH 
    -- Work done on p_date
    today_work AS (
      SELECT 
        COALESCE(SUM(price + extra_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN is_paid THEN price + extra_amount ELSE 0 END), 0) AS paid,
        COALESCE(SUM(CASE WHEN NOT is_paid THEN price + extra_amount ELSE 0 END), 0) AS unpaid
      FROM jobs
      WHERE company_id = public.auth_company() 
        AND entry_date = p_date
    ),
    -- Manual Cash Adjustments for p_date
    past_cash AS (
      SELECT 
        COALESCE(SUM(amount), 0) AS collected
      FROM daily_cash_adjustments
      WHERE company_id = public.auth_company()
        AND entry_date = p_date
    )
  SELECT 
    today_work.total_revenue AS actual_revenue,
    today_work.paid AS today_paid_sales,
    today_work.unpaid AS today_unpaid_sales,
    past_cash.collected AS past_cash_collected,
    (today_work.paid + past_cash.collected) AS total_cash_in_drawer
  FROM today_work, past_cash;
$$;
