import {
  Company,
  Profile,
  Customer,
  Job,
  Expense,
  Advance,
  Attendance,
  CustomerPayment,
  CompanySettings,
  AuditLogEntry,
} from '@/types/database';

export const INITIAL_COMPANIES: Company[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'ALNOOR',
    name: 'Al Noor Auto Care & Garage',
    valid_until: '2027-10-01',
    active: true,
    timezone: 'Asia/Dubai',
    currency: 'AED',
    created_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'EXPIRED',
    name: 'Redline Motors (Expired Demo)',
    valid_until: '2026-09-01', // Expired
    active: true,
    timezone: 'Asia/Dubai',
    currency: 'AED',
    created_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    code: 'SUSPENDED',
    name: 'Turbo Clean Workshop (Suspended Demo)',
    valid_until: '2027-01-01',
    active: false, // Suspended
    timezone: 'Asia/Dubai',
    currency: 'AED',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_PROFILES: Profile[] = [
  // Platform Accounts (Company ID: ADMIN)
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    company_id: null,
    username: 'admin',
    full_name: 'System Super Admin',
    role: 'superadmin',
    pay_type: 'none',
    pay_rate: 0,
    active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    company_id: null,
    username: 'superstaff',
    full_name: 'Zaid Support Lead',
    role: 'superstaff',
    pay_type: 'none',
    pay_rate: 0,
    active: true,
  },

  // Company ALNOOR Accounts
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    username: 'tariq',
    full_name: 'Tariq Al-Mansoor (Owner)',
    role: 'owner',
    pay_type: 'none',
    pay_rate: 0,
    active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    username: 'khalid',
    full_name: 'Khalid Al-Hashemi (Manager)',
    role: 'manager',
    pay_type: 'monthly',
    pay_rate: 4500,
    active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    company_id: '11111111-1111-1111-1111-111111111111',
    username: 'sara',
    full_name: 'Sara Al-Zahra (Accountant)',
    role: 'accountant',
    pay_type: 'monthly',
    pay_rate: 4000,
    active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    company_id: '11111111-1111-1111-1111-111111111111',
    username: 'rashid',
    full_name: 'Rashid Khan (Technician)',
    role: 'staff',
    pay_type: 'commission',
    pay_rate: 35, // 35% commission on price only
    active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    company_id: '11111111-1111-1111-1111-111111111111',
    username: 'imran',
    full_name: 'Imran Ali (Detailer)',
    role: 'staff',
    pay_type: 'daily',
    pay_rate: 120, // 120 AED per present day
    active: true,
  },

  // Accounts for Expired Company
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    company_id: '22222222-2222-2222-2222-222222222222',
    username: 'salem',
    full_name: 'Salem Al-Kaabi (Owner Expired)',
    role: 'owner',
    pay_type: 'none',
    pay_rate: 0,
    active: true,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    name: 'Emirates Fleet Services',
    mobile: '+971 50 123 4567',
    credit_limit: 10000,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    name: 'Apex Car Rental LLC',
    mobile: '+971 52 987 6543',
    credit_limit: 5000,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    company_id: '11111111-1111-1111-1111-111111111111',
    name: 'Desert Falcon Transport',
    mobile: '+971 55 456 7890',
    credit_limit: 8000,
  },
];

export const INITIAL_SETTINGS: Record<string, CompanySettings> = {
  '11111111-1111-1111-1111-111111111111': {
    company_id: '11111111-1111-1111-1111-111111111111',
    work_types: ['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Ceramic coating', 'Detailing'],
    vehicle_types: ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Sports', 'Bike'],
    expense_categories: ['Rent', 'Utilities', 'Materials', 'Maintenance', 'Equipment', 'Staff Food', 'Transport', 'Other'],
    thresholds: {
      margin_warn: 0.15,
      staff_warn: 0.40,
      staff_bad: 0.50,
      opex_warn: 0.20,
      opex_bad: 0.30,
      unpaid_warn: 0.10,
      unpaid_bad: 0.25,
      advance_warn: 0.15,
      sales_drop_warn: -0.10,
      sales_drop_bad: -0.25,
      expense_growth: 0.20,
    },
  },
};

import { getLocalDateString, getTodayString, getYesterdayString } from './date-utils';

const today = getTodayString();
const yesterday = getYesterdayString();
const twoDaysAgoDate = new Date();
twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
const twoDaysAgo = getLocalDateString(twoDaysAgoDate);

export const INITIAL_JOBS: Job[] = [
  {
    id: 'j0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    plate: 'DXB A 48291',
    mobile: '+971 50 111 2233',
    work_type: 'Wash',
    vehicle_type: 'Sedan',
    staff_id: 'b0000000-0000-0000-0000-000000000004', // Rashid (commission)
    price: 45,
    extra_amount: 15,
    total: 60,
    customer_id: null,
    is_paid: true,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'j0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    plate: 'SHJ M 19482',
    mobile: '+971 55 333 4455',
    work_type: 'Polish',
    vehicle_type: 'SUV',
    staff_id: 'b0000000-0000-0000-0000-000000000005', // Imran (daily)
    price: 180,
    extra_amount: 50,
    total: 230,
    customer_id: null,
    is_paid: false,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'j0000000-0000-0000-0000-000000000003',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    plate: 'AUH 5 99281',
    mobile: '+971 50 123 4567',
    work_type: 'Mechanical',
    vehicle_type: 'Van',
    staff_id: 'b0000000-0000-0000-0000-000000000004', // Rashid
    price: 650,
    extra_amount: 100,
    total: 750,
    customer_id: 'c0000000-0000-0000-0000-000000000001', // Emirates Fleet
    is_paid: false,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'j0000000-0000-0000-0000-000000000004',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    plate: 'DXB K 88291',
    mobile: '+971 52 444 5566',
    work_type: 'Oil change',
    vehicle_type: 'Sedan',
    staff_id: 'b0000000-0000-0000-0000-000000000004',
    price: 220,
    extra_amount: 0,
    total: 220,
    customer_id: null,
    is_paid: true,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'j0000000-0000-0000-0000-000000000005',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    plate: 'DXB R 10293',
    mobile: '+971 52 987 6543',
    work_type: 'Painting',
    vehicle_type: 'SUV',
    staff_id: 'b0000000-0000-0000-0000-000000000005',
    price: 1200,
    extra_amount: 200,
    total: 1400,
    customer_id: 'c0000000-0000-0000-0000-000000000002', // Apex Car Rental
    is_paid: false,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'x0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    category: 'Materials',
    description: 'Car shampoo and microfiber towels',
    amount: 280,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'x0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    category: 'Staff Food',
    description: 'Staff lunch & bottled water',
    amount: 75,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'x0000000-0000-0000-0000-000000000003',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    category: 'Utilities',
    description: 'Electricity & water utility bill',
    amount: 950,
    created_by: 'b0000000-0000-0000-0000-000000000003',
    created_at: new Date().toISOString(),
  },
  {
    id: 'x0000000-0000-0000-0000-000000000004',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: twoDaysAgo,
    category: 'Maintenance',
    description: 'Pressure washer nozzle replacement',
    amount: 350,
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_ADVANCES: Advance[] = [
  {
    id: 'v0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    staff_id: 'b0000000-0000-0000-0000-000000000004', // Rashid
    amount: 300,
    note: 'Mid-month grocery advance',
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
  {
    id: 'v0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    staff_id: 'b0000000-0000-0000-0000-000000000005', // Imran
    amount: 150,
    note: 'Family medicine advance',
    created_by: 'b0000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_ATTENDANCE: Attendance[] = [
  {
    id: 't0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    staff_id: 'b0000000-0000-0000-0000-000000000004',
    status: 'present',
    created_at: new Date().toISOString(),
  },
  {
    id: 't0000000-0000-0000-0000-000000000002',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    staff_id: 'b0000000-0000-0000-0000-000000000005',
    status: 'present',
    created_at: new Date().toISOString(),
  },
  {
    id: 't0000000-0000-0000-0000-000000000003',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    staff_id: 'b0000000-0000-0000-0000-000000000004',
    status: 'present',
    created_at: new Date().toISOString(),
  },
  {
    id: 't0000000-0000-0000-0000-000000000004',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: yesterday,
    staff_id: 'b0000000-0000-0000-0000-000000000005',
    status: 'present',
    created_at: new Date().toISOString(),
  },
  {
    id: 't0000000-0000-0000-0000-000000000005',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: twoDaysAgo,
    staff_id: 'b0000000-0000-0000-0000-000000000004',
    status: 'present',
    created_at: new Date().toISOString(),
  },
  {
    id: 't0000000-0000-0000-0000-000000000006',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: twoDaysAgo,
    staff_id: 'b0000000-0000-0000-0000-000000000005',
    status: 'leave', // Leave day (not paid for daily staff)
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_CUSTOMER_PAYMENTS: CustomerPayment[] = [
  {
    id: 'p0000000-0000-0000-0000-000000000001',
    company_id: '11111111-1111-1111-1111-111111111111',
    entry_date: today,
    customer_id: 'c0000000-0000-0000-0000-000000000001', // Emirates Fleet
    amount: 500,
    note: 'Bank transfer partial payment',
    created_by: 'b0000000-0000-0000-0000-000000000003',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 1,
    company_id: '11111111-1111-1111-1111-111111111111',
    table_name: 'companies',
    row_id: '11111111-1111-1111-1111-111111111111',
    action: 'INSERT',
    old_data: null,
    new_data: { name: 'Al Noor Auto Care & Garage', code: 'ALNOOR' },
    user_id: 'a0000000-0000-0000-0000-000000000001',
    at: new Date().toISOString(),
  },
];
