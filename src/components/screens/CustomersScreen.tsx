'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Customer, Job } from '@/types/database';
import {
  Users,
  Plus,
  Phone,
  CreditCard,
  AlertTriangle,
  Receipt,
  Printer,
  X,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  Calendar,
  Building,
  Car,
  Clock,
} from 'lucide-react';
import { printElement } from '@/lib/export';
import { Pagination } from '@/components/common/Pagination';
import SqlConstraintFixModal from '@/components/common/SqlConstraintFixModal';
import { getTodayString } from '@/lib/date-utils';

export function CustomersScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [pendingJobsCustomer, setPendingJobsCustomer] = useState<Customer | null>(null);
  const [constraintModalJob, setConstraintModalJob] = useState<Job | null>(null);
  const [statementData, setStatementData] = useState<{
    customer: Customer;
    items: Array<{ date: string; description: string; debit: number; credit: number; balance: number }>;
  } | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newLimit, setNewLimit] = useState('');

  // Payment form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => getTodayString(session?.company?.timezone));
  const [paymentNote, setPaymentNote] = useState('');

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff'].includes(role);

  useEffect(() => {
    const list = dataProvider.getCustomers();
    setCustomers(list);
  }, [dataVersion]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.mobile && c.mobile.includes(searchTerm))
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const paginatedCustomers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const overLimitCustomers = customers.filter((c) => c.status === 'over_limit');

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = dataProvider.addCustomer({
      name: newName,
      mobile: newMobile,
      credit_limit: Number(newLimit) || 0,
    });

    if (res.success) {
      showToast('Customer account added successfully!', 'success');
      setShowAddModal(false);
      setNewName('');
      setNewMobile('');
      setNewLimit('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to add customer', 'error');
    }
  };

  const handleUpdateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const res = dataProvider.updateCustomer(editingCustomer.id, {
      name: editingCustomer.name,
      mobile: editingCustomer.mobile || '',
      credit_limit: editingCustomer.credit_limit,
    });

    if (res.success) {
      showToast('Customer details updated', 'success');
      setEditingCustomer(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update customer', 'error');
    }
  };

  const handleDeleteCustomer = (id: string) => {
    const res = dataProvider.deleteCustomer(id);
    if (res.success) {
      showToast('Customer account removed', 'info');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to delete customer', 'error');
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer || !paymentAmount) return;

    const res = dataProvider.recordCustomerPayment({
      customer_id: paymentCustomer.id,
      entry_date: paymentDate,
      amount: Number(paymentAmount),
      note: paymentNote,
    });

    if (res.success) {
      showToast(`Payment of ${paymentAmount} recorded successfully!`, 'success');
      setPaymentCustomer(null);
      setPaymentAmount('');
      setPaymentNote('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to record payment', 'error');
    }
  };

  const openStatement = (customerId: string) => {
    const stmt = dataProvider.getCustomerStatement(customerId);
    if (stmt) {
      setStatementData(stmt);
    }
  };

  const handleMarkJobPaid = async (jobId: string) => {
    const res = await dataProvider.setJobPaymentStatus(jobId, true);
    if (res.success) {
      showToast('✓ Customer vehicle marked as PAID! Customer balance reduced.', 'success');
      triggerRefresh();
    } else {
      if (res.isConstraintError) {
        const job = dataProvider.getJobs().find((j) => j.id === jobId);
        if (job) setConstraintModalJob(job);
      } else {
        showToast(res.error || 'Failed to update payment status', 'error');
      }
    }
  };

  const handleRetryAfterSql = async () => {
    if (!constraintModalJob) return;
    const res = await dataProvider.setJobPaymentStatus(constraintModalJob.id, true);
    if (res.success) {
      showToast('✓ Database constraint cleared! Vehicle marked as PAID! Customer balance reduced.', 'success');
      setConstraintModalJob(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Constraint still active in database. Did you click Run in Supabase SQL editor?', 'error');
    }
  };

  const handleMarkLocally = async () => {
    if (!constraintModalJob) return;
    await dataProvider.setJobPaymentStatus(constraintModalJob.id, true, true);
    showToast('✓ Marked as PAID in local session! Customer balance updated.', 'success');
    setConstraintModalJob(null);
    triggerRefresh();
  };

  const handleSettleAllCustomerJobs = async (customerId: string) => {
    const res = await dataProvider.settleCustomerJobs(customerId);
    if (res.success) {
      showToast(`✓ Settled ${res.count} vehicle order(s) as PAID! Customer balance updated.`, 'success');
      setPendingJobsCustomer(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to settle vehicle orders', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t.customers.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.customers.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer name or phone..."
              className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t.customers.addCustomer}
          </button>
        </div>
      </div>

      {/* Prominent Over-Limit Customers Banner */}
      {overLimitCustomers.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-gradient-to-r dark:from-rose-950/80 dark:via-red-950/80 dark:to-rose-950/80 border border-rose-300 dark:border-rose-700/60 shadow-xl flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <strong className="font-bold text-rose-900 dark:text-white uppercase tracking-wider block text-xs">
                {t.customers.overLimitBanner}
              </strong>
              <span>{overLimitCustomers.map((c) => `${c.name} (${c.current_balance?.toFixed(2)} / Limit: ${c.credit_limit})`).join(' · ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Customer Accounts Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedCustomers.map((cust) => {
          const bal = cust.current_balance || 0;
          const isOver = cust.status === 'over_limit';
          const isNear = cust.status === 'near_limit';

          return (
            <div
              key={cust.id}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900/90 border shadow-md dark:shadow-xl backdrop-blur-md flex flex-col justify-between transition hover:border-slate-300 dark:hover:border-slate-700 ${
                isOver
                  ? 'border-rose-300 dark:border-rose-600/80 shadow-rose-950/20 ring-1 ring-rose-500/50'
                  : isNear
                  ? 'border-amber-300 dark:border-amber-600/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">{cust.name}</h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{cust.mobile || 'No mobile recorded'}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isOver ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 animate-pulse">
                      {t.customers.statusOverLimit}
                    </span>
                  ) : isNear ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                      {t.customers.statusNearLimit}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      {t.customers.statusOk}
                    </span>
                  )}
                </div>

                {/* Balances & Credit Limit Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{t.customers.currentBalance}</span>
                    <span
                      className={`text-lg font-black ${
                        bal > 0 ? (isOver ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400') : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {bal.toFixed(2)} <span className="text-xs font-bold text-slate-400">{currency}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{t.customers.creditLimit}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {cust.credit_limit > 0 ? `${cust.credit_limit.toFixed(2)} ${currency}` : 'No Limit'}
                    </span>
                  </div>
                </div>

                {/* Pending Vehicles Badge & Quick Settle */}
                {(() => {
                  const pending = dataProvider.getCustomerPendingJobs(cust.id);
                  if (pending.length === 0) return null;
                  return (
                    <button
                      onClick={() => setPendingJobsCustomer(cust)}
                      className="mt-2.5 w-full py-2 px-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between hover:bg-amber-100 dark:hover:bg-amber-900/60 transition group shadow-sm"
                    >
                      <span className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{pending.length} Pending Vehicle(s)</span>
                      </span>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 group-hover:underline font-extrabold">
                        Mark Paid →
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Action Buttons: Receive Payment, Vehicles, Statement, Edit/Delete */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPendingJobsCustomer(cust)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-blue-600/20"
                    title="View and mark pending customer vehicles as paid"
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Settle Vehicles</span>
                  </button>

                  <button
                    onClick={() => openStatement(cust.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 transition border border-slate-200 dark:border-transparent"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    {t.customers.viewStatement}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCustomer(cust)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition border border-slate-200 dark:border-transparent"
                    title="Edit customer limit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => handleDeleteCustomer(cust.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30 transition"
                      title="Delete customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 50-Items-per-Page Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemName="customer accounts"
      />

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.customers.addCustomer}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.customerName}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Apex Transport LLC"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.mobile}</label>
                <input
                  type="tel"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  {t.customers.creditLimit} ({t.customers.noLimit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="5000"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-bold"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Limit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Customer & Credit Limit</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.customerName}</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.mobile}</label>
                <input
                  type="tel"
                  value={editingCustomer.mobile || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, mobile: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.creditLimit}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editingCustomer.credit_limit}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, credit_limit: Number(e.target.value) })
                  }
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-bold"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.customers.receivePayment}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{paymentCustomer.name}</p>
              </div>
              <button onClick={() => setPaymentCustomer(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t.customers.currentBalance}:</span>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {paymentCustomer.current_balance?.toFixed(2)} {currency}
                </span>
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.amountReceived} ({currency})</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-base text-emerald-600 dark:text-emerald-400"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.paymentDate}</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.customers.paymentNote}</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Bank wire transfer / Cheque #8291"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t.customers.recordPayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Modal (Printable ledger) */}
      {statementData && (
        <div className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            id="printable-statement"
            className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto printable-card"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 no-print">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{t.customers.statementTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {statementData.customer.name} · {statementData.customer.mobile || 'No phone'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printElement('printable-statement')}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition allow-print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t.customers.printStatement}
                </button>
                <button
                  onClick={() => setStatementData(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Statement Header (Appears in print) */}
            <div className="space-y-2">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-200">
                Customer: <span className="text-blue-600 dark:text-blue-400">{statementData.customer.name}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Credit Limit: {statementData.customer.credit_limit.toFixed(2)}</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Current Balance: {statementData.customer.current_balance?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Statement Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">{t.common.date}</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right rtl:text-left">{t.customers.debit}</th>
                    <th className="py-2.5 px-3 text-right rtl:text-left">{t.customers.creditCol}</th>
                    <th className="py-2.5 px-3 text-right rtl:text-left">{t.customers.runningBalance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {statementData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No transactions recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    statementData.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{it.date}</td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{it.description}</td>
                        <td className="py-2.5 px-3 text-right rtl:text-left text-slate-700 dark:text-slate-300">
                          {it.debit > 0 ? it.debit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right rtl:text-left text-emerald-600 dark:text-emerald-400 font-medium">
                          {it.credit > 0 ? it.credit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right rtl:text-left font-bold text-slate-900 dark:text-white">
                          {it.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end no-print">
              <button
                onClick={() => setStatementData(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700"
              >
                {t.customers.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Pending Vehicles Settlement Modal */}
      {pendingJobsCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Pending Vehicles · {pendingJobsCustomer.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Settle individual vehicle orders or mark all as Paid. Paid vehicles reduce customer outstanding debt immediately.
                </p>
              </div>
              <button
                onClick={() => setPendingJobsCustomer(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pending Vehicles Content */}
            {(() => {
              const pendingJobs = dataProvider.getCustomerPendingJobs(pendingJobsCustomer.id);
              const pendingTotal = pendingJobs.reduce((sum, j) => sum + j.total, 0);

              if (pendingJobs.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      All vehicles for this customer are settled!
                    </div>
                    <p className="text-slate-400">There are no unpaid vehicle orders pending payment.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs">
                    <div>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">Unpaid Vehicles:</span>{' '}
                      <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                        {pendingTotal.toFixed(2)} {currency}
                      </span>{' '}
                      <span className="text-slate-500 font-semibold">({pendingJobs.length} orders)</span>
                    </div>

                    <button
                      onClick={() => handleSettleAllCustomerJobs(pendingJobsCustomer.id)}
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark ALL as Paid ({pendingTotal.toFixed(2)} {currency})
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left rtl:text-right">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Plate</th>
                          <th className="py-2.5 px-3">Service</th>
                          <th className="py-2.5 px-3">Staff</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3 text-right rtl:text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {pendingJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{job.entry_date}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                              {job.plate || 'NO PLATE'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {job.work_type} <span className="text-[10px] text-slate-400">({job.vehicle_type})</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{job.staff_name}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              {job.total.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right rtl:text-left">
                              <button
                                onClick={() => handleMarkJobPaid(job.id)}
                                className="py-1 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-sm flex items-center gap-1 ml-auto transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Mark as Paid
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingJobsCustomer(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Constraint Fix Modal */}
      <SqlConstraintFixModal
        isOpen={Boolean(constraintModalJob)}
        onClose={() => setConstraintModalJob(null)}
        onRetry={handleRetryAfterSql}
        onMarkLocally={handleMarkLocally}
        vehicleInfo={
          constraintModalJob
            ? {
                plate: constraintModalJob.plate,
                workType: constraintModalJob.work_type,
                customerName: customers.find((c) => c.id === constraintModalJob.customer_id)?.name,
                total: constraintModalJob.total,
                currency,
              }
            : undefined
        }
      />
    </div>
  );
}
