'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { ShieldAlert, PhoneCall, RefreshCw, LogOut, Calendar, Building2 } from 'lucide-react';
import { dataProvider } from '@/lib/data-provider';

interface ExpiryLockScreenProps {
  companyName?: string;
  companyCode?: string;
  validUntil?: string;
  onRenewed?: () => void;
}

export function ExpiryLockScreen({
  companyName,
  companyCode,
  validUntil,
  onRenewed,
}: ExpiryLockScreenProps) {
  const { session, logout, t } = useApp();

  const isPlatform = session && ['superadmin', 'superstaff'].includes(session.profile.role);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-500 shadow-inner">
          <ShieldAlert className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {t.login.subscriptionExpiredTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.login.subscriptionExpiredMsg}
          </p>
        </div>

        {/* Company Details Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Company:
            </span>
            <strong className="text-slate-900 dark:text-slate-200 font-semibold">{companyName || 'Registered Garage'}</strong>
          </div>
          {companyCode && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="font-medium">Company ID:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{companyCode}</span>
            </div>
          )}
          {validUntil && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                Expired on:
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{validUntil}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href="tel:+971501234567"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition"
          >
            <PhoneCall className="w-4 h-4" />
            {t.login.contactSupport}
          </a>

          {/* If Super Admin or Super Staff is viewing this, allow instant renewal */}
          {isPlatform && session.actingCompanyId && (
            <button
              onClick={() => {
                dataProvider.setSubscription(session.actingCompanyId!, 'add_30_days');
                if (onRenewed) onRenewed();
              }}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Super Admin Quick Renew (+30 Days)
            </button>
          )}

          <button
            onClick={logout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center justify-center gap-2 transition border border-slate-200 dark:border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.login.switchAccount}
          </button>
        </div>
      </div>
    </div>
  );
}
