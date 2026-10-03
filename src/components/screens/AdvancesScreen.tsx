'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
import { getTodayString } from '@/lib/date-utils';

export function AdvancesScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency } = useApp();

  const todayStr = getTodayString(session?.company?.timezone);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Form State
  const [staffId, setStaffId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff'].includes(role);
  const canDeleteRole = isOwner || ['manager', 'accountant'].includes(role);

  useEffect(() => {
    const list = dataProvider.getAdvances();
    setAdvances(list);

    const s = dataProvider.getCompanyProfiles().filter((p) => p.active);
    setStaffList(s);
    if (!staffId && s.length > 0) setStaffId(s[0].id);
  }, [dataVersion]);

  const paginatedAdvances = advances.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

    const res = dataProvider.addAdvance({
      entry_date: selectedDate,
      staff_id: staffId,
      amount: Number(amount),
      note,
    });

    if (res.success) {
      showToast('Staff advance recorded successfully!', 'success');
      setAmount('');
      setNote('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to record advance', 'error');
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

  const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);

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
          Advances reduce the staff member's balance to pay at the end of the month, but do not reduce company net profit.
        </span>
      </div>

      {/* Add Advance Form */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" />
          {t.advances.giveAdvance}
        </h2>

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
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.advances.amount}</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-bold text-amber-600 dark:text-amber-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500"
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
              placeholder="e.g. Mid-month family support"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="sm:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canAddSelectedDate}
              className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition disabled:opacity-50"
            >
              {t.advances.saveAdvance}
            </button>
          </div>
        </form>
      </div>

      {/* Advances Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900 dark:text-white">Disbursed Advances ({advances.length})</div>
          <div className="text-sm font-black text-amber-600 dark:text-amber-400">
            {t.advances.totalAdvances}: {totalAdvance.toFixed(2)} {currency}
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
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{adv.note || '-'}</td>
                        <td className="py-3 px-4 text-right rtl:text-left font-black text-amber-600 dark:text-amber-400 text-sm">
                          {adv.amount.toFixed(2)}
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
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{adv.note || 'Advance payment'}</p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">
                          {adv.amount.toFixed(2)}
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
