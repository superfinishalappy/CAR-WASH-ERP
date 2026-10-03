-- Migration 002: Helper functions and Row Level Security (RLS) policies
-- All helper functions run with SECURITY DEFINER and search_path = public

-- 1. Helper function: is_platform()
create or replace function public.is_platform()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('superadmin', 'superstaff')
      and active = true
  );
$$;

-- 2. Helper function: auth_role()
create or replace function public.auth_role()
returns app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- 3. Helper function: auth_company()
create or replace function public.auth_company()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- 4. Helper function: company_live(cid uuid)
create or replace function public.company_live(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.companies
    where id = cid
      and active = true
      and valid_until >= (now() at time zone timezone)::date
  );
$$;

-- 5. Helper function: today_in(cid uuid)
create or replace function public.today_in(cid uuid)
returns date
language sql
security definer
stable
set search_path = public
as $$
  select (now() at time zone coalesce((select timezone from public.companies where id = cid), 'Asia/Dubai'))::date;
$$;

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.expenses enable row level security;
alter table public.advances enable row level security;
alter table public.attendance enable row level security;
alter table public.customer_payments enable row level security;
alter table public.company_settings enable row level security;
alter table public.audit_log enable row level security;

-- ==========================================================
-- COMPANIES POLICIES
-- ==========================================================
-- SELECT: Superadmin/Superstaff can select all; Company users can select their own row
create policy "companies_select"
on public.companies
for select
using (
  public.is_platform()
  or id = public.auth_company()
);

-- INSERT: Superadmin and Superstaff only
create policy "companies_insert"
on public.companies
for insert
with check (
  public.is_platform()
);

-- UPDATE: Superadmin and Superstaff only
create policy "companies_update"
on public.companies
for update
using (
  public.is_platform()
)
with check (
  public.is_platform()
);

-- DELETE: Superadmin only
create policy "companies_delete"
on public.companies
for delete
using (
  public.auth_role() = 'superadmin'
);

-- ==========================================================
-- PROFILES POLICIES
-- ==========================================================
-- SELECT: Platform roles or same company (if company is live)
create policy "profiles_select"
on public.profiles
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
  or id = auth.uid()
);

-- INSERT: Platform roles or Owner of the company (live)
create policy "profiles_insert"
on public.profiles
for insert
with check (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
);

-- UPDATE: Platform roles or Owner (for their company), or users updating their own non-role fields
create policy "profiles_update"
on public.profiles
for update
using (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
  or id = auth.uid()
)
with check (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
);

-- DELETE: Superadmin only or Owner for inactive staff
create policy "profiles_delete"
on public.profiles
for delete
using (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
);

-- ==========================================================
-- COMPANY SETTINGS POLICIES
-- ==========================================================
create policy "company_settings_select"
on public.company_settings
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "company_settings_insert"
on public.company_settings
for insert
with check (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
);

create policy "company_settings_update"
on public.company_settings
for update
using (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
)
with check (
  public.is_platform()
  or (
    public.auth_role() = 'owner'
    and company_id = public.auth_company()
    and public.company_live(company_id)
  )
);

-- ==========================================================
-- CUSTOMERS POLICIES
-- ==========================================================
create policy "customers_select"
on public.customers
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "customers_insert"
on public.customers
for insert
with check (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "customers_update"
on public.customers
for update
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
)
with check (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

-- Delete: Owner only, and only if no jobs exist
create policy "customers_delete"
on public.customers
for delete
using (
  (public.is_platform() or (public.auth_role() = 'owner' and company_id = public.auth_company() and public.company_live(company_id)))
  and not exists (select 1 from public.jobs where customer_id = customers.id)
);

-- ==========================================================
-- JOBS POLICIES
-- ==========================================================
-- SELECT:
create policy "jobs_select"
on public.jobs
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

-- INSERT: Live AND (platform role, owner, or entry_date = today_in(company_id))
create policy "jobs_insert"
on public.jobs
for insert
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

-- UPDATE: Live AND (platform role, owner, or entry_date = today_in(company_id))
create policy "jobs_update"
on public.jobs
for update
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
)
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

-- DELETE: Platform roles and owner any day; manager same day only
create policy "jobs_delete"
on public.jobs
for delete
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or (public.auth_role() = 'manager' and entry_date = public.today_in(company_id))
    )
  )
);

-- ==========================================================
-- EXPENSES POLICIES
-- ==========================================================
create policy "expenses_select"
on public.expenses
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "expenses_insert"
on public.expenses
for insert
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "expenses_update"
on public.expenses
for update
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
)
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

-- DELETE: owner any day; manager or accountant same day
create policy "expenses_delete"
on public.expenses
for delete
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or (public.auth_role() in ('manager', 'accountant') and entry_date = public.today_in(company_id))
    )
  )
);

-- ==========================================================
-- ADVANCES POLICIES
-- ==========================================================
create policy "advances_select"
on public.advances
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "advances_insert"
on public.advances
for insert
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "advances_update"
on public.advances
for update
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
)
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

-- DELETE: owner any day; manager or accountant same day
create policy "advances_delete"
on public.advances
for delete
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or (public.auth_role() in ('manager', 'accountant') and entry_date = public.today_in(company_id))
    )
  )
);

-- ==========================================================
-- ATTENDANCE POLICIES
-- ==========================================================
create policy "attendance_select"
on public.attendance
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "attendance_insert"
on public.attendance
for insert
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "attendance_update"
on public.attendance
for update
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
)
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "attendance_delete"
on public.attendance
for delete
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or (public.auth_role() = 'manager' and entry_date = public.today_in(company_id))
    )
  )
);

-- ==========================================================
-- CUSTOMER PAYMENTS POLICIES
-- ==========================================================
create policy "customer_payments_select"
on public.customer_payments
for select
using (
  public.is_platform()
  or (company_id = public.auth_company() and public.company_live(company_id))
);

create policy "customer_payments_insert"
on public.customer_payments
for insert
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "customer_payments_update"
on public.customer_payments
for update
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
)
with check (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or entry_date = public.today_in(company_id)
    )
  )
);

create policy "customer_payments_delete"
on public.customer_payments
for delete
using (
  public.is_platform()
  or (
    company_id = public.auth_company()
    and public.company_live(company_id)
    and (
      public.auth_role() = 'owner'
      or (public.auth_role() in ('manager', 'accountant') and entry_date = public.today_in(company_id))
    )
  )
);

-- ==========================================================
-- AUDIT LOG POLICIES
-- ==========================================================
-- SELECT: Platform roles see all; Owner sees own company audit logs
create policy "audit_log_select"
on public.audit_log
for select
using (
  public.is_platform()
  or (public.auth_role() = 'owner' and company_id = public.auth_company())
);

-- INSERT: Insert via security definer trigger
create policy "audit_log_insert"
on public.audit_log
for insert
with check (true);
