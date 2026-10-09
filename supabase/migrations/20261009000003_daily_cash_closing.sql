-- =================================================================================
-- Migration: Daily Cash Closing & Payment Date Tracking
-- Separates "Today's Revenue" from "Past Debts Collected Today" for accurate cash drawers.
-- =================================================================================

-- 1. Add payment_date to Jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS payment_date date;

-- 2. Backfill existing paid jobs so older data isn't lost
UPDATE public.jobs 
SET payment_date = entry_date 
WHERE is_paid = true AND payment_date IS NULL;

-- 3. Create the Daily Cash Closing Report Function
-- This function calculates exactly what should be in the physical cash drawer today
CREATE OR REPLACE FUNCTION daily_cash_closing(p_date date)
RETURNS TABLE(
    actual_revenue numeric,         -- Total value of work done today (Paid + Unpaid)
    today_paid_sales numeric,       -- Cash received for work done TODAY
    today_unpaid_sales numeric,     -- Work done TODAY that wasn't paid yet
    past_cash_collected numeric,    -- Cash received TODAY for work done in the PAST
    total_cash_in_drawer numeric    -- The total physical cash that should be in the box (today_paid_sales + past_cash_collected)
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
    -- Work paid on p_date, but performed on a previous date
    past_debts_paid_today AS (
      SELECT COALESCE(SUM(price + extra_amount), 0) AS collected
      FROM jobs
      WHERE company_id = public.auth_company() 
        AND payment_date = p_date 
        AND entry_date < p_date
    )
  SELECT 
    tw.total_revenue AS actual_revenue,
    tw.paid AS today_paid_sales,
    tw.unpaid AS today_unpaid_sales,
    pd.collected AS past_cash_collected,
    (tw.paid + pd.collected) AS total_cash_in_drawer
  FROM today_work tw, past_debts_paid_today pd;
$$;
