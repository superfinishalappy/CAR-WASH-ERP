'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import {
  supabase,
  buildSyntheticEmail,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from '@/lib/supabase';
import {
  Wrench,
  Lock,
  User,
  Building,
  ArrowRight,
  AlertCircle,
  Globe,
  Sun,
  Moon,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { ExpiryLockScreen } from '@/components/ExpiryLockScreen';

export function LoginScreen() {
  const { setSession, language, setLanguage, theme, toggleTheme, showToast, t } = useApp();

  const [companyCode, setCompanyCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expiredCompany, setExpiredCompany] = useState<{ name: string; code: string; validUntil: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!companyCode.trim() || !username.trim() || !password) {
      setErrorMsg('Please enter Company ID, username, and password.');
      return;
    }

    const rateKey = `${companyCode}_${username}`;
    const rateCheck = checkLoginRateLimit(rateKey);
    if (!rateCheck.allowed) {
      setErrorMsg(`Too many failed login attempts. Please wait ${rateCheck.waitSeconds} seconds.`);
      return;
    }

    setLoading(true);
    try {
      // Validate and authenticate directly with Supabase via dataProvider
      const res = await dataProvider.login(companyCode, username, password);

      if (res.success && res.session) {
        resetLoginAttempts(rateKey);
        showToast(`Welcome back, ${res.session.profile.full_name}!`, 'success');
        setSession(res.session);
      } else {
        recordFailedLogin(rateKey);
        if (res.isExpired) {
          const comp = dataProvider.getCompanies().find((c) => c.code.toUpperCase() === companyCode.trim().toUpperCase());
          setExpiredCompany({
            name: comp?.name || companyCode,
            code: companyCode.toUpperCase(),
            validUntil: comp?.valid_until || 'Expired',
          });
        } else {
          if (res.error?.includes('Database error querying schema')) {
            setErrorMsg('Supabase Auth error: Corrupted records exist in auth.users from a failed insert. Please run Migration 006 in your Supabase SQL Editor to clean and seed users.');
          } else {
            setErrorMsg(res.error || t.login.invalidCredentials);
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Database error querying schema')) {
        setErrorMsg('Supabase Auth error: Corrupted records exist in auth.users from a failed insert. Please run Migration 006 in your Supabase SQL Editor to clean and seed users.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred during login.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (expiredCompany) {
    return (
      <ExpiryLockScreen
        companyName={expiredCompany.name}
        companyCode={expiredCompany.code}
        validUntil={expiredCompany.validUntil}
        onRenewed={() => setExpiredCompany(null)}
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors duration-200">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Controls: Language & Bright/Dark Mode Toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm backdrop-blur-md"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{language === 'en' ? 'عربي' : 'English'}</span>
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle Bright/Dark Mode"
          className="p-2 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition shadow-sm backdrop-blur-md"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 items-center justify-center text-white shadow-xl shadow-blue-500/25 mb-1">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t.login.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {t.tagline}
          </p>
        </div>

        {/* Login Form Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-5 transition-colors duration-200">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Company ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{t.login.companyId}</span>
                {/*     <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{t.login.adminNote}</span> */}
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder={t.login.companyIdPlaceholder}
                  className="w-full pl-10 pr-3 rtl:pl-3 rtl:pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase tracking-wider transition-colors"
                  required
                />
              </div>
            </div>

            {/* Field 2: Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.login.username}
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder={t.login.usernamePlaceholder}
                  className="w-full pl-10 pr-3 rtl:pl-3 rtl:pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lowercase transition-colors"
                  required
                />
              </div>
            </div>

            {/* Field 3: Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.login.password}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.login.passwordPlaceholder}
                  className="w-full pl-10 pr-3 rtl:pl-3 rtl:pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{loading ? t.login.signingIn : t.login.submit}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          {/* Quick Demo Credentials */}
          {/*  <div className="pt-2 space-y-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-center">
              Quick Fill Credentials
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setCompanyCode('ADMIN');
                  setUsername('admin');
                  setPassword('AdminPassword123!');
                  setErrorMsg(null);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition text-center border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-center gap-2"
              >
                    <span>⚡ Fill Admin Login (Company: ADMIN / Username: admin)</span> 
              </button>
            </div>
          </div> */}

          {/* Connected Supabase Backend Indicator */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="truncate">
              Welcome <strong className="text-slate-700 dark:text-slate-300 font-mono">to Cloud-Fi</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
