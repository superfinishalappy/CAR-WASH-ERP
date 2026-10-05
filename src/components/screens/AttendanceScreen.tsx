'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Profile, Attendance } from '@/types/database';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  User,
  Users,
  BarChart3,
  Layers,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getTodayString,
  getLocalDateString,
  getFirstDayOfMonthString,
} from '@/lib/date-utils';
import { exportToCSV } from '@/lib/export';

type AttendanceViewTab = 'daily' | 'period';

export function AttendanceScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh } = useApp();

  const currency = session?.company?.currency || 'AED';
  const todayStr = getTodayString(session?.company?.timezone);

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<AttendanceViewTab>('daily');

  // 1. Daily Roll-Call State
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dailyRates, setDailyRates] = useState<Record<string, number>>({});

  // 2. Period / Monthly State
  const [periodPreset, setPeriodPreset] = useState<
    'this_month' | 'last_month' | 'last_30_days' | 'last_7_days' | 'custom'
  >('this_month');
  const [startDate, setStartDate] = useState(() => getFirstDayOfMonthString(todayStr, session?.company?.timezone));
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'leave' | 'not_marked'>('all');

  // Staff and Data
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff'].includes(role);
  const canMarkDate = isOwner || selectedDate === todayStr;

  useEffect(() => {
    const s = dataProvider.getCompanyProfiles().filter((p) => p.active);
    setStaffList(s);

    const att = dataProvider.getAttendance(selectedDate);
    setAttendanceRecords(att);
  }, [selectedDate, dataVersion]);

  // Stepper helper for daily roll-call date
  const handleStepDay = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + delta);
    setSelectedDate(getLocalDateString(dateObj, session?.company?.timezone));
  };

  // Period Presets Handler
  const handleApplyPreset = (preset: 'this_month' | 'last_month' | 'last_30_days' | 'last_7_days') => {
    const now = new Date();
    if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getLocalDateString(firstDay, session?.company?.timezone));
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(getLocalDateString(firstDayLastMonth, session?.company?.timezone));
      setEndDate(getLocalDateString(lastDayLastMonth, session?.company?.timezone));
    } else if (preset === 'last_7_days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(getLocalDateString(d, session?.company?.timezone));
      setEndDate(todayStr);
    } else if (preset === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setStartDate(getLocalDateString(d, session?.company?.timezone));
      setEndDate(todayStr);
    }
    setPeriodPreset(preset);
  };

  // Mark single staff attendance
  const handleMark = (staffId: string, status: 'present' | 'leave') => {
    if (!canMarkDate) {
      showToast('Attendance for past dates can only be updated by the Owner.', 'error');
      return;
    }

    const staff = staffList.find((s) => s.id === staffId);
    const customRate =
      dailyRates[staffId] !== undefined
        ? dailyRates[staffId]
        : staff?.pay_type === 'daily'
        ? staff.pay_rate
        : undefined;

    const res = dataProvider.markAttendance(staffId, selectedDate, status, customRate);
    if (res.success) {
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update attendance', 'error');
    }
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    if (!canMarkDate) {
      showToast('Attendance for past dates can only be updated by the Owner.', 'error');
      return;
    }

    const res = dataProvider.markAllPresent(selectedDate);
    if (res.success) {
      showToast('All active staff marked as Present!', 'success');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to mark all present', 'error');
    }
  };

  const getStaffStatus = (staffId: string): 'present' | 'leave' | 'not_marked' => {
    const rec = attendanceRecords.find((a) => a.staff_id === staffId);
    if (!rec) return 'not_marked';
    return rec.status;
  };

  const getStaffRecord = (staffId: string): Attendance | undefined => {
    return attendanceRecords.find((a) => a.staff_id === staffId);
  };

  const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
  const leaveCount = attendanceRecords.filter((a) => a.status === 'leave').length;
  const notMarkedCount = Math.max(0, staffList.length - presentCount - leaveCount);

  // Period Data Calculation
  const periodStaffSummaries = useMemo(() => {
    if (activeTab !== 'period') return [];
    return dataProvider.getStaffAttendanceSummary(startDate, endDate, selectedStaffId);
  }, [activeTab, startDate, endDate, selectedStaffId, dataVersion]);

  // Aggregate KPI stats across the selected period
  const periodKPIs = useMemo(() => {
    if (periodStaffSummaries.length === 0) {
      return { totalDays: 0, totalPresent: 0, totalLeave: 0, overallRate: 0, totalWages: 0 };
    }
    const totalDays = periodStaffSummaries[0]?.totalDays || 0;
    const totalPresent = periodStaffSummaries.reduce((sum, s) => sum + s.presentDays, 0);
    const totalLeave = periodStaffSummaries.reduce((sum, s) => sum + s.leaveDays, 0);
    const totalPossible = totalDays * periodStaffSummaries.length;
    const overallRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
    const totalWages = periodStaffSummaries.reduce((sum, s) => sum + s.totalDailyWage, 0);

    return { totalDays, totalPresent, totalLeave, overallRate, totalWages };
  }, [periodStaffSummaries]);

  // Chronological day-by-day rows for period
  const periodDetailedRows = useMemo(() => {
    if (activeTab !== 'period') return [];
    const raw = dataProvider.getAttendanceRange(startDate, endDate, selectedStaffId);
    if (statusFilter === 'all') return raw;
    return raw.filter((r) => r.status === statusFilter);
  }, [activeTab, startDate, endDate, selectedStaffId, statusFilter, dataVersion]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (periodStaffSummaries.length === 0) {
      showToast('No attendance records available to export for this period.', 'error');
      return;
    }

    const rows: Record<string, any>[] = [];

    if (selectedStaffId === 'all') {
      periodStaffSummaries.forEach((s) => {
        rows.push({
          'Staff Name': s.full_name,
          Username: `@${s.username}`,
          Role: s.role,
          'Pay Basis': s.pay_type,
          'Base Rate': s.pay_rate,
          'Period Start': startDate,
          'Period End': endDate,
          'Total Days': s.totalDays,
          'Present Days': s.presentDays,
          'Leave Days': s.leaveDays,
          'Unmarked Days': s.unmarkedDays,
          'Attendance Rate': `${s.attendanceRate}%`,
          'Total Earned Daily Wages': s.pay_type === 'daily' ? s.totalDailyWage : 'N/A',
        });
      });
    } else {
      const staffObj = staffList.find((p) => p.id === selectedStaffId);
      periodDetailedRows.forEach((r) => {
        rows.push({
          Date: r.entry_date,
          'Staff Name': staffObj?.full_name || r.staff_name || 'Staff',
          Status: r.status.toUpperCase(),
          'Daily Wage':
            r.daily_rate !== undefined
              ? r.daily_rate
              : staffObj?.pay_type === 'daily'
              ? staffObj.pay_rate
              : '',
        });
      });
    }

    exportToCSV(`Attendance_${startDate}_to_${endDate}`, rows);
    showToast('Attendance report exported to CSV successfully!', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Main Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
            {t.attendance.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Track daily attendance, monthly staff summaries, and variable daily wages.
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-inner self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'daily'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Roll-Call</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('period')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'period'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Monthly & Period History</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ROLL-CALL                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Date Selector & Day Navigation */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedDate === todayStr
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t.vehicles.today}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleStepDay(1)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {!canMarkDate && (
                <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/40">
                  Read-only past date (Owner edit only)
                </span>
              )}

              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={!canMarkDate}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/30 shrink-0 disabled:opacity-50 active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                {t.attendance.markAllPresent}
              </button>
            </div>
          </div>

          {/* Daily Wage Dynamic Pricing Explainer */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                <strong>Variable Daily Salary Support:</strong> Daily workers receive their agreed wage for every Present day. If a worker gets <strong>40 today, 42 tomorrow, or 50 on weekends</strong>, adjust the "Day Wage" input beside their name before marking Present. It preserves historical payroll accurately!
              </span>
            </div>
          </div>

          {/* Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Active Staff</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{staffList.length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-center shadow-sm">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">{t.attendance.present}</div>
              <div className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-0.5">{presentCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-center shadow-sm">
              <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">{t.attendance.leave}</div>
              <div className="text-xl font-black text-rose-800 dark:text-rose-300 mt-0.5">{leaveCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-center shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Not Marked</div>
              <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">{notMarkedCount}</div>
            </div>
          </div>

          {/* Staff Roster List */}
          <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Staff Roster for {selectedDate}
              </h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {presentCount} Present · {leaveCount} Leave
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {staffList.map((staff) => {
                const status = getStaffStatus(staff.id);
                const rec = getStaffRecord(staff.id);
                const isDaily = staff.pay_type === 'daily';
                const currentRate =
                  dailyRates[staff.id] !== undefined
                    ? dailyRates[staff.id]
                    : rec?.daily_rate !== undefined
                    ? rec.daily_rate
                    : staff.pay_rate;

                return (
                  <div
                    key={staff.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div>
                      <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{staff.full_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {staff.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="capitalize font-mono text-blue-600 dark:text-blue-400">@{staff.username}</span>
                        <span>·</span>
                        <span className="capitalize text-slate-700 dark:text-slate-300">
                          {staff.pay_type === 'daily'
                            ? `Daily Base: ${staff.pay_rate} ${currency}/day`
                            : staff.pay_type === 'commission'
                            ? `Commission: ${staff.pay_rate}% of Base Price`
                            : staff.pay_type === 'monthly'
                            ? `Monthly: ${staff.pay_rate} ${currency}`
                            : 'No salary basis'}
                        </span>
                      </div>
                    </div>

                    {/* Actions & Day Wage Override */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Daily Wage input if daily worker */}
                      {isDaily && (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Day Wage:</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            disabled={!canMarkDate}
                            value={currentRate}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDailyRates((prev) => ({ ...prev, [staff.id]: val }));
                            }}
                            className="w-16 px-2 py-0.5 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono focus:ring-1 focus:ring-blue-500"
                            title="Adjust rate for this specific day (e.g. 40, 42, 50)"
                          />
                          <span className="text-[10px] font-bold text-slate-400">{currency}</span>
                        </div>
                      )}

                      {/* Present / Leave Toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMark(staff.id, 'present')}
                          disabled={!canMarkDate}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                            status === 'present'
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.attendance.present}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMark(staff.id, 'leave')}
                          disabled={!canMarkDate}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                            status === 'leave'
                              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>{t.attendance.leave}</span>
                        </button>

                        {status === 'not_marked' && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-transparent">
                            {t.attendance.notMarked}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY & CUSTOM PERIOD ATTENDANCE                                 */}
      {/* ========================================================================= */}
      {activeTab === 'period' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Period Filter Bar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Period:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('this_month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    periodPreset === 'this_month'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('last_month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    periodPreset === 'last_month'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('last_30_days')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    periodPreset === 'last_30_days'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('last_7_days')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    periodPreset === 'last_7_days'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Last 7 Days
                </button>
              </div>

              {/* Export to CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Date Pickers & Staff Select */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Filter by Staff Member
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Active Staff ({staffList.length})</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} (@{s.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Period Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">Days in Period</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {periodKPIs.totalDays}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                {startDate} to {endDate}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 shadow-sm text-center">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Total Days Present</div>
              <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
                {periodKPIs.totalPresent}
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                Attendance: {periodKPIs.overallRate}%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 shadow-sm text-center">
              <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Total Days Leave</div>
              <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">
                {periodKPIs.totalLeave}
              </div>
              <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                Approved & recorded
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 shadow-sm text-center">
              <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Daily Wages in Period</div>
              <div className="text-2xl font-black text-blue-800 dark:text-blue-300 mt-1 font-mono">
                {periodKPIs.totalWages.toFixed(2)}
              </div>
              <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                {currency} earned
              </div>
            </div>
          </div>

          {/* Table 1: Staff Period Attendance Summary Table (Shown when All Staff or Single Staff) */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Staff Attendance Summary ({startDate} to {endDate})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregated present days, leave count, and earned daily wages for this period.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Pay Basis</th>
                    <th className="py-3 px-4 text-center">Period Days</th>
                    <th className="py-3 px-4 text-center">Present</th>
                    <th className="py-3 px-4 text-center">Leave</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-right">Daily Wages ({currency})</th>
                    <th className="py-3 px-4 text-right">Drilldown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodStaffSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No staff attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    periodStaffSummaries.map((s) => (
                      <tr key={s.staff_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{s.full_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">@{s.username} · {s.role}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                            {s.pay_type === 'daily'
                              ? `Daily (${s.pay_rate} ${currency}/day)`
                              : s.pay_type === 'commission'
                              ? `Commission (${s.pay_rate}%)`
                              : s.pay_type === 'monthly'
                              ? `Monthly (${s.pay_rate} ${currency})`
                              : 'None'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                          {s.totalDays}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {s.presentDays}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                          {s.leaveDays}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  s.attendanceRate >= 85
                                    ? 'bg-emerald-500'
                                    : s.attendanceRate >= 65
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, s.attendanceRate)}%` }}
                              />
                            </div>
                            <span className="font-bold font-mono text-[11px] text-slate-800 dark:text-slate-200">
                              {s.attendanceRate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {s.pay_type === 'daily' ? s.totalDailyWage.toFixed(2) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStaffId(s.staff_id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold transition"
                          >
                            View Log
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Detailed Day-by-Day Historical Log Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Day-by-Day Attendance Log ({periodDetailedRows.length} entries)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological entries with recorded daily wage and status.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present Only</option>
                  <option value="leave">Leave Only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Daily Wage ({currency})</th>
                    {isOwner && <th className="py-2.5 px-4 text-right">Update</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodDetailedRows.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 5 : 4} className="py-8 text-center text-slate-400">
                        No day-by-day attendance records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    periodDetailedRows.map((r) => {
                      const staffObj = staffList.find((p) => p.id === r.staff_id);
                      const isDaily = staffObj?.pay_type === 'daily';
                      const wage = r.daily_rate !== undefined ? r.daily_rate : (isDaily ? staffObj?.pay_rate : undefined);

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {r.entry_date}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {staffObj?.full_name || r.staff_name || 'Staff'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                r.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800/50'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {wage !== undefined ? wage.toFixed(2) : '-'}
                          </td>
                          {isOwner && (
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextStatus = r.status === 'present' ? 'leave' : 'present';
                                  dataProvider.markAttendance(r.staff_id, r.entry_date, nextStatus, r.daily_rate);
                                  triggerRefresh();
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                              >
                                Toggle Status
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
