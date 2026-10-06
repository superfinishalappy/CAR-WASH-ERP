'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Expense } from '@/types/database';
import {
  Receipt,
  Plus,
  Calendar,
  Trash2,
  DollarSign,
  Tag,
  FileText,
  Clock,
  Filter,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
import { getTodayString, getFirstDayOfMonthString } from '@/lib/date-utils';

export function ExpensesScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency } = useApp();

  const todayStr = getTodayString(session?.company?.timezone);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Filter States
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_month' | 'all' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form State
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // Delete Confirmation State
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff'].includes(role);
  const canDeleteRole = isOwner || ['manager', 'accountant'].includes(role);

  useEffect(() => {
    // Get ALL expenses, no longer constrained to selectedDate for the view
    const list = dataProvider.getExpenses();
    setExpenses(list);

    const s = dataProvider.getSettings();
    setCategories(s.expense_categories);
    if (!category && s.expense_categories.length > 0) {
      setCategory(s.expense_categories[0]);
    }
  }, [dataVersion]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, customStartDate, customEndDate, categoryFilter]);

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

  const filteredExpenses = useMemo(() => {
    const dateRange = getDateRange();
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (dateRange) {
        if (e.entry_date < dateRange.start || e.entry_date > dateRange.end) return false;
      }
      return true;
    });
  }, [expenses, datePreset, customStartDate, customEndDate, categoryFilter, session]);

  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canAddSelectedDate = isOwner || selectedDate === todayStr;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddSelectedDate) {
      showToast('Non-owners can only add expenses for today.', 'error');
      return;
    }

    if (!category || !amount) {
      showToast('Please select category and enter amount', 'warning');
      return;
    }

    const res = dataProvider.addExpense({
      entry_date: selectedDate,
      category,
      description,
      amount: Number(amount),
    });

    if (res.success) {
      showToast('Expense recorded successfully!', 'success');
      setDescription('');
      setAmount('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to record expense', 'error');
    }
  };

  const handleDeleteExpense = (exp: Expense) => {
    const isSameDay = exp.entry_date === todayStr;
    const canDelete = isOwner || (canDeleteRole && isSameDay);

    if (!canDelete) {
      showToast('You do not have permission to delete this expense.', 'error');
      return;
    }

    setDeletingExpense(exp);
  };

  const confirmDeleteExpense = () => {
    if (!deletingExpense) return;
    const res = dataProvider.deleteExpense(deletingExpense.id);
    if (res.success) {
      showToast('Expense deleted', 'info');
      setDeletingExpense(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to delete expense', 'error');
    }
  };

  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t.expenses.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.expenses.subtitle}</p>
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
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Add Expense Form Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t.expenses.addExpense} ({selectedDate})
        </h2>

        <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.expenses.category}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
              required
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.expenses.amount}</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                step="any"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.expenses.description}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Microfiber cloths, car shampoo batch"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canAddSelectedDate}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {t.expenses.saveExpense}
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
              <Tag className="w-3.5 h-3.5" /> Category Filter
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900 dark:text-white">Filtered Expenses ({filteredExpenses.length})</div>
          <div className="text-sm font-black text-rose-600 dark:text-rose-400">
            {t.expenses.totalExpenses}: {totalExpense.toFixed(2)} {currency}
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {t.expenses.noExpenses}
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{t.expenses.category}</th>
                    <th className="py-3 px-4">{t.expenses.description}</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.expenses.amount} ({currency})</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedExpenses.map((exp) => {
                    const isSameDay = exp.entry_date === todayStr;
                    const canDelete = isOwner || (canDeleteRole && isSameDay);

                    return (
                      <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-200">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{exp.description || '-'}</td>
                        <td className="py-3 px-4 text-right rtl:text-left font-black text-rose-600 dark:text-rose-400 text-sm">
                          {exp.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right rtl:text-left">
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                              title="Delete expense"
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
              {paginatedExpenses.map((exp) => {
                const isSameDay = exp.entry_date === todayStr;
                const canDelete = isOwner || (canDeleteRole && isSameDay);

                return (
                  <div
                    key={exp.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200">
                          {exp.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{exp.description || 'No description'}</p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-rose-600 dark:text-rose-400">
                          {exp.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-bold">{currency}</span>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                          title="Delete expense"
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
          totalItems={expenses.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="expenses"
        />
      </div>

      {/* Delete Expense Confirmation Modal */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center border border-rose-200 dark:border-rose-800/40 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Delete Expense?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to permanently delete this expense?</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deletingExpense.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-rose-600 dark:text-rose-400">
                  {deletingExpense.amount.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{deletingExpense.entry_date}</span>
              </div>
              {deletingExpense.description && (
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500">Description:</span>
                  <span className="text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{deletingExpense.description}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteExpense}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
