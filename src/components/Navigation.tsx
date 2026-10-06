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
  Menu,
  MoreHorizontal,
} from 'lucide-react';

export function Navigation() {
  const { session, activeTab, setActiveTab, setMobileMenuOpen, t } = useApp();

  if (!session) return null;

  const role = session.profile.role;
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const canReports = ['superadmin', 'superstaff', 'owner', 'manager', 'accountant'].includes(role);
  const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);

  interface NavItem {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }

  // All available tabs for desktop
  const allItems: NavItem[] = [
    {
      id: 'admin' as NavTab,
      label: t.nav.allCompanies,
      icon: <Building className="w-4 h-4" />,
      visible: isPlatform,
    },
    {
      id: 'vehicles' as NavTab,
      label: t.nav.vehicles,
      icon: <Car className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'sales' as NavTab,
      label: (t.nav as any).sales || 'Sales History',
      icon: <History className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'customers' as NavTab,
      label: t.nav.customers,
      icon: <Users className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'expenses' as NavTab,
      label: t.nav.expenses,
      icon: <Receipt className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'advances' as NavTab,
      label: t.nav.advances,
      icon: <Banknote className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'attendance' as NavTab,
      label: t.nav.attendance,
      icon: <CalendarCheck className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'team' as NavTab,
      label: t.nav.team,
      icon: <Settings className="w-4 h-4" />,
      visible: canTeam,
    },
    {
      id: 'reports' as NavTab,
      label: t.nav.reports,
      icon: <BarChart3 className="w-4 h-4" />,
      visible: canReports,
    },
  ].filter((item) => item.visible);

  // Top 4 primary tabs for mobile bottom bar
  const mobilePrimaryTabs: NavItem[] = [
    {
      id: 'vehicles' as NavTab,
      label: t.nav.vehicles,
      icon: <Car className="w-5 h-5" />,
      visible: true,
    },
    {
      id: 'sales' as NavTab,
      label: (t.nav as any).sales || 'Sales',
      icon: <History className="w-5 h-5" />,
      visible: true,
    },
    {
      id: 'customers' as NavTab,
      label: t.nav.customers,
      icon: <Users className="w-5 h-5" />,
      visible: true,
    },
    {
      id: 'expenses' as NavTab,
      label: t.nav.expenses,
      icon: <Receipt className="w-5 h-5" />,
      visible: true,
    },
  ];

  const isMoreTabActive = !mobilePrimaryTabs.some((tab) => tab.id === activeTab);

  return (
    <>
      {/* Mobile Bottom Navigation Bar (4 Core Action Tabs + 'More' Drawer Trigger) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800/90 backdrop-blur-xl pb-safe transition-colors duration-200 shadow-2xl">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {mobilePrimaryTabs.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-2xl transition-all ${
                    active
                      ? 'bg-blue-600/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 scale-105'
                      : ''
                  }`}
                >
                  {item.icon}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px] leading-tight font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* 5th Button: 'More' Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              isMoreTabActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-2xl transition-all relative ${
                isMoreTabActive
                  ? 'bg-blue-600/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 scale-105'
                  : ''
              }`}
            >
              <Menu className="w-5 h-5" />
              {isMoreTabActive && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-tight font-medium">
              {isMoreTabActive
                ? allItems.find((i) => i.id === activeTab)?.label.split(' ')[0] || 'More'
                : 'More'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
