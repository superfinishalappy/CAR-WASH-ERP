-- =================================================================================
-- ONE-TIME SCRIPT: Hard Factory Reset
-- Wipes EVERYTHING except the System Super Admin login.
-- =================================================================================

DO $$ 
BEGIN
  -- 1. Truncate all operational tables explicitly
  TRUNCATE TABLE public.jobs CASCADE;
  TRUNCATE TABLE public.expenses CASCADE;
  TRUNCATE TABLE public.fixed_expenses CASCADE;
  TRUNCATE TABLE public.advances CASCADE;
  TRUNCATE TABLE public.attendance CASCADE;
  TRUNCATE TABLE public.customer_payments CASCADE;
  TRUNCATE TABLE public.customers CASCADE;
  TRUNCATE TABLE public.inventory_logs CASCADE;
  TRUNCATE TABLE public.inventory_items CASCADE;
  TRUNCATE TABLE public.audit_log CASCADE;

  -- 2. Wipe all companies and company settings
  TRUNCATE TABLE public.company_settings CASCADE;
  TRUNCATE TABLE public.companies CASCADE;

  -- 3. Wipe all staff profiles unconditionally
  TRUNCATE TABLE public.profiles CASCADE;

  -- 4. Wipe all auth identities and users unconditionally
  DELETE FROM auth.identities;
  DELETE FROM auth.users;
  
  -- 5. Re-create the System Super Admin
  perform public.seed_user(
    'a0000000-0000-0000-0000-000000000001',
    'sysadmin.admin@carwash.app', -- Corresponds to companyCode: ADMIN, username: sysadmin
    'cfi@2024',
    null,
    'sysadmin',
    'System Super Admin',
    'superadmin',
    'none',
    0
  );
  
END $$;
