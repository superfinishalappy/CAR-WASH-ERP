'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Company } from '@/types/database';
import { dataProvider } from '@/lib/data-provider';
import {
  FileText,
  Printer,
  X,
  Copy,
  Check,
  Calendar,
  CreditCard,
  Building,
  Car,
  Receipt,
  CheckCircle2,
  DollarSign,
  Phone,
  Share2,
  Loader2,
} from 'lucide-react';
import { UnifiedDocumentLayout, UnifiedDocumentItem } from './UnifiedDocumentLayout';
import {
  printDocumentElement,
  captureDocumentImage,
} from '@/lib/pdf-generator';
import { getTodayString } from '@/lib/date-utils';

interface CustomerStatementModalProps {
  customerId: string | null;
  company: Company | null;
  currency: string;
  onClose: () => void;
  onRecordPayment?: (customer: Customer) => void;
}

export function CustomerStatementModal({
  customerId,
  company,
  currency,
  onClose,
  onRecordPayment,
}: CustomerStatementModalProps) {
  const [copied, setCopied] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [preset, setPreset] = useState<'all' | 'this_month' | 'last_month' | 'last_90'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Quick Date Range Presets
  const applyPreset = (type: 'all' | 'this_month' | 'last_month' | 'last_90') => {
    setPreset(type);
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (type === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (type === 'this_month') {
      const start = new Date(y, m, 1).toISOString().slice(0, 10);
      const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === 'last_month') {
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === 'last_90') {
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    }
  };

  // Fetch statement data
  const statement = useMemo(() => {
    if (!customerId) return null;
    return dataProvider.getCustomerStatement(
      customerId,
      startDate ? startDate : undefined,
      endDate ? endDate : undefined
    );
  }, [customerId, startDate, endDate]);

  if (!statement || !customerId) return null;

  const { customer, opening_balance } = statement;
  const companyName = company?.name || 'Super Finish';
  const phone = customer.mobile || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return 'All Time (Full Ledger)';
    if (startDate && endDate) return `${startDate} to ${endDate}`;
    if (startDate) return `From ${startDate}`;
    return `Up to ${endDate}`;
  }, [startDate, endDate]);

  const statementDocNumber = `STMT-${(endDate || getTodayString(company?.timezone)).replace(/-/g, '')}-${customer.id.slice(0, 5).toUpperCase()}`;

  // Map and filter items by Status (All / Paid / Unpaid)
  // Ensures invoice totals and payment credits are mathematically distinct!
  const filteredItems: UnifiedDocumentItem[] = useMemo(() => {
    return statement.items
      .map((it) => {
        const isService = it.type === 'service';
        const isPaid = isService ? Boolean(it.is_paid) : true;

        // An invoice has total_amount = debit. A payment has total_amount = 0 (credit only).
        const total_amount = isService ? it.debit : 0;
        const paid_amount = isService ? (isPaid ? it.debit : 0) : it.credit;
        const outstanding_amount = isService ? (isPaid ? 0 : it.debit) : 0;
        const status: 'PAID' | 'UNPAID' = isPaid ? 'PAID' : 'UNPAID';

        return {
          id: it.id,
          date: it.date,
          ref_no: it.ref_no,
          description: it.description,
          vehicle_plate: it.vehicle_plate,
          vehicle_type: it.vehicle_type,
          work_type: it.work_type,
          total_amount,
          paid_amount,
          outstanding_amount,
          status,
        };
      })
      .filter((it) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'paid') return it.status === 'PAID';
        if (statusFilter === 'unpaid') return it.status === 'UNPAID';
        return true;
      });
  }, [statement, statusFilter]);

  // Total calculations strictly matching the shown invoice list
  const shownInvoiceTotal = useMemo(() => {
    return filteredItems
      .filter((it) => it.total_amount > 0)
      .reduce((sum, it) => sum + it.total_amount, 0);
  }, [filteredItems]);

  const shownPaidTotal = useMemo(() => {
    return filteredItems.reduce((sum, it) => sum + it.paid_amount, 0);
  }, [filteredItems]);

  const shownDueTotal = useMemo(() => {
    return filteredItems.reduce((sum, it) => sum + it.outstanding_amount, 0);
  }, [filteredItems]);

  const docTitle = `${companyName} ${statementDocNumber}`;

  // Keep browser document.title set to [Company Name] [Statement Number] while modal is open
  useEffect(() => {
    if (typeof document === 'undefined' || !customerId) return;
    const prevTitle = document.title;
    document.title = docTitle;
    return () => {
      document.title = prevTitle;
    };
  }, [docTitle, customerId]);

  // Clean, professional WhatsApp message text that accompanies the official PDF
  const generateWhatsAppStatement = () => {
    return (
`*CUSTOMER STATEMENT* · *${statementDocNumber}*
*${companyName}*
Customer: *${customer.name}*
Period: ${dateRangeLabel}
Filter: ${statusFilter.toUpperCase()} (${filteredItems.length} records)
*Total Invoiced:* ${shownInvoiceTotal.toFixed(2)} ${currency}
*Total Paid:* ${shownPaidTotal.toFixed(2)} ${currency}
*Outstanding Due:* *${shownDueTotal.toFixed(2)} ${currency}*
*Total Ledger Balance:* ${customer.current_balance?.toFixed(2)} ${currency}

📄 *Official Statement PDF attached.*
Thank you for your business!`
    );
  };

  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const cachedFileRef = useRef<File | null>(null);

  // Pre-generate statement image in background as soon as modal mounts / filters change
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      await new Promise((r) => setTimeout(r, 150));
      if (!active) return;
      try {
        const captured = await captureDocumentImage('unified-statement-document', `${docTitle}.png`);
        if (captured && active) {
          cachedFileRef.current = captured.file;
        }
      } catch (err) {
        console.warn('Pre-rendering statement image failed:', err);
      }
    };
    prepare();
    return () => {
      active = false;
    };
  }, [docTitle, filteredItems]);

  // Native Image Sharing: Dispatches document image to mobile/desktop OS native share sheet
  const handleShareImage = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareToast(null);

    try {
      let fileToShare = cachedFileRef.current;
      if (!fileToShare) {
        const captured = await captureDocumentImage('unified-statement-document', `${docTitle}.png`);
        if (captured) {
          fileToShare = captured.file;
          cachedFileRef.current = captured.file;
        }
      }

      if (!fileToShare) {
        throw new Error('Could not generate statement image');
      }

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
        });
      } else {
        setShareToast({
          message: 'Native share is not supported on this browser.',
          type: 'error',
        });
        setTimeout(() => setShareToast(null), 4000);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Share image error:', err);
        setShareToast({
          message: 'Could not open share. Please try again.',
          type: 'error',
        });
        setTimeout(() => setShareToast(null), 4000);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 1. Direct Print on same page with [Company Name] [Statement Number] title
  const handlePrint = () => {
    printDocumentElement('unified-statement-document', docTitle);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateWhatsAppStatement());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Action Bar (Screen Only) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  Customer Statement
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {statusFilter.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {customer.name} {customer.mobile ? `· ${customer.mobile}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {shareToast && (
              <span className="hidden sm:inline-block text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                {shareToast.message}
              </span>
            )}

            {/* Native Share Image Button: Triggers OS native share sheet (Android/iOS) with image preview */}
            <button
              type="button"
              onClick={handleShareImage}
              disabled={isSharing}
              className="py-2 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
              title="Share statement image via Android / iOS Native Share"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span>{isSharing ? 'Preparing...' : 'Share Image'}</span>
            </button>

            {/* Direct Print Button: Prints the document on the same page */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3 sm:px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls: Status Tabs (All / Paid / Unpaid) & Date Ranges */}
        <div className="p-3 sm:p-4 bg-slate-100/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs no-print shrink-0">
          
          {/* Status Filter Tabs: All, Paid, Unpaid */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All ({statement.items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Paid
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Unpaid
            </button>
          </div>

          {/* Date Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                preset === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                preset === 'this_month'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                preset === 'last_month'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Last Month
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('all');
                }}
                className="py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('all');
                }}
                className="py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Single Professional Document Body (Exact Same Template for Invoice, Statement, Print & PDF) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/50">
          <UnifiedDocumentLayout
            id="unified-statement-document"
            type="statement"
            company={company}
            currency={currency}
            documentNumber={statementDocNumber}
            documentDate={getTodayString(company?.timezone)}
            periodLabel={dateRangeLabel}
            status={shownDueTotal > 0 ? 'UNPAID' : 'PAID'}
            customerName={customer.name}
            customerMobile={phone}
            customerAccountId={customer.id.slice(0, 8)}
            creditLimit={customer.credit_limit}
            items={filteredItems}
            openingBalance={opening_balance}
            grandTotal={shownInvoiceTotal}
            totalPaid={shownPaidTotal}
            outstandingDue={shownDueTotal}
            notes={`Showing ${filteredItems.length} records. Filter: ${statusFilter.toUpperCase()}${customer.current_balance ? ` · Total Customer Debt: ${customer.current_balance.toFixed(2)} ${currency}` : ''}`}
          />
        </div>

        {/* Bottom Action Footer (Screen Only) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2">
            {onRecordPayment && (
              <button
                type="button"
                onClick={() => {
                  onRecordPayment(customer);
                }}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Receive Payment</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyText}
              className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
