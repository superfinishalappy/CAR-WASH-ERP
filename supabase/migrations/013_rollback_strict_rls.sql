-- ==============================================================================
-- Rollback for Migration 013: Restore Pre-013 RLS State
--
-- Drops the strict policies introduced in Migration 013 and restores
-- the previous permissive baseline without deleting or altering any existing data.
-- ==============================================================================

-- 1. Drop Migration 013 Policies
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

DROP POLICY IF EXISTS "company_settings_select_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_insert_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_update_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_delete_policy" ON public.company_settings;

DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;

DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

DROP POLICY IF EXISTS "advances_select_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_insert_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_update_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_delete_policy" ON public.advances;

DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;

DROP POLICY IF EXISTS "customer_payments_select_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_insert_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_update_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_delete_policy" ON public.customer_payments;

DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_update_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_delete_policy" ON public.audit_log;

-- 2. Restore 008 Baseline Policies
DROP POLICY IF EXISTS "companies_public_select" ON public.companies;
CREATE POLICY "companies_public_select" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE USING (true);
DROP POLICY IF EXISTS "companies_delete" ON public.companies;
CREATE POLICY "companies_delete" ON public.companies FOR DELETE USING (public.is_platform());

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true);
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.is_platform());

DROP POLICY IF EXISTS "customers_all" ON public.customers;
CREATE POLICY "customers_all" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "jobs_all" ON public.jobs;
CREATE POLICY "jobs_all" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "advances_all" ON public.advances;
CREATE POLICY "advances_all" ON public.advances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_all" ON public.attendance;
CREATE POLICY "attendance_all" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customer_payments_all" ON public.customer_payments;
CREATE POLICY "customer_payments_all" ON public.customer_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "company_settings_all" ON public.company_settings;
CREATE POLICY "company_settings_all" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_all" ON public.audit_log;
CREATE POLICY "audit_log_all" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
