'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Navigation } from '@/components/Navigation';
import { ExpiryLockScreen } from '@/components/ExpiryLockScreen';
import { LoginScreen } from '@/components/screens/LoginScreen';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { MobileDrawer } from '@/components/MobileDrawer';
import { VehiclesScreen } from '@/components/screens/VehiclesScreen';
import { SalesHistoryScreen } from '@/components/screens/SalesHistoryScreen';
import { CustomersScreen } from '@/components/screens/CustomersScreen';
import { ExpensesScreen } from '@/components/screens/ExpensesScreen';
import { AdvancesScreen } from '@/components/screens/AdvancesScreen';
import { AttendanceScreen } from '@/components/screens/AttendanceScreen';
import { TeamScreen } from '@/components/screens/TeamScreen';
import { ReportsScreen } from '@/components/screens/ReportsScreen';
import { AdminScreen } from '@/components/screens/AdminScreen';
import { getTodayString } from '@/lib/date-utils';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { session, isInitializing, activeTab, triggerRefresh } = useApp();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Initial Synchronizing state / pre-hydration -> sleek branded loading screen.
  // Both SSR and initial client hydration render AppLoadingScreen, guaranteeing 0 hydration mismatches.
  if (!mounted || isInitializing) {
    return <AppLoadingScreen />;
  }

  // 2. Unauthenticated -> Login Screen
  if (!session) {
    return <LoginScreen />;
  }

  const role = session.profile.role;
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const company = session.company;

  // 2. Subscription Expiry Enforced for Company Roles (§1 & §3)
  // Super Admin & Super Staff bypass the lock to assist & renew
  const todayStr = getTodayString(company?.timezone);
  const isCompanyExpired = !isPlatform && company && (company.valid_until < todayStr || !company.active);

  if (isCompanyExpired) {
    return (
      <ExpiryLockScreen
        companyName={company.name}
        companyCode={company.code}
        validUntil={company.valid_until}
        onRenewed={triggerRefresh}
      />
    );
  }

  // 3. Active Screen Dispatcher
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Desktop Side Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header />
        <Navigation />
        <MobileDrawer />

        <main className="flex-1 w-full animate-in fade-in duration-150 pb-20 md:pb-8">
          {activeTab === 'vehicles' && <VehiclesScreen />}
          {activeTab === 'sales' && <SalesHistoryScreen />}
          {activeTab === 'customers' && <CustomersScreen />}
          {activeTab === 'expenses' && <ExpensesScreen />}
          {activeTab === 'advances' && <AdvancesScreen />}
          {activeTab === 'attendance' && <AttendanceScreen />}
          {activeTab === 'team' && <TeamScreen />}
          {activeTab === 'reports' && <ReportsScreen />}
          {activeTab === 'admin' && isPlatform && <AdminScreen />}
        </main>
      </div>
    </div>
  );
}
