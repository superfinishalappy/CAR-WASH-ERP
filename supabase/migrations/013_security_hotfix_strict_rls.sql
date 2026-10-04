-- ==============================================================================
-- Migration 013: Security Hotfix - Multi-Tenant Row Level Security (RLS)
--
-- Replaces all permissive `USING (true) WITH CHECK (true)` policies with strict
-- tenant isolation (company_id = auth_company()), separate SELECT, INSERT,
-- UPDATE, and DELETE policies per table, and role-based permissions (RBAC).
--
-- Tables secured:
--   1. companies
--   2. profiles
--   3. company_settings
--   4. customers
--   5. jobs
--   6. expenses
--   7. advances
--   8. attendance
--   9. customer_payments
--  10. audit_log (immutable: UPDATE and DELETE strictly blocked)
-- ==============================================================================

-- ==============================================================================
-- 1. Helper Functions (Security Definer & Stable for Performance)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_platform()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('superadmin', 'superstaff')
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_company()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Ensure RLS is enabled on all core tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. Drop All Legacy & Permissive Policies
-- ==============================================================================

-- companies
DROP POLICY IF EXISTS "companies_public_select" ON public.companies;
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- company_settings
DROP POLICY IF EXISTS "company_settings_all" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_select" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_select_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_insert" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_insert_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_update" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_update_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_delete" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_delete_policy" ON public.company_settings;

-- customers
DROP POLICY IF EXISTS "customers_all" ON public.customers;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

-- jobs
DROP POLICY IF EXISTS "jobs_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;

-- expenses
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

-- advances
DROP POLICY IF EXISTS "advances_all" ON public.advances;
DROP POLICY IF EXISTS "advances_select" ON public.advances;
DROP POLICY IF EXISTS "advances_select_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_insert" ON public.advances;
DROP POLICY IF EXISTS "advances_insert_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_update" ON public.advances;
DROP POLICY IF EXISTS "advances_update_policy" ON public.advances;
DROP POLICY IF EXISTS "advances_delete" ON public.advances;
DROP POLICY IF EXISTS "advances_delete_policy" ON public.advances;

-- attendance
DROP POLICY IF EXISTS "attendance_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;

-- customer_payments
DROP POLICY IF EXISTS "customer_payments_all" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_select" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_select_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_insert" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_insert_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_update" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_update_policy" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_delete" ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments_delete_policy" ON public.customer_payments;

-- audit_log
DROP POLICY IF EXISTS "audit_log_all" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_update_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_delete" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_delete_policy" ON public.audit_log;


-- ==============================================================================
-- 3. Strict Multi-Tenant Policies: COMPANIES
-- ==============================================================================

-- SELECT: Platform sees all; Tenant users see only their own company
CREATE POLICY "companies_select_policy" ON public.companies
FOR SELECT USING (
  public.is_platform() OR id = public.auth_company()
);

-- INSERT: Platform only (superadmin / superstaff)
CREATE POLICY "companies_insert_policy" ON public.companies
FOR INSERT WITH CHECK (
  public.is_platform()
);

-- UPDATE: Platform can update any; Owner can update their own company profile
CREATE POLICY "companies_update_policy" ON public.companies
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() = 'owner' AND id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() = 'owner' AND id = public.auth_company())
);

-- DELETE: Superadmin only
CREATE POLICY "companies_delete_policy" ON public.companies
FOR DELETE USING (
  public.is_platform() AND public.auth_role() = 'superadmin'
);


-- ==============================================================================
-- 4. Strict Multi-Tenant Policies: PROFILES
-- ==============================================================================

-- SELECT: Platform sees all; Tenant sees coworker profiles; User always sees their own profile
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
  public.is_platform() 
  OR company_id = public.auth_company()
  OR id = auth.uid()
);

-- INSERT: Platform can create any profile; Owner can create staff/manager/accountant in their own company
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
  public.is_platform() 
  OR (
    public.auth_role() = 'owner' 
    AND company_id = public.auth_company() 
    AND role NOT IN ('superadmin', 'superstaff')
  )
);

-- UPDATE: Platform can update any; Owner can update company staff; User can update their own profile
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
  public.is_platform() 
  OR (
    public.auth_role() = 'owner' 
    AND company_id = public.auth_company()
    AND role NOT IN ('superadmin', 'superstaff')
  )
  OR (
    id = auth.uid() 
    AND (company_id = public.auth_company() OR company_id IS NULL)
  )
) WITH CHECK (
  public.is_platform() 
  OR (
    public.auth_role() = 'owner' 
    AND company_id = public.auth_company()
    AND role NOT IN ('superadmin', 'superstaff')
  )
  OR (
    id = auth.uid() 
    AND (company_id = public.auth_company() OR company_id IS NULL)
  )
);

-- DELETE: Platform can delete any profile; Owner can delete staff in their own company (cannot delete self)
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
  public.is_platform() 
  OR (
    public.auth_role() = 'owner' 
    AND company_id = public.auth_company() 
    AND id <> auth.uid()
    AND role NOT IN ('superadmin', 'superstaff')
  )
);


-- ==============================================================================
-- 5. Strict Multi-Tenant Policies: COMPANY_SETTINGS
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "company_settings_select_policy" ON public.company_settings
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or Owner within their company
CREATE POLICY "company_settings_insert_policy" ON public.company_settings
FOR INSERT WITH CHECK (
  public.is_platform() OR (public.auth_role() = 'owner' AND company_id = public.auth_company())
);

-- UPDATE: Platform or Owner/Manager within their company
CREATE POLICY "company_settings_update_policy" ON public.company_settings
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
);

-- DELETE: Platform only
CREATE POLICY "company_settings_delete_policy" ON public.company_settings
FOR DELETE USING (
  public.is_platform()
);


-- ==============================================================================
-- 6. Strict Multi-Tenant Policies: CUSTOMERS
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "customers_select_policy" ON public.customers
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or tenant member inside their own company
CREATE POLICY "customers_insert_policy" ON public.customers
FOR INSERT WITH CHECK (
  public.is_platform() OR company_id = public.auth_company()
);

-- UPDATE: Platform or tenant member inside their own company
CREATE POLICY "customers_update_policy" ON public.customers
FOR UPDATE USING (
  public.is_platform() OR company_id = public.auth_company()
) WITH CHECK (
  public.is_platform() OR company_id = public.auth_company()
);

-- DELETE: Platform or Owner inside their own company
CREATE POLICY "customers_delete_policy" ON public.customers
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() = 'owner' AND company_id = public.auth_company())
);


-- ==============================================================================
-- 7. Strict Multi-Tenant Policies: JOBS
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "jobs_select_policy" ON public.jobs
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or tenant member inside their own company
CREATE POLICY "jobs_insert_policy" ON public.jobs
FOR INSERT WITH CHECK (
  public.is_platform() OR company_id = public.auth_company()
);

-- UPDATE: Platform or tenant member inside their own company
CREATE POLICY "jobs_update_policy" ON public.jobs
FOR UPDATE USING (
  public.is_platform() OR company_id = public.auth_company()
) WITH CHECK (
  public.is_platform() OR company_id = public.auth_company()
);

-- DELETE: Platform or Owner/Manager inside their own company
CREATE POLICY "jobs_delete_policy" ON public.jobs
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
);


-- ==============================================================================
-- 8. Strict Multi-Tenant Policies: EXPENSES
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "expenses_select_policy" ON public.expenses
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or tenant member inside their own company
CREATE POLICY "expenses_insert_policy" ON public.expenses
FOR INSERT WITH CHECK (
  public.is_platform() OR company_id = public.auth_company()
);

-- UPDATE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "expenses_update_policy" ON public.expenses
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);

-- DELETE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "expenses_delete_policy" ON public.expenses
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);


-- ==============================================================================
-- 9. Strict Multi-Tenant Policies: ADVANCES
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "advances_select_policy" ON public.advances
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "advances_insert_policy" ON public.advances
FOR INSERT WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);

-- UPDATE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "advances_update_policy" ON public.advances
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);

-- DELETE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "advances_delete_policy" ON public.advances
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);


-- ==============================================================================
-- 10. Strict Multi-Tenant Policies: ATTENDANCE
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "attendance_select_policy" ON public.attendance
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or Owner/Manager inside their own company
CREATE POLICY "attendance_insert_policy" ON public.attendance
FOR INSERT WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
);

-- UPDATE: Platform or Owner/Manager inside their own company
CREATE POLICY "attendance_update_policy" ON public.attendance
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
);

-- DELETE: Platform or Owner/Manager inside their own company
CREATE POLICY "attendance_delete_policy" ON public.attendance
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager') AND company_id = public.auth_company())
);


-- ==============================================================================
-- 11. Strict Multi-Tenant Policies: CUSTOMER_PAYMENTS
-- ==============================================================================

-- SELECT: Platform or tenant member
CREATE POLICY "customer_payments_select_policy" ON public.customer_payments
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "customer_payments_insert_policy" ON public.customer_payments
FOR INSERT WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);

-- UPDATE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "customer_payments_update_policy" ON public.customer_payments
FOR UPDATE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
) WITH CHECK (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);

-- DELETE: Platform or Owner/Manager/Accountant inside their own company
CREATE POLICY "customer_payments_delete_policy" ON public.customer_payments
FOR DELETE USING (
  public.is_platform() OR (public.auth_role() IN ('owner', 'manager', 'accountant') AND company_id = public.auth_company())
);


-- ==============================================================================
-- 12. Strict Multi-Tenant Policies: AUDIT_LOG (Immutable Audit Trail)
-- ==============================================================================

-- SELECT: Platform sees all; Tenant member sees their company's audit log
CREATE POLICY "audit_log_select_policy" ON public.audit_log
FOR SELECT USING (
  public.is_platform() OR company_id = public.auth_company()
);

-- INSERT: Platform or tenant member logging an action for their company
CREATE POLICY "audit_log_insert_policy" ON public.audit_log
FOR INSERT WITH CHECK (
  public.is_platform() OR company_id = public.auth_company() OR company_id IS NULL
);

-- UPDATE: Strictly FORBIDDEN (Audit logs are write-once and immutable)
CREATE POLICY "audit_log_update_policy" ON public.audit_log
FOR UPDATE USING (false);

-- DELETE: Strictly FORBIDDEN (Audit logs cannot be erased)
CREATE POLICY "audit_log_delete_policy" ON public.audit_log
FOR DELETE USING (false);
