'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { getTodayString } from '@/lib/date-utils';

export function AttendanceScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh } = useApp();

  const currency = session?.company?.currency || 'AED';
  const todayStr = getTodayString(session?.company?.timezone);
  const [selectedDate, setSelectedDate] = useState(todayStr);

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

  const handleMark = (staffId: string, status: 'present' | 'leave') => {
    if (!canMarkDate) {
      showToast('Attendance for past dates can only be updated by the Owner.', 'error');
      return;
    }

    const res = dataProvider.markAttendance(staffId, selectedDate, status);
    if (res.success) {
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update attendance', 'error');
    }
  };

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

  const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
  const leaveCount = attendanceRecords.filter((a) => a.status === 'leave').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
            {t.attendance.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.attendance.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedDate === todayStr
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {t.vehicles.today}
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Daily Salary Explainer Card */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>Daily Salary Rule:</strong> Staff on daily pay receive their daily rate for every day marked <strong>Present</strong>, even if 0 vehicles were serviced that day. Leave days are unpaid.
          </span>
        </div>

        <button
          onClick={handleMarkAllPresent}
          disabled={!canMarkDate}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/30 shrink-0 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-emerald-200" />
          {t.attendance.markAllPresent}
        </button>
      </div>

      {/* Summary Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Staff</div>
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
      </div>

      {/* Staff Attendance Roster List */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
            {t.attendance.todayAttendance} ({selectedDate})
          </h2>
          {!canMarkDate && (
            <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
              Read-only past date (Owner edit only)
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
          {staffList.map((staff) => {
            const status = getStaffStatus(staff.id);

            return (
              <div
                key={staff.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              >
                <div>
                  <div className="font-bold text-base text-slate-900 dark:text-white">{staff.full_name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                    <span className="capitalize font-mono text-blue-600 dark:text-blue-400">@{staff.username}</span>
                    <span>·</span>
                    <span className="capitalize text-slate-700 dark:text-slate-300">
                      {staff.pay_type === 'daily'
                        ? `Daily (${staff.pay_rate} ${currency}/day)`
                        : staff.pay_type === 'commission'
                        ? `Commission (${staff.pay_rate}%)`
                        : staff.pay_type === 'monthly'
                        ? `Monthly (${staff.pay_rate} ${currency})`
                        : 'No salary basis'}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleMark(staff.id, 'present')}
                    disabled={!canMarkDate}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      status === 'present'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t.attendance.present}
                  </button>

                  <button
                    onClick={() => handleMark(staff.id, 'leave')}
                    disabled={!canMarkDate}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      status === 'leave'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    {t.attendance.leave}
                  </button>

                  {status === 'not_marked' && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-transparent">
                      {t.attendance.notMarked}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
