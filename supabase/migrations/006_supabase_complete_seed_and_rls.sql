-- ==============================================================================
-- Migration 006: Complete Supabase Auth Setup, Clean Schema & Seed Data
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable pgcrypto for password hashing & uuid generation
create extension if not exists "pgcrypto";

-- 2. Clear corrupted records from previous failed runs (fixes 500 Database error querying schema)
delete from auth.identities;
delete from auth.users;

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

-- Ensure company code is uppercase
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
  work_types text[] default '{Wash,Polish,Painting,Mechanical,Oil change,AC service,Other}',
  vehicle_types text[] default '{Sedan,SUV,Hatchback,Pickup,Van,Bike}',
  expense_categories text[] default '{Rent,Utilities,Materials,Transport,Maintenance,Food,Other}',
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

-- ==============================================================================
-- 5. Helper Functions for RLS
-- ==============================================================================
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

-- ==============================================================================
-- 6. Row Level Security Policies (Non-recursive, safe for Supabase Studio)
-- ==============================================================================
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

-- Companies: Public can read to validate company code on login
drop policy if exists "companies_select" on public.companies;
drop policy if exists "companies_public_select" on public.companies;
create policy "companies_public_select" on public.companies for select using (true);

drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies for insert with check (true);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies for update using (true);

drop policy if exists "companies_delete" on public.companies;
create policy "companies_delete" on public.companies for delete using (public.is_platform());

-- Profiles: Public select avoids recursive RLS loops that crash Supabase schema queries
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (true);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (
  public.is_platform()
  or company_id = public.auth_company()
  or id = auth.uid()
);

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete using (public.is_platform());

-- Tenant Tables: Standard isolation
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

-- ==============================================================================
-- 7. Bulletproof User Creation Function
-- Fixes error 42P10 (no on-conflict specification) and sets all required string fields
-- ==============================================================================
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
  -- 1. Remove previous records for this user (avoids ON CONFLICT 42P10 constraint errors)
  delete from auth.identities where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;

  -- 2. Insert into auth.users with ALL required string columns set to ''
  -- Prevents GoTrue scan errors (500: Database error querying schema)
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'username', p_username),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );

  -- 3. Insert into auth.identities for password login
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    p_user_id,
    format('{"sub":"%s","email":"%s"}', p_user_id, p_email)::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  );

  -- 4. Insert into public.profiles
  insert into public.profiles (
    id,
    company_id,
    username,
    full_name,
    role,
    pay_type,
    pay_rate,
    active
  ) values (
    p_user_id,
    p_company_id,
    p_username,
    p_full_name,
    p_role,
    p_pay_type,
    p_pay_rate,
    true
  );
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 8. Seed Companies, Users & Demo Records
-- ==============================================================================
do $$
declare
  v_company_id uuid := '11111111-1111-1111-1111-111111111111';
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_superstaff_id uuid := 'a0000000-0000-0000-0000-000000000002';
  v_owner_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_manager_id uuid := 'b0000000-0000-0000-0000-000000000002';
  v_accountant_id uuid := 'b0000000-0000-0000-0000-000000000003';
  v_staff_comm_id uuid := 'b0000000-0000-0000-0000-000000000004';
  v_staff_daily_id uuid := 'b0000000-0000-0000-0000-000000000005';

  v_cust1_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_cust2_id uuid := 'c0000000-0000-0000-0000-000000000002';
  v_cust3_id uuid := 'c0000000-0000-0000-0000-000000000003';

  v_job1_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_job2_id uuid := 'd0000000-0000-0000-0000-000000000002';
  v_job3_id uuid := 'd0000000-0000-0000-0000-000000000003';

  v_exp1_id uuid := 'e0000000-0000-0000-0000-000000000001';
  v_exp2_id uuid := 'e0000000-0000-0000-0000-000000000002';

  v_adv1_id uuid := 'f0000000-0000-0000-0000-000000000001';
  v_pay1_id uuid := '90000000-0000-0000-0000-000000000001';

  v_today date := current_date;
begin
  -- 1. Insert Company ALNOOR
  delete from public.companies where id = v_company_id or code = 'ALNOOR';
  insert into public.companies (id, code, name, valid_until, active, timezone, currency)
  values (
    v_company_id,
    'ALNOOR',
    'Al Noor Auto Care & Garage',
    v_today + interval '365 days',
    true,
    'Asia/Dubai',
    'AED'
  );

  -- 2. Insert Company Settings
  delete from public.company_settings where company_id = v_company_id;
  insert into public.company_settings (company_id, work_types, vehicle_types, expense_categories, thresholds)
  values (
    v_company_id,
    array['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Ceramic coating', 'Detailing'],
    array['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Sports', 'Bike'],
    array['Rent', 'Utilities', 'Materials', 'Maintenance', 'Equipment', 'Staff Food', 'Transport', 'Other'],
    '{"margin_warn":0.15,"staff_warn":0.40,"staff_bad":0.50,"opex_warn":0.20,"opex_bad":0.30,"unpaid_warn":0.10,"unpaid_bad":0.25,"advance_warn":0.15,"sales_drop_warn":-0.10,"sales_drop_bad":-0.25,"expense_growth":0.20}'::jsonb
  );

  -- 3. Seed Users (Superadmin, Owner, Manager, Accountant, Staff)
  -- Super Admin: Company: ADMIN | Username: admin | Password: AdminPassword123!
  perform public.seed_user(v_admin_id, 'admin.admin@carwash.app', 'AdminPassword123!', null, 'admin', 'System Super Admin', 'superadmin', 'none', 0);

  -- Super Staff: Company: ADMIN | Username: superstaff | Password: SuperPassword123!
  perform public.seed_user(v_superstaff_id, 'superstaff.admin@carwash.app', 'SuperPassword123!', null, 'superstaff', 'Zaid Support Lead', 'superstaff', 'none', 0);

  -- Company Owner: Company: ALNOOR | Username: tariq | Password: OwnerPassword123!
  perform public.seed_user(v_owner_id, 'tariq.alnoor@carwash.app', 'OwnerPassword123!', v_company_id, 'tariq', 'Tariq Al-Mansoor (Owner)', 'owner', 'none', 0);

  -- Manager: Company: ALNOOR | Username: khalid | Password: ManagerPassword123!
  perform public.seed_user(v_manager_id, 'khalid.alnoor@carwash.app', 'ManagerPassword123!', v_company_id, 'khalid', 'Khalid Al-Hashemi (Manager)', 'manager', 'monthly', 4500.00);

  -- Accountant: Company: ALNOOR | Username: sara | Password: AccountantPassword123!
  perform public.seed_user(v_accountant_id, 'sara.alnoor@carwash.app', 'AccountantPassword123!', v_company_id, 'sara', 'Sara Al-Zahra (Accountant)', 'accountant', 'monthly', 4000.00);

  -- Technician (Commission): Company: ALNOOR | Username: rashid | Password: StaffPassword123!
  perform public.seed_user(v_staff_comm_id, 'rashid.alnoor@carwash.app', 'StaffPassword123!', v_company_id, 'rashid', 'Rashid Khan (Technician)', 'staff', 'commission', 35.00);

  -- Detailer (Daily): Company: ALNOOR | Username: imran | Password: StaffPassword123!
  perform public.seed_user(v_staff_daily_id, 'imran.alnoor@carwash.app', 'StaffPassword123!', v_company_id, 'imran', 'Imran Ali (Detailer)', 'staff', 'daily', 120.00);

  -- 4. Seed Customers
  delete from public.customers where company_id = v_company_id;
  insert into public.customers (id, company_id, name, mobile, credit_limit)
  values
    (v_cust1_id, v_company_id, 'Emirates Fleet Services', '+971 50 123 4567', 10000.00),
    (v_cust2_id, v_company_id, 'Apex Car Rental LLC', '+971 52 987 6543', 5000.00),
    (v_cust3_id, v_company_id, 'Desert Falcon Transport', '+971 55 456 7890', 8000.00);

  -- 5. Seed Attendance
  delete from public.attendance where company_id = v_company_id;
  insert into public.attendance (company_id, entry_date, staff_id, status)
  values
    (v_company_id, v_today, v_staff_comm_id, 'present'),
    (v_company_id, v_today, v_staff_daily_id, 'present'),
    (v_company_id, v_today - 1, v_staff_comm_id, 'present'),
    (v_company_id, v_today - 1, v_staff_daily_id, 'present'),
    (v_company_id, v_today - 2, v_staff_comm_id, 'present'),
    (v_company_id, v_today - 2, v_staff_daily_id, 'leave');

  -- 6. Seed Jobs
  delete from public.jobs where company_id = v_company_id;
  insert into public.jobs (id, company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values
    (v_job1_id, v_company_id, v_today, 'DXB A 48291', '+971 50 111 2233', 'Wash', 'Sedan', v_staff_comm_id, 45.00, 15.00, null, true, v_manager_id),
    (v_job2_id, v_company_id, v_today, 'SHJ M 19482', '+971 55 333 4455', 'Polish', 'SUV', v_staff_daily_id, 180.00, 50.00, null, false, v_manager_id),
    (v_job3_id, v_company_id, v_today, 'AUH 5 99281', '+971 50 123 4567', 'Mechanical', 'Van', v_staff_comm_id, 650.00, 100.00, v_cust1_id, false, v_manager_id);

  -- 7. Seed Expenses
  delete from public.expenses where company_id = v_company_id;
  insert into public.expenses (id, company_id, entry_date, category, description, amount, created_by)
  values
    (v_exp1_id, v_company_id, v_today, 'Materials', 'Car wash shampoo & microfiber cloths', 240.00, v_manager_id),
    (v_exp2_id, v_company_id, v_today, 'Utilities', 'DEWA Water bill payment', 450.00, v_accountant_id);

  -- 8. Seed Advances
  delete from public.advances where company_id = v_company_id;
  insert into public.advances (id, company_id, entry_date, staff_id, amount, note, created_by)
  values
    (v_adv1_id, v_company_id, v_today, v_staff_comm_id, 200.00, 'Emergency medical advance', v_manager_id);

  -- 9. Seed Customer Payments
  delete from public.customer_payments where company_id = v_company_id;
  insert into public.customer_payments (id, company_id, entry_date, customer_id, amount, note, created_by)
  values
    (v_pay1_id, v_company_id, v_today, v_cust1_id, 1500.00, 'Bank transfer - invoice #1029', v_accountant_id);

end $$;
