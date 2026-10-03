-- Migration 005: Seed Data
-- Provides Super Admin, Super Staff, Demo Company (ALNOOR), and full role accounts

-- Demo company UUID
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

  v_today date := current_date;
begin
  -- 1. Insert Company ALNOOR
  insert into public.companies (id, code, name, valid_until, active, timezone, currency)
  values (
    v_company_id,
    'ALNOOR',
    'Al Noor Auto Care & Garage',
    v_today + interval '365 days',
    true,
    'Asia/Dubai',
    'AED'
  ) on conflict (code) do update set
    name = excluded.name,
    valid_until = excluded.valid_until,
    active = excluded.active;

  -- 2. Insert Company Settings
  insert into public.company_settings (company_id, work_types, vehicle_types, expense_categories, thresholds)
  values (
    v_company_id,
    array['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Ceramic coating', 'Detailing'],
    array['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Sports', 'Bike'],
    array['Rent', 'Utilities', 'Materials', 'Maintenance', 'Equipment', 'Staff Food', 'Transport', 'Other'],
    '{"margin_warn":0.15,"staff_warn":0.40,"staff_bad":0.50,"opex_warn":0.20,"opex_bad":0.30,"unpaid_warn":0.10,"unpaid_bad":0.25,"advance_warn":0.15,"sales_drop_warn":-0.10,"sales_drop_bad":-0.25,"expense_growth":0.20}'::jsonb
  ) on conflict (company_id) do nothing;

  -- 3. Insert Profiles (Note: When using Supabase Auth, auth.users ids match profiles.id.
  -- In direct SQL seeds, we populate profiles for immediate queryability)
  insert into public.profiles (id, company_id, username, full_name, role, pay_type, pay_rate, active)
  values
    (v_admin_id, null, 'admin', 'System Super Admin', 'superadmin', 'none', 0, true),
    (v_superstaff_id, null, 'superstaff', 'Zaid Support Lead', 'superstaff', 'none', 0, true),
    (v_owner_id, v_company_id, 'tariq', 'Tariq Al-Mansoor (Owner)', 'owner', 'none', 0, true),
    (v_manager_id, v_company_id, 'khalid', 'Khalid Al-Hashemi (Manager)', 'manager', 'monthly', 4500.00, true),
    (v_accountant_id, v_company_id, 'sara', 'Sara Al-Zahra (Accountant)', 'accountant', 'monthly', 4000.00, true),
    (v_staff_comm_id, v_company_id, 'rashid', 'Rashid Khan (Technician)', 'staff', 'commission', 35.00, true),
    (v_staff_daily_id, v_company_id, 'imran', 'Imran Ali (Detailer)', 'staff', 'daily', 120.00, true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    pay_type = excluded.pay_type,
    pay_rate = excluded.pay_rate;

  -- 4. Insert Customers
  insert into public.customers (id, company_id, name, mobile, credit_limit)
  values
    (v_cust1_id, v_company_id, 'Emirates Fleet Services', '+971 50 123 4567', 10000.00),
    (v_cust2_id, v_company_id, 'Apex Car Rental LLC', '+971 52 987 6543', 5000.00),
    (v_cust3_id, v_company_id, 'Desert Falcon Transport', '+971 55 456 7890', 8000.00)
  on conflict (id) do nothing;

  -- 5. Insert Sample Attendance (Past 5 days + Today)
  insert into public.attendance (company_id, entry_date, staff_id, status)
  values
    (v_company_id, v_today, v_staff_comm_id, 'present'),
    (v_company_id, v_today, v_staff_daily_id, 'present'),
    (v_company_id, v_today - 1, v_staff_comm_id, 'present'),
    (v_company_id, v_today - 1, v_staff_daily_id, 'present'),
    (v_company_id, v_today - 2, v_staff_comm_id, 'present'),
    (v_company_id, v_today - 2, v_staff_daily_id, 'leave'),
    (v_company_id, v_today - 3, v_staff_comm_id, 'present'),
    (v_company_id, v_today - 3, v_staff_daily_id, 'present')
  on conflict (staff_id, entry_date) do nothing;

  -- 6. Insert Sample Jobs (Today & Previous days)
  -- Job 1: Today walk-in, paid
  insert into public.jobs (company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values (v_company_id, v_today, 'DXB A 48291', '+971 50 111 2233', 'Wash', 'Sedan', v_staff_comm_id, 45.00, 15.00, null, true, v_manager_id);

  -- Job 2: Today walk-in, unpaid
  insert into public.jobs (company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values (v_company_id, v_today, 'SHJ M 19482', '+971 55 333 4455', 'Polish', 'SUV', v_staff_daily_id, 180.00, 50.00, null, false, v_manager_id);

  -- Job 3: Today credit account (Emirates Fleet)
  insert into public.jobs (company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values (v_company_id, v_today, 'AUH 5 99281', '+971 50 123 4567', 'Mechanical', 'Van', v_staff_comm_id, 650.00, 100.00, v_cust1_id, false, v_manager_id);

  -- Job 4: Yesterday walk-in, paid
  insert into public.jobs (company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values (v_company_id, v_today - 1, 'DXB K 88291', '+971 52 444 5566', 'Oil change', 'Sedan', v_staff_comm_id, 220.00, 0.00, null, true, v_manager_id);

  -- Job 5: Yesterday credit account (Apex Car Rental)
  insert into public.jobs (company_id, entry_date, plate, mobile, work_type, vehicle_type, staff_id, price, extra_amount, customer_id, is_paid, created_by)
  values (v_company_id, v_today - 1, 'DXB R 10293', '+971 52 987 6543', 'Painting', 'SUV', v_staff_daily_id, 1200.00, 200.00, v_cust2_id, false, v_manager_id);

  -- 7. Insert Sample Expenses
  insert into public.expenses (company_id, entry_date, category, description, amount, created_by)
  values
    (v_company_id, v_today, 'Materials', 'Car shampoo and microfiber towels', 280.00, v_manager_id),
    (v_company_id, v_today, 'Staff Food', 'Staff lunch & water bottles', 75.00, v_manager_id),
    (v_company_id, v_today - 1, 'Utilities', 'Workshop electricity & water bill', 950.00, v_accountant_id),
    (v_company_id, v_today - 2, 'Maintenance', 'Pressure washer nozzle replacement', 350.00, v_manager_id);

  -- 8. Insert Sample Advances
  insert into public.advances (company_id, entry_date, staff_id, amount, note, created_by)
  values
    (v_company_id, v_today, v_staff_comm_id, 300.00, 'Mid-month grocery advance', v_manager_id),
    (v_company_id, v_today - 1, v_staff_daily_id, 150.00, 'Family medicine advance', v_manager_id);

  -- 9. Insert Sample Customer Payment
  insert into public.customer_payments (company_id, entry_date, customer_id, amount, note, created_by)
  values
    (v_company_id, v_today, v_cust1_id, 500.00, 'Bank transfer - partial settlement', v_accountant_id);

end $$;
