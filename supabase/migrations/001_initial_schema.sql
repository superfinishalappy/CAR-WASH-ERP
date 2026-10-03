-- Migration 001: Initial Schema for Garage ERP
-- Multi-tenant SaaS for Car Wash, Painting, and Mechanical Workshops

-- Enable pgcrypto / uuid generation
create extension if not exists "pgcrypto";

-- Custom enum types
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

-- 1. Companies Table
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- Company ID used at login, stored UPPERCASE
  name text not null,
  valid_until date not null,
  active boolean not null default true,      -- manual suspend
  timezone text not null default 'Asia/Dubai',
  currency text not null default 'AED',
  created_at timestamptz default now()
);

-- Ensure company code is stored uppercase
create or replace function trg_uppercase_company_code()
returns trigger as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_code_upper on companies;
create trigger trg_companies_code_upper
before insert or update on companies
for each row execute function trg_uppercase_company_code();

-- 2. Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,  -- null only for superadmin / superstaff
  username text not null,
  full_name text not null,
  role app_role not null,
  pay_type pay_type not null default 'none',
  pay_rate numeric(12,2) not null default 0, -- % for commission, amount for daily/monthly
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (company_id, username)
);

-- 3. Customers Table (Credit accounts: companies, fleet, workshops)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  mobile text,
  credit_limit numeric(12,2) not null default 0,  -- 0 = no limit
  created_at timestamptz default now()
);

-- 4. Jobs Table (Daily vehicles / work orders)
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  plate text,
  mobile text,
  work_type text not null,
  vehicle_type text not null,
  staff_id uuid not null references profiles(id),   -- staff handling the vehicle
  price numeric(12,2) not null check (price >= 0),
  extra_amount numeric(12,2) not null default 0,    -- polish etc., optional
  total numeric(12,2) generated always as (price + extra_amount) stored,
  customer_id uuid references customers(id) on delete restrict,  -- null = walk-in
  is_paid boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  check (customer_id is null or is_paid = false)    -- account jobs are credit
);

-- 5. Expenses Table
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 6. Advances Table (Staff salary advances)
create table if not exists advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  staff_id uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 7. Attendance Table
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  staff_id uuid not null references profiles(id),
  status att_status not null,
  created_at timestamptz default now(),
  unique (staff_id, entry_date)
);

-- 8. Customer Payments Table (Money received from credit customers)
create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  customer_id uuid not null references customers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 9. Company Settings Table (Editable lists + warning thresholds)
create table if not exists company_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  work_types text[] default '{Wash,Polish,Painting,Mechanical,Oil change,AC service,Other}',
  vehicle_types text[] default '{Sedan,SUV,Hatchback,Pickup,Van,Bike}',
  expense_categories text[] default '{Rent,Utilities,Materials,Transport,Maintenance,Food,Other}',
  thresholds jsonb default '{"margin_warn":0.15,"staff_warn":0.40,"staff_bad":0.50,"opex_warn":0.20,"opex_bad":0.30,"unpaid_warn":0.10,"unpaid_bad":0.25,"advance_warn":0.15,"sales_drop_warn":-0.10,"sales_drop_bad":-0.25,"expense_growth":0.20}'
);

-- 10. Audit Log Table
create table if not exists audit_log (
  id bigserial primary key,
  company_id uuid,
  table_name text,
  row_id uuid,
  action text,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  at timestamptz default now()
);

-- Indexes for performance and query optimization (§9 Non-functional requirements)
create index if not exists idx_jobs_company_entry on jobs(company_id, entry_date);
create index if not exists idx_jobs_customer_id on jobs(customer_id);
create index if not exists idx_jobs_staff_id on jobs(staff_id);

create index if not exists idx_expenses_company_entry on expenses(company_id, entry_date);
create index if not exists idx_advances_company_entry on advances(company_id, entry_date);
create index if not exists idx_advances_staff_id on advances(staff_id);

create index if not exists idx_attendance_company_entry on attendance(company_id, entry_date);
create index if not exists idx_attendance_staff_id on attendance(staff_id);

create index if not exists idx_customer_payments_company_entry on customer_payments(company_id, entry_date);
create index if not exists idx_customer_payments_customer_id on customer_payments(customer_id);

create index if not exists idx_audit_log_company_id on audit_log(company_id, at desc);
