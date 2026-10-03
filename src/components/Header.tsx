'use client';

import React, { useState, useEffect } from 'react';
import { useApp, NavTab } from '@/context/AppContext';
import {
  Wrench,
  Sun,
  Moon,
  Globe,
  LogOut,
  Building2,
  ShieldAlert,
  ArrowLeftRight,
  User,
  Sparkles,
  AlertTriangle,
  Menu,
  Car,
  History,
  Users,
  Receipt,
  Banknote,
  CalendarCheck,
  Settings,
  BarChart3,
  Building,
  RotateCcw,
  Clock,
  Calendar,
} from 'lucide-react';
import { dataProvider } from '@/lib/data-provider';
import { getTodayString } from '@/lib/date-utils';

export function Header() {
  const {
    session,
    language,
    setLanguage,
    theme,
    toggleTheme,
    logout,
    actingCompany,
    setActingCompany,
    activeTab,
    setActiveTab,
    setMobileMenuOpen,
    triggerRefresh,
    t,
    currency,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const tz = session?.company?.timezone || 'Asia/Dubai';
        const formatted = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(now);
        setCurrentTime(formatted);
      } catch {
        // fallback
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [session?.company?.timezone]);

  if (!session) return null;

  const role = session.profile.role;
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const company = isPlatform ? actingCompany : session.company;

  // Expiry check for warning banner (<= 7 days)
  let daysLeft: number | null = null;
  if (company && company.valid_until) {
    const valid = new Date(company.valid_until);
    const now = new Date();
    daysLeft = Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const showExpiryWarning = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;

  const roleBadgeColors: Record<string, string> = {
    superadmin: 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30',
    superstaff: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
    owner: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30',
    manager: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30',
    accountant: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    staff: 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/30',
  };

  const tabMeta: Record<
    NavTab,
    { title: string; category: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    vehicles: {
      title: t.nav.vehicles,
      category: language === 'ar' ? 'العمليات · التسجيل اليومي' : 'Operations · Floor Dispatch',
      icon: Car,
    },
    sales: {
      title: (t.nav as any).sales || 'Sales History',
      category: language === 'ar' ? 'العمليات · سجل الفواتير' : 'Operations · Invoices & Records',
      icon: History,
    },
    customers: {
      title: t.nav.customers,
      category: language === 'ar' ? 'العملاء · الحسابات والآجل' : 'Accounts · Credit Limits & Ledger',
      icon: Users,
    },
    expenses: {
      title: t.nav.expenses,
      category: language === 'ar' ? 'المالية · المصاريف التشغيلية' : 'Finance · Workshop OPEX',
      icon: Receipt,
    },
    advances: {
      title: t.nav.advances,
      category: language === 'ar' ? 'المالية · سلف الفنيين' : 'Finance · Staff Salary Advances',
      icon: Banknote,
    },
    attendance: {
      title: t.nav.attendance,
      category: language === 'ar' ? 'الموظفين · الحضور والغياب' : 'Staff · Daily Roll Call',
      icon: CalendarCheck,
    },
    team: {
      title: t.nav.team,
      category: language === 'ar' ? 'الإدارة · الفريق والأسعار' : 'Management · Technicians & Rates',
      icon: Settings,
    },
    reports: {
      title: t.nav.reports,
      category: language === 'ar' ? 'التحليلات · التقارير المالية' : 'Analytics · P&L & Margins',
      icon: BarChart3,
    },
    admin: {
      title: t.nav.allCompanies,
      category: language === 'ar' ? 'المنصة · الشركات والمستأجرين' : 'Platform · Tenants & Licenses',
      icon: Building,
    },
  };

  const currentTabInfo = tabMeta[activeTab] || tabMeta.vehicles;
  const TabIcon = currentTabInfo.icon;
  const todayStr = getTodayString(company?.timezone);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-colors duration-200">
      {/* 1. Super Admin "Acting in Company" Sticky Banner */}
      {isPlatform && actingCompany && (
        <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-blue-900/90 px-4 py-2 border-b border-indigo-700/50 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-indigo-100">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>
              {t.banner.actingIn} <strong className="text-white font-bold">{actingCompany.name}</strong> ({actingCompany.code})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActingCompany(null);
                setActiveTab('admin');
              }}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition text-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {t.banner.backToAdmin}
            </button>
          </div>
        </div>
      )}

      {/* 2. Owner 7-day Pre-Expiry Warning Banner */}
      {showExpiryWarning && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/90 dark:to-orange-950/90 border-b border-amber-500/30 dark:border-amber-600/40 px-4 py-2 flex items-center justify-between text-xs md:text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>
              {t.banner.expiryWarning.replace('{days}', String(daysLeft))}
            </span>
          </div>
          {isPlatform && (
            <button
              onClick={() => {
                if (company) {
                  dataProvider.setSubscription(company.id, 'add_30_days');
                }
              }}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40 text-xs font-semibold"
            >
              +30 Days Now
            </button>
          )}
        </div>
      )}

      {/* 3. Mobile Header Bar (md:hidden) */}
      <div className="md:hidden px-4 h-16 flex items-center justify-between">
        {/* Logo and Workshop Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate max-w-[150px]">
                {company ? company.name : t.appName}
              </span>
              {company?.code && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700">
                  {company.code}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {company ? `${currency} · ${company.timezone}` : t.tagline}
            </div>
          </div>
        </div>

        {/* Mobile Actions: Language, Theme, Hamburger */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
          >
            <span>{language === 'en' ? 'عربي' : 'EN'}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 4. Desktop Toolbar (hidden md:flex) */}
      <div className="hidden md:flex px-6 h-16 items-center justify-between gap-4">
        {/* Left: Active Screen Breadcrumb & Header */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <TabIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {currentTabInfo.title}
              </h1>
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {currentTabInfo.category}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{todayStr}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span>{company?.name || 'Garage ERP'}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Toolbar Widgets */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* Live Workshop Clock */}
          {currentTime && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{currentTime}</span>
              <span className="text-[10px] text-slate-400 font-mono">({company?.timezone?.split('/')[1] || 'Dubai'})</span>
            </div>
          )}

          {/* Currency Pill */}
          <div className="px-2.5 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-black tracking-wide">
            {currency}
          </div>

          {/* Quick Data Refresh Button */}
          <button
            onClick={() => triggerRefresh()}
            title="Refresh Data"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition active:rotate-180"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Language Switch */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title="Switch Language"
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition flex items-center gap-1.5 text-xs font-bold"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{language === 'en' ? 'عربي' : 'EN'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition shadow-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* User Badge */}
          <div className="flex items-center gap-2 pl-2 rtl:pl-0 rtl:pr-2 border-l rtl:border-l-0 rtl:border-r border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {session.profile.full_name?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="hidden lg:block text-left rtl:text-right">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[120px]">
                {session.profile.full_name}
              </div>
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] uppercase font-bold border mt-0.5 ${roleBadgeColors[role] || 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
