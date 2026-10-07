// Types for Garage ERP (Postgres + Supabase Schema)

export type AppRole = 'superadmin' | 'superstaff' | 'owner' | 'manager' | 'accountant' | 'senior_staff' | 'staff';
export type PayType = 'none' | 'commission' | 'daily' | 'monthly';
export type AttStatus = 'present' | 'leave';

export interface Company {
  id: string;
  code: string;
  name: string;
  valid_until: string;
  active: boolean;
  timezone: string;
  currency: string;
  created_at: string;
}

export interface ProfilePayRateRecord {
  effective_date: string;
  pay_type: PayType;
  pay_rate: number;
}

export interface Profile {
  id: string;
  company_id: string | null;
  username: string;
  full_name: string;
  role: AppRole;
  pay_type: PayType;
  pay_rate: number;
  pay_history?: ProfilePayRateRecord[];
  active: boolean;
  created_at?: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  mobile: string | null;
  credit_limit: number;
  created_at?: string;
  // Computed fields
  total_jobs?: number;
  total_payments?: number;
  current_balance?: number;
  status?: 'ok' | 'near_limit' | 'over_limit';
}

export interface Job {
  id: string;
  company_id: string;
  entry_date: string;
  plate: string | null;
  mobile: string | null;
  work_type: string;
  vehicle_type: string;
  staff_id: string;
  price: number;
  extra_amount: number;
  total: number;
  customer_id: string | null;
  is_paid: boolean;
  photo_url?: string;
  commission_rate?: number;
  commission_amount?: number;
  created_by: string;
  created_at?: string;
  // Joins
  staff_name?: string;
  customer_name?: string;
}

export interface Expense {
  id: string;
  company_id: string;
  entry_date: string;
  category: string;
  description: string | null;
  amount: number;
  created_by?: string;
  created_at?: string;
}

export interface Advance {
  id: string;
  company_id: string;
  entry_date: string;
  staff_id: string;
  amount: number;
  note: string | null;
  created_by?: string;
  created_at?: string;
  staff_name?: string;
}

export interface Attendance {
  id: string;
  company_id: string;
  entry_date: string;
  staff_id: string;
  status: AttStatus;
  daily_rate?: number;
  created_at?: string;
  staff_name?: string;
}

export interface CustomerPayment {
  id: string;
  company_id: string;
  entry_date: string;
  customer_id: string;
  amount: number;
  note: string | null;
  created_by?: string;
  created_at?: string;
  customer_name?: string;
}

export interface Thresholds {
  margin_warn: number;
  staff_warn: number;
  staff_bad: number;
  opex_warn: number;
  opex_bad: number;
  unpaid_warn: number;
  unpaid_bad: number;
  advance_warn: number;
  sales_drop_warn: number;
  sales_drop_bad: number;
  expense_growth: number;
}

export interface CompanySettings {
  company_id: string;
  work_types: string[];
  vehicle_types: string[];
  expense_categories: string[];
  thresholds: Thresholds;
  monthly_rent?: number;
  monthly_fixed_costs?: number;
  weekly_fixed_costs?: number;
  daily_fixed_costs?: number;
}

export interface AuditLogEntry {
  id: number;
  company_id: string | null;
  table_name: string;
  row_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  user_id: string | null;
  at: string;
}

export interface DiagnosticWarning {
  code: string;
  level: 'red' | 'orange';
  title: string;
  description: string;
  action: string;
}

export interface ReportKPIs {
  vehicles_count: number;
  revenue: number;
  base_amount: number;
  extra_amount: number;
  avg_per_vehicle: number;
  collected: number;
  unpaid: number;
  customer_balances_due: number;
  expenses: number;
  total_salary: number;
  total_advances: number;
  net_profit: number;
  cash_profit: number;
  net_margin: number;
}

export interface PreviousComparison {
  prev_start_date: string;
  prev_end_date: string;
  prev_revenue: number;
  prev_expenses: number;
  prev_salary: number;
  prev_net_profit: number;
  prev_vehicles_count: number;
  sales_growth_pct: number;
  expense_growth_pct: number;
}

export interface StaffPayrollItem {
  staff_id: string;
  full_name: string;
  role: AppRole;
  pay_type: PayType;
  pay_rate: number;
  jobs_count: number;
  jobs_sales: number;
  present_days: number;
  leave_days: number;
  gross_salary: number;
  advances: number;
  paid_salary: number;
  balance_to_pay: number;
}

export interface ReportData {
  kpis: ReportKPIs;
  previous_comparison: PreviousComparison;
  health: {
    score: number;
    status: 'healthy' | 'fair' | 'at_risk';
    warnings: DiagnosticWarning[];
  };
  daily_chart: Array<{ date: string; revenue: number; expenses: number }>;
  pnl_categories: Array<{
    category: string;
    amount: number;
    percent_of_revenue: number;
    percent_of_expenses: number;
  }>;
  staff_payroll: StaffPayrollItem[];
  sales_by_work_type: Array<{ work_type: string; count: number; total: number; percent: number }>;
  sales_by_vehicle_type: Array<{ vehicle_type: string; count: number; total: number; percent: number }>;
  unpaid_vehicles: Array<{
    id: string;
    entry_date: string;
    plate: string | null;
    mobile: string | null;
    work_type: string;
    vehicle_type: string;
    total: number;
    staff_name: string;
  }>;
  customer_accounts: Array<{
    id: string;
    name: string;
    mobile: string | null;
    credit_limit: number;
    current_balance: number;
    status: 'ok' | 'near_limit' | 'over_limit';
  }>;
  fixed_costs: {
    monthly_rent: number;
    monthly_other: number;
    weekly_other: number;
    daily_other: number;
    period_fixed_cost: number;
    period_variable_cost: number;
    period_total_cost: number;
  };
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    username: string;
    company_code: string;
  };
  profile: Profile;
  company: Company | null;
  actingCompanyId?: string | null;
  actingCompany?: Company | null;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  unit: string;
  current_stock: number;
  expected_washes: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryLog {
  id: string;
  company_id: string;
  item_id: string;
  action_type: 'add_stock' | 'start_batch' | 'empty_batch' | 'write_off';
  quantity: number;
  entry_date: string;
  note: string | null;
  created_by?: string;
  created_at?: string;
  item_name?: string; // For joins
}

export interface FixedExpense {
  id: string;
  company_id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'daily';
  created_at?: string;
}
