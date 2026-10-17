'use client';

import React, { useState, useEffect } from 'react';
import { Job } from '@/types/database';
import { getTodayString, getYesterdayString } from '@/lib/date-utils';
import { Banknote, CheckCircle2, X, Calendar, Clock, Car } from 'lucide-react';

interface PaymentDateModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (job: Job, paymentDate: string) => void;
  timezone?: string;
  currency?: string;
}

export function PaymentDateModal({
  job,
  isOpen,
  onClose,
  onConfirm,
  timezone,
  currency = 'AED',
}: PaymentDateModalProps) {
  const todayStr = getTodayString(timezone);
  const yesterdayStr = getYesterdayString(timezone);

  const [paymentDate, setPaymentDate] = useState<string>(todayStr);

  useEffect(() => {
    if (job) {
      // Default to today, or if job already has payment_date use that
      setPaymentDate(job.payment_date || todayStr);
    }
  }, [job, todayStr]);

  if (!isOpen || !job) return null;

  const isLate = paymentDate !== job.entry_date;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(job, paymentDate || todayStr);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {job.is_paid ? 'Change Payment Date' : 'Mark Vehicle as Paid'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select the date this payment was collected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vehicle Summary Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                {job.plate || 'NO PLATE'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {job.work_type} • Washed: <span className="font-semibold">{job.entry_date}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {job.total.toFixed(2)} {currency}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {job.customer_name ? `Account: ${job.customer_name}` : 'Walk-in'}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Payment Date</span>
              </label>
              {isLate ? (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                  Late Paid (Different Date)
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  Paid on Wash Date
                </span>
              )}
            </div>

            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
              required
            />

            {/* Quick Date Shortcuts */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setPaymentDate(todayStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  paymentDate === todayStr
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Today ({todayStr})
              </button>

              {job.entry_date && job.entry_date !== todayStr && (
                <button
                  type="button"
                  onClick={() => setPaymentDate(job.entry_date)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    paymentDate === job.entry_date
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Mark payment on the same date the vehicle was washed"
                >
                  Wash Date ({job.entry_date})
                </button>
              )}

              <button
                type="button"
                onClick={() => setPaymentDate(yesterdayStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  paymentDate === yesterdayStr
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Yesterday
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Payment ({paymentDate})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
