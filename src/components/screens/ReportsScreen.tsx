'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { ReportData, StaffPayrollItem } from '@/types/database';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Phone,
  Car,
  DollarSign,
  Users,
  Receipt,
  Banknote,
  Percent,
  CreditCard,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { exportToCSV, exportToXLSX, printElement } from '@/lib/export';
import { getTodayString, getFirstDayOfMonthString, getLastDayOfMonthString } from '@/lib/date-utils';

const PIE_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];
const VEHICLE_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#f97316', '#64748b'];

export function ReportsScreen() {
  const { session, showToast, t, dataVersion, theme, triggerRefresh } = useApp();
  const role = session?.profile.role || 'staff';
  const isSeniorStaff = role === 'senior_staff';

  const tz = session?.company?.timezone;
  const currency = session?.company?.currency || 'AED';
  const todayStr = getTodayString(tz);
  const [periodPreset, setPeriodPreset] = useState<'today' | 'this_month' | 'last_month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [report, setReport] = useState<ReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Salary Payout Modal State
  const [payingStaff, setPayingStaff] = useState<StaffPayrollItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr);
  const [payMethod, setPayMethod] = useState<'cash' | 'bank'>('cash');
  const [payNote, setPayNote] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const openPayModal = (staff: StaffPayrollItem) => {
    setPayingStaff(staff);
    setPayAmount(staff.balance_to_pay.toString());
    setPayDate(todayStr);
    setPayMethod('cash');
    setPayNote(`${staff.pay_type === 'daily' ? 'Daily wage' : staff.pay_type === 'monthly' ? 'Monthly salary' : 'Commission payout'} (${startDate} to ${endDate})`);
  };

  const handleRecordSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingStaff) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payment amount', 'warning');
      return;
    }

    setIsSubmittingPay(true);
    const res = dataProvider.recordSalaryPayment({
      staff_id: payingStaff.staff_id,
      entry_date: payDate,
      amount: amt,
      payment_method: payMethod,
      note: payNote,
    });
    setIsSubmittingPay(false);

    if (res.success) {
      showToast(`✓ Salary payment of ${amt.toFixed(2)} AED recorded for ${payingStaff.full_name}!`, 'success');
      setPayingStaff(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to record salary payout', 'error');
    }
  };

  const role = session?.profile.role || 'staff';
  // Manager has "both": Data entry + reports!
  const canViewReports = ['superadmin', 'superstaff', 'owner', 'manager', 'accountant'].includes(role);

  const fetchReport = () => {
    if (!canViewReports) {
      setErrorMsg(t.reports.restricted);
      return;
    }
    setErrorMsg(null);
    try {
      const data = dataProvider.getCompanyReport(startDate, endDate);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate report');
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, dataVersion, role]);

  // Handle Preset Changes
  const handlePresetChange = (preset: 'today' | 'this_month' | 'last_month' | 'custom') => {
    setPeriodPreset(preset);
    const now = new Date();

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const first = getFirstDayOfMonthString(now, tz);
      setStartDate(first);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const first = getFirstDayOfMonthString(prevMonth, tz);
      const last = getLastDayOfMonthString(now.getFullYear(), now.getMonth() - 1, tz);
      setStartDate(first);
      setEndDate(last);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const kpisRow = [
      { Metric: 'Vehicles Count', Value: report.kpis.vehicles_count },
      { Metric: 'Actual Revenue', Value: report.kpis.revenue },
      { Metric: 'Base Amount', Value: report.kpis.base_amount },
      { Metric: 'Extra Amount', Value: report.kpis.extra_amount },
      { Metric: 'Cash Collected', Value: report.kpis.collected },
      { Metric: 'Period Unpaid', Value: report.kpis.unpaid },
      { Metric: 'Customer Balances Due', Value: report.kpis.customer_balances_due },
      { Metric: 'Operating Expenses (excl. Salary)', Value: report.kpis.expenses },
      { Metric: 'Total Staff Payroll', Value: report.kpis.total_salary },
      { Metric: 'Net Profit', Value: report.kpis.net_profit },
      { Metric: 'Net Margin (%)', Value: `${(report.kpis.net_margin * 100).toFixed(1)}%` },
      { Metric: 'Cash Profit', Value: report.kpis.cash_profit },
      { Metric: 'Health Score', Value: `${report.health.score} (${report.health.status})` },
    ];
    exportToCSV(`Garage_Report_${startDate}_to_${endDate}`, kpisRow);
  };

  const handleExportXLSX = () => {
    if (!report) return;

    const sheets = [
      {
        name: 'KPIs',
        data: [
          { Metric: 'Vehicles Count', Value: report.kpis.vehicles_count },
          { Metric: 'Actual Revenue', Value: report.kpis.revenue },
          { Metric: 'Base Amount', Value: report.kpis.base_amount },
          { Metric: 'Extra Amount', Value: report.kpis.extra_amount },
          { Metric: 'Cash Collected', Value: report.kpis.collected },
          { Metric: 'Period Unpaid', Value: report.kpis.unpaid },
          { Metric: 'Customer Balances Due', Value: report.kpis.customer_balances_due },
          { Metric: 'Operating Expenses (excl. Salary)', Value: report.kpis.expenses },
          { Metric: 'Total Staff Payroll', Value: report.kpis.total_salary },
          { Metric: 'Net Profit', Value: report.kpis.net_profit },
          { Metric: 'Cash Profit', Value: report.kpis.cash_profit },
          { Metric: 'Health Score', Value: report.health.score },
        ],
      },
      {
        name: 'Staff Payroll',
        data: report.staff_payroll.map((s) => ({
          Staff: s.full_name,
          Role: s.role,
          Basis: s.pay_type,
          Jobs: s.jobs_count,
          Sales: s.jobs_sales,
          PresentDays: s.present_days,
          LeaveDays: s.leave_days,
          GrossSalary: s.gross_salary,
          Advances: s.advances,
          BalanceToPay: s.balance_to_pay,
        })),
      },
      {
        name: 'Expenses by Category',
        data: report.pnl_categories.map((c) => ({
          Category: c.category,
          Amount: c.amount,
          'Percent of Revenue': `${c.percent_of_revenue}%`,
          'Percent of Expenses': `${c.percent_of_expenses}%`,
        })),
      },
      {
        name: 'Sales by Work Type',
        data: report.sales_by_work_type.map((w) => ({
          'Work Type': w.work_type,
          Count: w.count,
          Total: w.total,
          'Percent of Revenue': `${w.percent}%`,
        })),
      },
      {
        name: 'Sales by Vehicle Type',
        data: report.sales_by_vehicle_type.map((v) => ({
          'Vehicle Type': v.vehicle_type,
          Count: v.count,
          Total: v.total,
          'Percent of Revenue': `${v.percent}%`,
        })),
      },
      {
        name: 'Unpaid Walk-ins',
        data: report.unpaid_vehicles.map((u) => ({
          Date: u.entry_date,
          Plate: u.plate,
          Mobile: u.mobile,
          Service: u.work_type,
          Total: u.total,
          Staff: u.staff_name,
        })),
      },
    ];

    exportToXLSX(`Garage_Full_Report_${startDate}_to_${endDate}`, sheets);
  };

  if (!canViewReports) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.reports.restricted}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Financial and payroll aggregate reports are confidential and available to Owner, Manager, Accountant, and Platform staff only.
        </p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-800">
        {errorMsg}
      </div>
    );
  }

  if (!report) return null;

  const kpis = report.kpis;
  const health = report.health;
  const comp = report.previous_comparison;

  const healthColor =
    health.status === 'healthy'
      ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20'
      : health.status === 'fair'
      ? 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20'
      : 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20';

  return (
    <div id="printable-report" className="max-w-7xl mx-auto px-4 py-6 space-y-6 printable-card">
      {/* Title & Presets Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t.reports.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.reports.subtitle}</p>
        </div>

        {/* Action Controls: Presets, Date Picker & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'today'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.reports.today}
            </button>
            <button
              onClick={() => handlePresetChange('this_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'this_month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.reports.thisMonth}
            </button>
            <button
              onClick={() => handlePresetChange('last_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'last_month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.reports.lastMonth}
            </button>
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 font-medium"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 font-medium"
            />
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportCSV}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition border border-slate-200 dark:border-slate-700"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handleExportXLSX}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition border border-slate-200 dark:border-slate-700"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">XLSX</span>
          </button>
          <button
            onClick={() =>
              printElement(
                'printable-report',
                `${session?.company?.name || 'Super Finish'} - Performance Report`
              )
            }
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print-only space-y-1 pb-4 border-b border-black">
        <h1 className="text-xl font-bold">Garage Financial & Performance Report</h1>
        <p className="text-xs">
          Period: {startDate} to {endDate}
        </p>
      </div>

      {/* KPI Cards Grid (12 Core Metrics: Revenue Breakdown, Clean OPEX, Payroll, Profits, Health) */}
      {!isSeniorStaff && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Vehicles Count */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{t.reports.kpis.vehicles}</span>
            <Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.vehicles_count}</div>
          <div className="text-[10px] text-slate-500 mt-1">Avg: {kpis.avg_per_vehicle.toFixed(2)} / job</div>
        </div>

        {/* 2. Actual Revenue */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white">Actual Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{kpis.revenue.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Total Completed Value</div>
        </div>

        {/* 3. Base Amount */}
        <div className="p-4 rounded-3xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-blue-700 dark:text-blue-400 flex items-center justify-between font-medium">
            <span>Base Amount</span>
            <Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-1">{(kpis.base_amount || 0).toFixed(2)}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Staff Commission Base</div>
        </div>

        {/* 4. Extra Amount */}
        <div className="p-4 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between font-medium">
            <span>Extra Polish/Addons</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">{(kpis.extra_amount || 0).toFixed(2)}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">100% Garage Revenue</div>
        </div>

        {/* 5. Cash Collected */}
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between font-medium">
            <span>{t.reports.kpis.collected}</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{kpis.collected.toFixed(2)}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-500/80 mt-1">Paid counter & settled</div>
        </div>

        {/* 6. Period Unpaid (Restored) */}
        <div className="p-4 rounded-3xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between font-medium">
            <span>Period Unpaid</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">{kpis.unpaid.toFixed(2)}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Unsettled in this period</div>
        </div>

        {/* 7. Customer Balances Due */}
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between font-medium">
            <span>Customer Debt Due</span>
            <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">{kpis.customer_balances_due.toFixed(2)}</div>
          <div className="text-[10px] text-rose-600 dark:text-rose-500/80 mt-1">Total Credit Debt</div>
        </div>

        {/* 8. Operating Expenses (OPEX - excluding staff salary) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Operating Expenses</span>
            <Receipt className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.expenses.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            Supplies & OPEX (Excl. Salary)
          </div>
        </div>

        {/* 9. Total Staff Payroll */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Total Staff Payroll</span>
            <Banknote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.total_salary.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Comm + Daily + Monthly</div>
        </div>

        {/* 10. Net Profit & Margin */}
        <div
          className={`p-4 rounded-3xl border shadow-sm dark:shadow-xl backdrop-blur-md ${
            kpis.net_profit >= 0
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700/50'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-700/50'
          }`}
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
            <span>{t.reports.kpis.netProfit}</span>
            <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-black mt-1 ${
              kpis.net_profit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {kpis.net_profit.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
            Margin: {(kpis.net_margin * 100).toFixed(1)}% (Rev - OPEX - Labor)
          </div>
        </div>

        {/* 11. Cash Profit */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{t.reports.kpis.cashProfit}</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{kpis.cash_profit.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Collected - OPEX - Payroll</div>
        </div>

        {/* 12. Health Score */}
        <div className={`p-4 rounded-3xl border shadow-sm dark:shadow-xl backdrop-blur-md ${healthColor}`}>
          <div className="text-xs font-semibold flex items-center justify-between">
            <span>Health Score</span>
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-3xl font-black mt-1">{health.score} / 100</div>
          <div className="text-[10px] uppercase font-bold tracking-wider mt-1">{health.status}</div>
        </div>
      </div>

      {/* Business Health Score & Diagnostic Warnings */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              {t.reports.health.scoreTitle} ({health.score}/100 -{' '}
              {health.status === 'healthy'
                ? t.reports.health.healthy
                : health.status === 'fair'
                ? t.reports.health.fair
                : t.reports.health.atRisk}
              )
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated 10-point financial diagnostic engine monitoring margins, labor overhead, receivables, and growth.
            </p>
          </div>
        </div>

        {health.warnings.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.reports.health.noWarnings}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {health.warnings.map((w, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs ${
                  w.level === 'red'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        w.level === 'red' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                      }`}
                    >
                      {w.level === 'red' ? 'CRITICAL ALERT' : 'WARNING'}
                    </span>
                    <strong className="text-sm font-bold text-slate-900 dark:text-white">{w.title}</strong>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{w.description}</p>
                </div>

                <div className="sm:max-w-xs shrink-0 p-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                    Recommended Action:
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{w.action}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Previous Period Comparison Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.reports.comparison.title}</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Comparing with previous period ({comp.prev_start_date} to {comp.prev_end_date})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">{t.reports.comparison.metric}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">{t.reports.comparison.current}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">{t.reports.comparison.previous}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">{t.reports.comparison.change}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              <tr>
                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">Revenue (AED)</td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold text-slate-900 dark:text-white">
                  {kpis.revenue.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left text-slate-500 dark:text-slate-400">
                  {comp.prev_revenue.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold">
                  <span
                    className={
                      comp.sales_growth_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {comp.sales_growth_pct >= 0 ? '+' : ''}
                    {comp.sales_growth_pct}%
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">Operating Expenses</td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold text-slate-900 dark:text-white">
                  {kpis.expenses.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left text-slate-500 dark:text-slate-400">
                  {comp.prev_expenses.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold">
                  <span
                    className={
                      comp.expense_growth_pct <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {comp.expense_growth_pct >= 0 ? '+' : ''}
                    {comp.expense_growth_pct}%
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">Total Staff Payroll</td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold text-slate-900 dark:text-white">
                  {kpis.total_salary.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left text-slate-500 dark:text-slate-400">
                  {comp.prev_salary.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-medium text-slate-700 dark:text-slate-300">
                  {comp.prev_salary > 0
                    ? `${(((kpis.total_salary - comp.prev_salary) / comp.prev_salary) * 100).toFixed(1)}%`
                    : '-'}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">Net Profit</td>
                <td
                  className={`py-2.5 px-4 text-right rtl:text-left font-bold ${
                    kpis.net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {kpis.net_profit.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left text-slate-500 dark:text-slate-400">
                  {comp.prev_net_profit.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold">
                  {comp.prev_net_profit !== 0 ? (
                    <span
                      className={
                        kpis.net_profit >= comp.prev_net_profit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {(kpis.net_profit - comp.prev_net_profit).toFixed(2)} AED
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">Vehicles Serviced</td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-bold text-slate-900 dark:text-white">
                  {kpis.vehicles_count}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left text-slate-500 dark:text-slate-400">
                  {comp.prev_vehicles_count}
                </td>
                <td className="py-2.5 px-4 text-right rtl:text-left font-medium text-slate-700 dark:text-slate-300">
                  {comp.prev_vehicles_count > 0
                    ? `${(((kpis.vehicles_count - comp.prev_vehicles_count) / comp.prev_vehicles_count) * 100).toFixed(1)}%`
                    : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue vs Expenses Line/Bar Chart (Full width on lg) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.reports.charts.dailyTitle}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Revenue vs. Daily Costs (OPEX + Staff Payroll)</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.daily_chart}>
                <XAxis dataKey="date" stroke={theme === 'dark' ? '#64748b' : '#94a3b8'} fontSize={11} />
                <YAxis stroke={theme === 'dark' ? '#64748b' : '#94a3b8'} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                    borderRadius: '0.75rem',
                    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses (OPEX + Salary)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Work Type (Donut Chart: Washing, Painting, Detailing, etc.) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.reports.charts.workTypeTitle}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Services</span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {report.sales_by_work_type.length === 0 ? (
              <div className="text-slate-400 text-xs">No service data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.sales_by_work_type}
                    dataKey="total"
                    nameKey="work_type"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {report.sales_by_work_type.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                      borderRadius: '0.75rem',
                      color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sales by Vehicle Type (Donut Chart: Sedan, SUV, Bike, Truck, etc.) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.reports.charts.vehicleTypeTitle}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Vehicle Categories</span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {report.sales_by_vehicle_type.length === 0 ? (
              <div className="text-slate-400 text-xs">No vehicle data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.sales_by_vehicle_type}
                    dataKey="total"
                    nameKey="vehicle_type"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {report.sales_by_vehicle_type.map((_, idx) => (
                      <Cell key={idx} fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                      borderRadius: '0.75rem',
                      color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Staff Performance & Payroll Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.reports.staffPayroll.title}</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Commission on base price only (extra excluded) · Daily / Performance wages · Advances deducted
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">{t.reports.staffPayroll.name}</th>
                <th className="py-2.5 px-4">{t.reports.staffPayroll.basis}</th>
                <th className="py-2.5 px-4 text-center">{t.reports.staffPayroll.jobs}</th>
                <th className="py-2.5 px-4 text-center">{t.reports.staffPayroll.days}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">{t.reports.staffPayroll.gross}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">{t.reports.staffPayroll.advances}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left text-blue-600 dark:text-blue-400">Paid Salary</th>
                <th className="py-2.5 px-4 text-right rtl:text-left font-black">{t.reports.staffPayroll.balance}</th>
                <th className="py-2.5 px-4 text-right rtl:text-left">Payout Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {report.staff_payroll.map((s) => (
                <tr key={s.staff_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    <div>{s.full_name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{s.role}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    <span className="capitalize">{s.pay_type}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      ({s.pay_type === 'commission'
                        ? `${s.pay_rate}% of Base`
                        : s.pay_type === 'daily' && Number(s.pay_rate) === 0
                        ? 'Custom (Evening Decided)'
                        : s.pay_type === 'daily'
                        ? `${s.pay_rate} ${currency}/day`
                        : `${s.pay_rate} ${currency}/mo`})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                    {s.jobs_count}{' '}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">
                      ({s.jobs_sales.toFixed(2)} {currency} Base)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.present_days}P</span> /{' '}
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{s.leave_days}L</span>
                  </td>
                  <td className="py-3 px-4 text-right rtl:text-left font-bold text-slate-800 dark:text-slate-200">
                    {s.gross_salary.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right rtl:text-left text-amber-600 dark:text-amber-400 font-medium">
                    {s.advances > 0 ? `-${s.advances.toFixed(2)}` : '0.00'}
                  </td>
                  <td className="py-3 px-4 text-right rtl:text-left font-bold text-blue-600 dark:text-blue-400">
                    {s.paid_salary > 0 ? `-${s.paid_salary.toFixed(2)}` : '0.00'}
                  </td>
                  <td className="py-3 px-4 text-right rtl:text-left font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {s.balance_to_pay.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right rtl:text-left">
                    {s.balance_to_pay > 0 ? (
                      <button
                        onClick={() => openPayModal(s)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition shrink-0 ml-auto"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Salary</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Fully Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Salary & Wage Modal */}
      {payingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Salary Payout</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payingStaff.full_name} ({payingStaff.pay_type})</p>
                </div>
              </div>
              <button
                onClick={() => setPayingStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payout Breakdown Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Period Gross Earned:</span>
                <span className="font-bold text-slate-900 dark:text-white">{payingStaff.gross_salary.toFixed(2)} AED</span>
              </div>
              {payingStaff.advances > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Less Advances Taken:</span>
                  <span className="font-semibold">-{payingStaff.advances.toFixed(2)} AED</span>
                </div>
              )}
              {payingStaff.paid_salary > 0 && (
                <div className="flex justify-between text-blue-600 dark:text-blue-400">
                  <span>Less Already Paid:</span>
                  <span className="font-semibold">-{payingStaff.paid_salary.toFixed(2)} AED</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-black text-sm text-emerald-600 dark:text-emerald-400">
                <span>Outstanding Balance:</span>
                <span>{payingStaff.balance_to_pay.toFixed(2)} AED</span>
              </div>
            </div>

            <form onSubmit={handleRecordSalary} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Amount (AED)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payout Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">💵 Cash in Hand</option>
                    <option value="bank">🏦 Bank / Card Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Note / Reference (Optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Monthly salary payout, Daily cash payout"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingStaff(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
