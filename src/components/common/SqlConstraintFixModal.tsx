'use client';

import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, ExternalLink, RefreshCw, X } from 'lucide-react';

interface SqlConstraintFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onMarkLocally?: () => void;
  vehicleInfo?: {
    plate?: string | null;
    workType?: string;
    customerName?: string;
    total?: number;
    currency?: string;
  };
}

export const SQL_FIX_SCRIPT = `-- Run this in Supabase SQL Editor to allow customer vehicles to be marked as Paid:
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_check;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_id_check;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.jobs'::regclass 
          AND contype = 'c' 
          AND (pg_get_constraintdef(oid) ILIKE '%customer_id%' OR pg_get_constraintdef(oid) ILIKE '%is_paid%')
    ) LOOP
        EXECUTE 'ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.jobs ALTER COLUMN is_paid SET DEFAULT false;`;

export const SUPABASE_SQL_URL = 'https://supabase.com/dashboard/project/wzddoscnrcclgkmwedhd/sql/new';

export default function SqlConstraintFixModal({
  isOpen,
  onClose,
  onRetry,
  onMarkLocally,
  vehicleInfo,
}: SqlConstraintFixModalProps) {
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_FIX_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRetryClick = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-600/70 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-5 text-slate-900 dark:text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800/80 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              One-Time Supabase Setup Required
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Your database has an old check constraint (<code className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1 py-0.5 rounded font-mono font-bold">jobs_check</code>) that blocks registered customer vehicles from being marked as Paid.
            </p>
          </div>
        </div>

        {vehicleInfo && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Pending Vehicle</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {vehicleInfo.plate || 'No Plate'} ({vehicleInfo.workType || 'Vehicle'})
              </span>
              {vehicleInfo.customerName && (
                <span className="text-slate-500 block text-[11px]">Customer: {vehicleInfo.customerName}</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount Due</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {vehicleInfo.total?.toFixed(2)} {vehicleInfo.currency || 'INR'}
              </span>
            </div>
          </div>
        )}

        {/* Step-by-step instructions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Run this 2-line SQL command in Supabase (Takes 10 seconds):
            </span>
            <button
              onClick={handleCopy}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
            </button>
          </div>

          <div className="relative group">
            <pre className="p-3.5 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-36 leading-relaxed select-all">
              {SQL_FIX_SCRIPT}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <a
              href={SUPABASE_SQL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              <span>1. Open Supabase SQL Editor ↗</span>
            </a>

            <button
              onClick={handleRetryClick}
              disabled={isRetrying}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : '2. I Have Run the SQL (Retry Now)'}</span>
            </button>
          </div>

          {onMarkLocally && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onMarkLocally}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline font-medium transition"
              >
                Or mark as paid locally in session for now (without database save)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
