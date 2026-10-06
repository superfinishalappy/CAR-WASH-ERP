'use client';

import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Wrench,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
  Globe,
  Clock,
  Layers,
  CheckCircle2,
  Calendar,
  PanelLeftClose,
  PanelLeft,
  Activity,
  Zap,
} from 'lucide-react';
import { dataProvider } from '@/lib/data-provider';
import { getTodayString } from '@/lib/date-utils';

export function Sidebar() {
  const {
    session,
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    language,
    setLanguage,
    logout,
    actingCompany,
    t,
    currency,
    dataVersion,
  } = useApp();

  // Collapsed state persisted in localStorage
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('garage_erp_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('garage_erp_sidebar_collapsed', String(next));
    } catch (e) {
      // ignore
    }
  };

  if (!session) return null;

  const role = session.profile.role;
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const canReports = ['superadmin', 'superstaff', 'owner', 'manager', 'accountant'].includes(role);
  const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);
  const company = isPlatform ? actingCompany : session.company;

  const todayStr = getTodayString(company?.timezone);
  const todayJobsCount = dataProvider.getJobs(todayStr).length;
  const todayAttendance = dataProvider.getAttendance(todayStr);
  const presentCount = todayAttendance.filter((a) => a.status === 'present').length;

  // Subscription days calculation
  let daysLeft: number | null = null;
  if (company && company.valid_until) {
    const valid = new Date(company.valid_until);
    const now = new Date();
    daysLeft = Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  interface NavItem {
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    badge?: string | number | null;
    badgeColor?: string;
  }

  interface NavGroup {
    id: string;
    label: string;
    items: NavItem[];
  }

  const groups: NavGroup[] = [
    {
      id: 'operations',
      label: language === 'ar' ? 'العمليات والتشغيل' : 'OPERATIONS',
      items: [
        {
          id: 'vehicles',
          label: t.nav.vehicles,
          sublabel: language === 'ar' ? 'تسجيل المركبات والخدمات' : 'Workshop Floor & Entry',
          icon: Car,
          visible: true,
          badge: todayJobsCount > 0 ? todayJobsCount : null,
          badgeColor: 'bg-blue-600 text-white shadow-sm shadow-blue-500/30',
        },
        {
          id: 'sales',
          label: (t.nav as any).sales || 'Sales History',
          sublabel: language === 'ar' ? 'سجل الفواتير والمقبوضات' : 'Records & Invoices',
          icon: History,
          visible: true,
        },
        {
          id: 'customers',
          label: t.nav.customers,
          sublabel: language === 'ar' ? 'حسابات العملاء والآجل' : 'Accounts & Debt Ledger',
          icon: Users,
          visible: true,
        },
      ],
    },
    {
      id: 'finance',
      label: language === 'ar' ? 'المالية والموظفين' : 'FINANCE & STAFF',
      items: [
        {
          id: 'expenses',
          label: t.nav.expenses,
          sublabel: language === 'ar' ? 'المصاريف التشغيلية' : 'Workshop OPEX & Bills',
          icon: Receipt,
          visible: true,
        },
        {
          id: 'advances',
          label: t.nav.advances,
          sublabel: language === 'ar' ? 'سلف الفنيين' : 'Staff Salary Advances',
          icon: Banknote,
          visible: true,
        },
        {
          id: 'attendance',
          label: t.nav.attendance,
          sublabel: language === 'ar' ? 'سجل الحضور اليومي' : 'Daily Staff Roll Call',
          icon: CalendarCheck,
          visible: true,
          badge: presentCount > 0 ? `${presentCount}` : null,
          badgeColor: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
        },
        {
          id: 'team',
          label: t.nav.team,
          sublabel: language === 'ar' ? 'الفنيين والعمولات والأسعار' : 'Technicians & Settings',
          icon: Settings,
          visible: canTeam,
        },
      ],
    },
    {
      id: 'management',
      label: language === 'ar' ? 'التحليلات والإدارة' : 'INSIGHTS & PLATFORM',
      items: [
        {
          id: 'reports',
          label: t.nav.reports,
          sublabel: language === 'ar' ? 'الأرباح والتحليلات والـ P&L' : 'P&L, Margins & Analytics',
          icon: BarChart3,
          visible: canReports,
        },
        {
          id: 'admin',
          label: t.nav.allCompanies,
          sublabel: language === 'ar' ? 'إدارة المستأجرين والشركات' : 'Tenants & Platform Hub',
          icon: Building,
          visible: isPlatform,
        },
      ],
    },
  ];

  const roleColors: Record<string, string> = {
    superadmin: 'from-purple-600 to-indigo-600 text-purple-200 border-purple-500/30',
    superstaff: 'from-indigo-600 to-blue-600 text-indigo-200 border-indigo-500/30',
    owner: 'from-amber-600 to-orange-600 text-amber-200 border-amber-500/30',
    manager: 'from-blue-600 to-cyan-600 text-blue-200 border-blue-500/30',
    accountant: 'from-emerald-600 to-teal-600 text-emerald-200 border-emerald-500/30',
    staff: 'from-slate-600 to-slate-700 text-slate-200 border-slate-500/30',
  };

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen z-30 transition-all duration-300 ease-in-out border-r border-slate-200/90 dark:border-slate-800/80 rtl:border-r-0 rtl:border-l bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl ${
        collapsed ? 'w-20' : 'w-64 lg:w-72'
      }`}
    >
      {/* Top Branding Section */}
      <div
        className={`h-20 flex items-center border-b border-slate-200/80 dark:border-slate-800/70 transition-all ${
          collapsed ? 'flex-col justify-center gap-1 px-2' : 'justify-between px-4'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3 min-w-0'}`}>
          <button
            onClick={collapsed ? toggleCollapsed : undefined}
            title={collapsed ? 'Click to expand sidebar' : undefined}
            className={`relative group shrink-0 ${collapsed ? 'cursor-pointer' : ''}`}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-2 ring-white/10">
              <Wrench className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950" />
          </button>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm lg:text-base tracking-tight text-slate-900 dark:text-white truncate">
                  {company ? company.name : t.appName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {company?.code && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
                    {company.code}
                  </span>
                )}
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">
                  {currency} · ERP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors ${
            collapsed ? 'w-full flex justify-center py-1' : ''
          }`}
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4 rtl:rotate-180 text-blue-600 dark:text-blue-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 rtl:rotate-180" />
          )}
        </button>
      </div>

      {/* Acting in Company Pill Banner for Super Admins */}
      {isPlatform && actingCompany && !collapsed && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-xs">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300 font-bold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span className="truncate">{actingCompany.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {t.banner.actingIn} {actingCompany.code}
          </div>
        </div>
      )}

      {/* Navigation Links Scroll Container */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {groups.map((group) => {
          const visibleItems = group.items.filter((i) => i.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.label}
                </div>
              ) : (
                <div className="w-6 h-0.5 mx-auto my-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={collapsed ? `${item.label} - ${item.sublabel}` : undefined}
                      className={`relative w-full flex items-center transition-all duration-200 rounded-2xl group ${
                        collapsed
                          ? 'justify-center p-3'
                          : 'gap-3 px-3.5 py-2.5 text-left rtl:text-right'
                      } ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-900/80 font-medium'
                      }`}
                    >
                      {/* Active Indicator Bar on Edge */}
                      {isActive && (
                        <span className="absolute left-0 rtl:left-auto rtl:right-0 top-2 bottom-2 w-1 rounded-r-full rtl:rounded-r-none rtl:rounded-l-full bg-white shadow-sm" />
                      )}

                      {/* Icon */}
                      <div
                        className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-105 shadow-sm'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Labels (Hidden if collapsed) */}
                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold truncate tracking-tight">
                              {item.label}
                            </span>
                            {item.badge !== undefined && item.badge !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                  isActive
                                    ? 'bg-white/25 text-white'
                                    : item.badgeColor || 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <span
                            className={`block text-[10px] truncate leading-tight mt-0.5 ${
                              isActive
                                ? 'text-blue-100'
                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'
                            }`}
                          >
                            {item.sublabel}
                          </span>
                        </div>
                      )}

                      {/* Dot Indicator in Collapsed mode if has badge */}
                      {collapsed && item.badge !== undefined && item.badge !== null && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-950" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Footer Section */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/70 space-y-2 bg-slate-50/50 dark:bg-slate-950/50">
        {/* Subscription validity card (expanded mode) */}
        {!collapsed && company && daysLeft !== null && (
          <div
            className={`p-2.5 rounded-xl border text-xs transition-colors ${
              daysLeft <= 7
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300/60 dark:border-amber-700/50 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-[11px]">
              <div className="flex items-center gap-1.5">
                {daysLeft <= 7 ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span>{daysLeft <= 7 ? 'Subscription Ending' : 'Active Subscription'}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/60">
                {daysLeft}d left
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              Valid until: {company.valid_until}
            </div>
          </div>
        )}

        {/* User Card */}
        <div
          className={`flex items-center rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-sm transition-all ${
            collapsed ? 'justify-center p-2' : 'p-2.5 gap-2.5'
          }`}
        >
          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${
              roleColors[role] || 'from-blue-600 to-indigo-600 text-white'
            } flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-black/5 dark:ring-white/10 shrink-0`}
          >
            {session.profile.full_name?.slice(0, 2).toUpperCase() || 'U'}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                {session.profile.full_name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-1.5 py-0.2 rounded-full text-[9px] uppercase font-black tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {role}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-mono">
                  @{session.profile.username}
                </span>
              </div>
            </div>
          )}

          {/* Quick Utility Actions */}
          <div className={`flex items-center ${collapsed ? 'hidden' : 'gap-1'}`}>
            {/* Language */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              title="Switch Language"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>

            {/* Theme */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={logout}
              title={t.nav.signOut}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsed mode quick sign out icon */}
        {collapsed && (
          <button
            onClick={logout}
            title={t.nav.signOut}
            className="w-full flex justify-center p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
