'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Advance, Profile } from '@/types/database';
import {
  Banknote,
  Plus,
  Calendar,
  Trash2,
  DollarSign,
  User,
  Info,
  Clock,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
import { getTodayString, getFirstDayOfMonthString } from '@/lib/date-utils';

export function AdvancesScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency } = useApp();

  const todayStr = getTodayString(session?.company?.timezone);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Filter States
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_month' | 'all' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [staffFilter, setStaffFilter] = useState('all');

  // Form State
  const [entryType, setEntryType] = useState<'advance' | 'repayment'>('advance');
  const [staffId, setStaffId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Net advance balance for currently selected staff member
  const selectedStaffNetAdvance = useMemo(() => {
    if (!staffId) return 0;
    return advances
      .filter((a) => a.staff_id === staffId)
      .reduce((sum, a) => {
        const isRepay = (a.note || '').includes('[REPAYMENT]');
        return isRepay ? sum - a.amount : sum + a.amount;
      }, 0);
  }, [advances, staffId]);

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff', 'senior_staff'].includes(role);
  const canDeleteRole = isOwner || ['manager', 'accountant'].includes(role);

  useEffect(() => {
    const list = dataProvider.getAdvances();
    setAdvances(list);

    const s = dataProvider.getCompanyProfiles().filter((p) => p.active);
    setStaffList(s);
    if (!staffId && s.length > 0) setStaffId(s[0].id);
  }, [dataVersion]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, customStartDate, customEndDate, staffFilter]);

  const getDateRange = () => {
    const tz = session?.company?.timezone;
    if (datePreset === 'today') return { start: todayStr, end: todayStr };
    if (datePreset === 'yesterday') {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'Asia/Dubai' }));
      d.setDate(d.getDate() - 1);
      const yStr = d.toISOString().split('T')[0];
      return { start: yStr, end: yStr };
    }
    if (datePreset === 'this_month') {
      return { start: getFirstDayOfMonthString(undefined, tz), end: todayStr };
    }
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    return null; // All time
  };

  const filteredAdvances = useMemo(() => {
    const dateRange = getDateRange();
    return advances.filter((a) => {
      if (staffFilter !== 'all' && a.staff_id !== staffFilter) return false;
      if (dateRange) {
        if (a.entry_date < dateRange.start || a.entry_date > dateRange.end) return false;
      }
      return true;
    });
  }, [advances, datePreset, customStartDate, customEndDate, staffFilter, session]);

  const paginatedAdvances = filteredAdvances.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canAddSelectedDate = isOwner || selectedDate === todayStr;

  const handleAddAdvance = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddSelectedDate) {
      showToast('Advances can only be recorded for today.', 'error');
      return;
    }

    if (!staffId || !amount) {
      showToast('Please select staff member and enter amount', 'warning');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount greater than 0', 'warning');
      return;
    }

    const isRepay = entryType === 'repayment';
    const finalNote = note.trim() || (isRepay ? 'Staff returned advance cash' : '');

    const res = dataProvider.addAdvance({
      entry_date: selectedDate,
      staff_id: staffId,
      amount: numAmount,
      note: finalNote,
      is_repayment: isRepay,
    });

    if (res.success) {
      showToast(
        isRepay
          ? 'Advance repayment collected & recorded successfully!'
          : 'Staff advance recorded successfully!',
        'success'
      );
      setAmount('');
      setNote('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to record entry', 'error');
    }
  };

  const handleDeleteAdvance = (adv: Advance) => {
    const isSameDay = adv.entry_date === todayStr;
    const canDelete = isOwner || (canDeleteRole && isSameDay);

    if (!canDelete) {
      showToast('You do not have permission to delete this advance record.', 'error');
      return;
    }

    const res = dataProvider.deleteAdvance(adv.id);
    if (res.success) {
      showToast('Advance deleted', 'info');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to delete advance', 'error');
    }
  };

  const totalDisbursed = filteredAdvances.filter((a) => !(a.note || "").includes("[REPAYMENT]")).reduce((sum, a) => sum + a.amount, 0);
  const totalRepaid = filteredAdvances.filter((a) => (a.note || "").includes("[REPAYMENT]")).reduce((sum, a) => sum + a.amount, 0);
  const netAdvance = totalDisbursed - totalRepaid;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-amber-500" />
            {t.advances.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.advances.subtitle}</p>
        </div>
      </div>

      {/* Advance Policy Explainer */}
      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
        <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          Advances reduce staff payable salary in payroll reports. Repayments recorded when staff returns cash restore their balance and recover cash to the company.
        </span>
      </div>

      {/* Add Advance Form */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEntryType('advance')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                entryType === 'advance'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Give Advance
            </button>
            <button
              type="button"
              onClick={() => setEntryType('repayment')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                entryType === 'repayment'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Collect Repayment (Cash Return)
            </button>
          </div>

          {staffId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Current Outstanding:</span>
              <span className={`font-black font-mono px-2.5 py-1 rounded-xl border text-xs ${
                selectedStaffNetAdvance > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                  : selectedStaffNetAdvance < 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
              }`}>
                {selectedStaffNetAdvance.toFixed(2)} {currency}
              </span>
              {entryType === 'repayment' && selectedStaffNetAdvance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(selectedStaffNetAdvance.toString())}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 font-bold text-[11px] transition"
                  title="Auto-fill the full remaining advance"
                >
                  Fill Full
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleAddAdvance} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Staff Member */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.advances.staff}</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500"
              required
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.pay_type})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{entryType === 'repayment' ? 'Repayment Amount' : t.advances.amount}</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                step="any"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-bold focus:bg-white dark:focus:bg-slate-950 focus:ring-2 ${
                  entryType === 'repayment'
                    ? 'text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500'
                    : 'text-amber-600 dark:text-amber-400 focus:ring-amber-500'
                }`}
                required
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.common.date}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.advances.note}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={entryType === 'repayment' ? 'e.g. Returned advance in cash' : 'e.g. Mid-month family support'}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="sm:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canAddSelectedDate}
              className={`py-2.5 px-6 rounded-xl text-white font-bold text-xs shadow-lg transition disabled:opacity-50 flex items-center gap-1.5 ${
                entryType === 'repayment'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              }`}
            >
              {entryType === 'repayment' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record Repayment / Cash Return
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t.advances.saveAdvance}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Date Preset
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {datePreset === 'custom' && (
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Custom Range</label>
              <div className="flex items-center gap-2">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs" />
                <span className="text-slate-400">to</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs" />
              </div>
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Staff Filter
            </label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Advances Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-bold text-sm text-slate-900 dark:text-white">Advance Records ({filteredAdvances.length})</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="text-slate-600 dark:text-slate-400">
              Disbursed: <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">+{totalDisbursed.toFixed(2)}</span>
            </div>
            {totalRepaid > 0 && (
              <div className="text-slate-600 dark:text-slate-400">
                Repaid: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">-{totalRepaid.toFixed(2)}</span>
              </div>
            )}
            <div className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white font-mono">
              Net Outstanding: {netAdvance.toFixed(2)} {currency}
            </div>
          </div>
        </div>

        {advances.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No salary advances issued.
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{t.common.date}</th>
                    <th className="py-3 px-4">{t.advances.staff}</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">{t.advances.note}</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.advances.amount} ({currency})</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedAdvances.map((adv) => {
                    const isSameDay = adv.entry_date === todayStr;
                    const canDelete = isOwner || (canDeleteRole && isSameDay);

                    return (
                      <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{adv.entry_date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{adv.staff_name}</td>
                        <td className="py-3 px-4">
                          {(adv.note || '').includes('[REPAYMENT]') ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                              Repaid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3 text-amber-600" />
                              Advance
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {adv.note ? adv.note.replace('[REPAYMENT]', '').trim() || '-' : '-'}
                        </td>
                        <td className={`py-3 px-4 text-right rtl:text-left font-black text-sm font-mono ${
                          (adv.note || '').includes('[REPAYMENT]') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {(adv.note || '').includes('[REPAYMENT]') ? `-${adv.amount.toFixed(2)}` : `+${adv.amount.toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 text-right rtl:text-left">
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteAdvance(adv)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                              title="Delete advance"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="md:hidden p-3 space-y-3">
              {paginatedAdvances.map((adv) => {
                const isSameDay = adv.entry_date === todayStr;
                const canDelete = isOwner || (canDeleteRole && isSameDay);

                return (
                  <div
                    key={adv.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {adv.staff_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {adv.entry_date}
                        </span>
                        {(adv.note || '').includes('[REPAYMENT]') ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Repaid
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            Advance
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {adv.note ? adv.note.replace('[REPAYMENT]', '').trim() || ((adv.note || '').includes('[REPAYMENT]') ? 'Repayment' : 'Advance payment') : ((adv.note || '').includes('[REPAYMENT]') ? 'Repayment' : 'Advance payment')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className={`text-base font-black font-mono ${
                          (adv.note || '').includes('[REPAYMENT]') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {(adv.note || '').includes('[REPAYMENT]') ? `-${adv.amount.toFixed(2)}` : `+${adv.amount.toFixed(2)}`}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-bold">{currency}</span>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAdvance(adv)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                          title="Delete advance"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 50-Items-per-Page Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={advances.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="advances"
        />
      </div>
    </div>
  );
}
