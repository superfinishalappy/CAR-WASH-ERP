-- ==============================================================================
-- Migration 008: Pure Admin Only Setup (Clean Slate)
-- Only System Super Admin is created.
-- All companies, users, jobs, customers, and expenses will be created by Admin via UI.
-- ==============================================================================

-- 1. Enable pgcrypto for password hashing & uuid generation
create extension if not exists "pgcrypto";

-- 2. Clear ALL existing data safely
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'jobs') then
    truncate table public.jobs cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'expenses') then
    truncate table public.expenses cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'advances') then
    truncate table public.advances cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    truncate table public.attendance cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'customer_payments') then
    truncate table public.customer_payments cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'customers') then
    truncate table public.customers cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_log') then
    truncate table public.audit_log cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'company_settings') then
    delete from public.company_settings;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    delete from public.profiles;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'companies') then
    delete from public.companies;
  end if;
  delete from auth.identities;
  delete from auth.users;
end $$;

-- 3. Custom ENUM types
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('superadmin', 'superstaff', 'owner', 'manager', 'accountant', 'staff');
  end if;
  if not exists (select 1 from pg_type where typname = 'pay_type') then
    create type pay_type as enum ('none', 'commission', 'daily', 'monthly');
  end if;
  if not exists (select 1 from pg_type where typname = 'att_status') then
    create type att_status as enum ('present', 'leave');
  end if;
end $$;

-- 4. Core Tables
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  valid_until date not null,
  active boolean not null default true,
  timezone text not null default 'Asia/Dubai',
  currency text not null default 'AED',
  created_at timestamptz default now()
);

create or replace function public.trg_uppercase_company_code()
returns trigger as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_code_upper on public.companies;
create trigger trg_companies_code_upper
before insert or update on public.companies
for each row execute function public.trg_uppercase_company_code();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  username text not null,
  full_name text not null,
  role app_role not null,
  pay_type pay_type not null default 'none',
  pay_rate numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (company_id, username)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  mobile text,
  credit_limit numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null,
  plate text,
  mobile text,
  work_type text not null,
  vehicle_type text not null,
  staff_id uuid not null references public.profiles(id),
  price numeric(12,2) not null check (price >= 0),
  extra_amount numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (price + extra_amount) stored,
  customer_id uuid references public.customers(id) on delete restrict,
  is_paid boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null,
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null,
  staff_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null,
  staff_id uuid not null references public.profiles(id),
  status att_status not null,
  created_at timestamptz default now(),
  unique (staff_id, entry_date)
);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  work_types text[] default '{Wash,Polish,Painting,Mechanical,Oil change,AC service,Detailing}',
  vehicle_types text[] default '{Sedan,SUV,Hatchback,Pickup,Van,Sports,Bike}',
  expense_categories text[] default '{Rent,Utilities,Materials,Maintenance,Equipment,Staff Food,Transport,Other}',
  thresholds jsonb default '{"margin_warn":0.15,"staff_warn":0.40,"staff_bad":0.50,"opex_warn":0.20,"opex_bad":0.30,"unpaid_warn":0.10,"unpaid_bad":0.25,"advance_warn":0.15,"sales_drop_warn":-0.10,"sales_drop_bad":-0.25,"expense_growth":0.20}'
);

create table if not exists public.audit_log (
  id bigserial primary key,
  company_id uuid,
  table_name text,
  action text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  performed_by uuid,
  timestamp timestamptz default now()
);

-- 5. Helper Functions
create or replace function public.is_platform()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'superstaff') and active = true);
$$;

create or replace function public.auth_company()
returns uuid language sql security definer stable set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.auth_role()
returns app_role language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- 6. Row Level Security Policies
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

drop policy if exists "companies_public_select" on public.companies;
create policy "companies_public_select" on public.companies for select using (true);
drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies for insert with check (true);
drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies for update using (true);
drop policy if exists "companies_delete" on public.companies;
create policy "companies_delete" on public.companies for delete using (public.is_platform());

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (true);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (true);
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete using (public.is_platform());

drop policy if exists "customers_all" on public.customers;
create policy "customers_all" on public.customers for all using (true) with check (true);
drop policy if exists "jobs_all" on public.jobs;
create policy "jobs_all" on public.jobs for all using (true) with check (true);
drop policy if exists "expenses_all" on public.expenses;
create policy "expenses_all" on public.expenses for all using (true) with check (true);
drop policy if exists "advances_all" on public.advances;
create policy "advances_all" on public.advances for all using (true) with check (true);
drop policy if exists "attendance_all" on public.attendance;
create policy "attendance_all" on public.attendance for all using (true) with check (true);
drop policy if exists "customer_payments_all" on public.customer_payments;
create policy "customer_payments_all" on public.customer_payments for all using (true) with check (true);
drop policy if exists "company_settings_all" on public.company_settings;
create policy "company_settings_all" on public.company_settings for all using (true) with check (true);
drop policy if exists "audit_log_all" on public.audit_log;
create policy "audit_log_all" on public.audit_log for all using (true) with check (true);

-- 7. Seed User Function
create or replace function public.seed_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_company_id uuid,
  p_username text,
  p_full_name text,
  p_role app_role,
  p_pay_type pay_type default 'none',
  p_pay_rate numeric default 0
) returns void as $$
begin
  delete from auth.identities where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'username', p_username),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_user_id,
    format('{"sub":"%s","email":"%s"}', p_user_id, p_email)::jsonb,
    'email', p_user_id::text, now(), now(), now()
  );

  insert into public.profiles (id, company_id, username, full_name, role, pay_type, pay_rate, active)
  values (p_user_id, p_company_id, p_username, p_full_name, p_role, p_pay_type, p_pay_rate, true);
end;
$$ language plpgsql security definer;

-- 8. Seed ONLY the System Super Admin
do $$
declare
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
begin
  -- Super Admin: Company ADMIN / Username: admin / Password: AdminPassword123!
  perform public.seed_user(
    v_admin_id,
    'admin.admin@carwash.app',
    'AdminPassword123!',
    null,
    'admin',
    'System Super Admin',
    'superadmin',
    'none',
    0
  );
end $$;
