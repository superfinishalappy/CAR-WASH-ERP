-- ==============================================================================
-- Migration 012: Production Scalability Composite Indexes & Query Optimization
-- Garage ERP: Multi-Tenant Performance Tuning for Enterprise Growth
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wzddoscnrcclgkmwedhd/sql/new
-- ==============================================================================

-- 1. JOBS (VEHICLE SERVICE RECORDS) COMPOSITE INDEXES
-- Optimizes:
--   a) Daily vehicle logs & Sales History date filtering: WHERE company_id = ? AND entry_date = ? ORDER BY entry_date DESC
--   b) Customer Statements & Ledgers: WHERE company_id = ? AND customer_id = ? ORDER BY entry_date DESC
--   c) Unpaid Customer Vehicles / Debt Settlement: WHERE company_id = ? AND is_paid = false
--   d) Plate Quick Search: WHERE company_id = ? AND plate ILIKE ?
CREATE INDEX IF NOT EXISTS idx_jobs_company_entry_desc
  ON public.jobs (company_id, entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_company_customer_date
  ON public.jobs (company_id, customer_id, entry_date DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_company_unpaid
  ON public.jobs (company_id, is_paid)
  WHERE is_paid = false;

CREATE INDEX IF NOT EXISTS idx_jobs_company_plate
  ON public.jobs (company_id, plate)
  WHERE plate IS NOT NULL;

-- 2. EXPENSES COMPOSITE INDEXES
-- Optimizes:
--   a) Daily & monthly OPEX reporting: WHERE company_id = ? AND entry_date BETWEEN ? AND ?
--   b) Expense category analytics: WHERE company_id = ? AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_expenses_company_entry_desc
  ON public.expenses (company_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_company_category
  ON public.expenses (company_id, category_id);

-- 3. CUSTOMER PAYMENTS COMPOSITE INDEXES
-- Optimizes:
--   a) Customer ledger statements: WHERE company_id = ? AND customer_id = ? ORDER BY entry_date DESC
--   b) Cash audit & daily revenue reconciliation: WHERE company_id = ? AND entry_date = ?
CREATE INDEX IF NOT EXISTS idx_customer_payments_company_cust
  ON public.customer_payments (company_id, customer_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_payments_company_date
  ON public.customer_payments (company_id, entry_date DESC);

-- 4. CUSTOMERS LOOKUP & SEARCH INDEXES
-- Optimizes:
--   a) Customer account name listing & sorting: WHERE company_id = ? ORDER BY name ASC
--   b) Mobile search for WhatsApp & phone calls: WHERE company_id = ? AND mobile = ?
CREATE INDEX IF NOT EXISTS idx_customers_company_name
  ON public.customers (company_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_company_mobile
  ON public.customers (company_id, mobile)
  WHERE mobile IS NOT NULL;

-- 5. STAFF ATTENDANCE & PAYROLL ADVANCES INDEXES
-- Optimizes:
--   a) Attendance sheet per date: WHERE company_id = ? AND date = ?
--   b) Staff attendance history: WHERE company_id = ? AND staff_id = ? AND date BETWEEN ? AND ?
--   c) Payroll salary advances deduction: WHERE company_id = ? AND staff_id = ? AND is_deducted = false
CREATE INDEX IF NOT EXISTS idx_staff_attendance_company_date
  ON public.staff_attendance (company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_company_staff
  ON public.staff_attendance (company_id, staff_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_salary_advances_company_staff_deducted
  ON public.staff_salary_advances (company_id, staff_id, is_deducted)
  WHERE is_deducted = false;

CREATE INDEX IF NOT EXISTS idx_salary_advances_company_entry
  ON public.staff_salary_advances (company_id, entry_date DESC);

-- 6. AUDIT LOGS INDEXES
-- Optimizes:
--   a) Security & audit queries: WHERE company_id = ? ORDER BY created_at DESC
--   b) Record history drilldown: WHERE table_name = ? AND record_id = ?
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON public.audit_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON public.audit_logs (table_name, record_id);

-- 7. VACUUM AND ANALYZE STATISTICS REFRESH
ANALYZE public.jobs;
ANALYZE public.expenses;
ANALYZE public.customer_payments;
ANALYZE public.customers;
ANALYZE public.staff_attendance;
ANALYZE public.staff_salary_advances;
ANALYZE public.audit_logs;
