'use client';

import React from 'react';
import { useApp, NavTab } from '@/context/AppContext';
import {
  Car,
  History,
  Users,
  Receipt,
  Banknote,
  CalendarCheck,
  Settings,
  BarChart3,
  Building,
  X,
  User,
  LogOut,
  Sun,
  Moon,
  Globe,
  Coins,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react';

export function MobileDrawer() {
  const {
    session,
    activeTab,
    setActiveTab,
    mobileMenuOpen,
    setMobileMenuOpen,
    theme,
    toggleTheme,
    language,
    setLanguage,
    logout,
    t,
    currency,
  } = useApp();

  if (!session || !mobileMenuOpen) return null;

  const role = session.profile.role;
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const canReports = ['superadmin', 'superstaff', 'senior_staff', 'owner', 'manager', 'accountant'].includes(role);
  const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);
  const company = session.company;

  interface DrawerItem {
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
    visible: boolean;
  }

  const items: DrawerItem[] = [
    {
      id: 'admin' as NavTab,
      label: t.nav.allCompanies,
      sublabel: 'Manage all workshop tenants & licenses',
      icon: <Building className="w-5 h-5" />,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      visible: isPlatform,
    },
    {
      id: 'vehicles' as NavTab,
      label: t.nav.vehicles,
      sublabel: 'Daily counter orders & vehicle dispatch',
      icon: <Car className="w-5 h-5" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      visible: true,
    },
    {
      id: 'sales' as NavTab,
      label: (t.nav as any).sales || 'Sales History',
      sublabel: 'Search, invoices, paid/unpaid status',
      icon: <History className="w-5 h-5" />,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      visible: true,
    },
    {
      id: 'customers' as NavTab,
      label: t.nav.customers,
      sublabel: 'Accounts, credit limits, settle vehicles',
      icon: <Users className="w-5 h-5" />,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      visible: true,
    },
    {
      id: 'expenses' as NavTab,
      label: t.nav.expenses,
      sublabel: 'Workshop OPEX, supplies, utilities',
      icon: <Receipt className="w-5 h-5" />,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      visible: true,
    },
    {
      id: 'advances' as NavTab,
      label: t.nav.advances,
      sublabel: 'Staff salary advances & deductions',
      icon: <Banknote className="w-5 h-5" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      visible: true,
    },
    {
      id: 'attendance' as NavTab,
      label: t.nav.attendance,
      sublabel: 'Staff roster & present on duty log',
      icon: <CalendarCheck className="w-5 h-5" />,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      visible: true,
    },
    {
      id: 'team' as NavTab,
      label: t.nav.team,
      sublabel: 'Staff profiles, commission & workshop settings',
      icon: <Settings className="w-5 h-5" />,
      color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      visible: canTeam,
    },
    {
      id: 'reports' as NavTab,
      label: t.nav.reports,
      sublabel: 'P&L, margins, 10 health rules',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      visible: canReports,
    },
  ].filter((item) => item.visible);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex justify-end animate-in fade-in duration-200">
      {/* Dark backdrop blur */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Slide-in Sheet */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold">
              🚗
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                {company ? company.name : 'Super Finish'}
              </h2>
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <span>{company ? company.code : 'PORTAL'}</span>
                <span>•</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{currency}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 my-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/80 dark:to-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-500/30">
              {session.profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                {session.profile.full_name}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                @{session.profile.username}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            {role}
          </span>
        </div>

        {/* Navigation Modules List */}
        <div className="px-3 flex-1 space-y-1 py-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Modules & Operations
          </div>
          {items.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full p-2.5 rounded-2xl text-left rtl:text-right flex items-center justify-between transition-all group ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl border transition ${
                      active ? 'bg-white/20 text-white border-white/20' : item.color
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{item.label}</div>
                    <div
                      className={`text-[10px] leading-tight mt-0.5 truncate max-w-[200px] ${
                        active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition ${
                    active ? 'text-white' : 'text-slate-400 group-hover:translate-x-0.5'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Quick Settings & Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/60 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-800 dark:text-slate-200 shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* Dark / Bright Mode Switcher */}
            <button
              onClick={toggleTheme}
              className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-800 dark:text-slate-200 shadow-sm"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.nav.signOut}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
