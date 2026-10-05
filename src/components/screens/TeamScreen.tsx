'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Profile, CompanySettings, AuditLogEntry, AppRole, PayType } from '@/types/database';
import {
  Settings,
  Users,
  Plus,
  KeyRound,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Sliders,
  DollarSign,
  Clock,
  Tag,
  AlertCircle,
  X,
  History,
  Info,
  Sparkles,
} from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';

export function TeamScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency: appCurrency, setCurrency: setAppCurrency } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'team' | 'settings' | 'audit'>('team');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 50;

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [resetPassUser, setResetPassUser] = useState<Profile | null>(null);
  const [editingPayStaff, setEditingPayStaff] = useState<Profile | null>(null);
  const [editPayType, setEditPayType] = useState<PayType>('commission');
  const [editPayRate, setEditPayRate] = useState('');

  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('staff');
  const [newPayType, setNewPayType] = useState<PayType>('commission');
  const [newPayRate, setNewPayRate] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Reset Password State
  const [updatedPassword, setUpdatedPassword] = useState('');

  // Settings Edit State
  const [workTypesInput, setWorkTypesInput] = useState('');
  const [vehicleTypesInput, setVehicleTypesInput] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [portalCurrency, setPortalCurrency] = useState(appCurrency || 'AED');

  // Thresholds state
  const [marginWarn, setMarginWarn] = useState(15);
  const [staffWarn, setStaffWarn] = useState(40);
  const [staffBad, setStaffBad] = useState(50);
  const [opexWarn, setOpexWarn] = useState(20);
  const [opexBad, setOpexBad] = useState(30);
  const [unpaidWarn, setUnpaidWarn] = useState(10);
  const [unpaidBad, setUnpaidBad] = useState(25);
  const [advanceWarn, setAdvanceWarn] = useState(15);
  const [salesDropWarn, setSalesDropWarn] = useState(-10);
  const [salesDropBad, setSalesDropBad] = useState(-25);
  const [expGrowthBad, setExpGrowthBad] = useState(20);

  const role = session?.profile.role || 'staff';
  const isOwner = role === 'owner' || ['superadmin', 'superstaff'].includes(role);

  useEffect(() => {
    const p = dataProvider.getCompanyProfiles();
    setProfiles(p);

    const s = dataProvider.getSettings();
    setSettings(s);
    setWorkTypesInput(s.work_types.join(', '));
    setVehicleTypesInput(s.vehicle_types.join(', '));
    setCategoriesInput(s.expense_categories.join(', '));

    const th = s.thresholds;
    setMarginWarn(th.margin_warn * 100);
    setStaffWarn(th.staff_warn * 100);
    setStaffBad(th.staff_bad * 100);
    setOpexWarn(th.opex_warn * 100);
    setOpexBad(th.opex_bad * 100);
    setUnpaidWarn(th.unpaid_warn * 100);
    setUnpaidBad(th.unpaid_bad * 100);
    setAdvanceWarn(th.advance_warn * 100);
    setSalesDropWarn(th.sales_drop_warn * 100);
    setSalesDropBad(th.sales_drop_bad * 100);
    setExpGrowthBad(th.expense_growth * 100);

    const logs = dataProvider.getAuditLogs();
    setAuditLogs(logs);
  }, [dataVersion]);

  useEffect(() => {
    if (appCurrency) setPortalCurrency(appCurrency);
  }, [appCurrency]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    const actualPayType = (newPayType as string) === 'custom_daily' ? 'daily' : newPayType;
    const actualPayRate = (newPayType as string) === 'custom_daily' ? 0 : (Number(newPayRate) || 0);

    const res = await dataProvider.createCompanyUser({
      username: newUsername,
      full_name: newFullName,
      role: newRole,
      pay_type: actualPayType as PayType,
      pay_rate: actualPayRate,
      password: newPassword,
    });

    if (res.success) {
      showToast(`User ${newUsername} created successfully!`, 'success');
      setShowAddUserModal(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setNewPayRate('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to create user', 'error');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser) return;

    if (updatedPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    const res = dataProvider.resetUserPassword(resetPassUser.id, updatedPassword);
    if (res.success) {
      showToast(`Password updated for ${resetPassUser.username}`, 'success');
      setResetPassUser(null);
      setUpdatedPassword('');
    } else {
      showToast(res.error || 'Failed to reset password', 'error');
    }
  };

  const handleOpenEditPay = (p: Profile) => {
    setEditingPayStaff(p);
    if (p.pay_type === 'daily' && (!p.pay_rate || Number(p.pay_rate) === 0)) {
      setEditPayType('custom_daily' as any);
      setEditPayRate('0');
    } else {
      setEditPayType(p.pay_type || 'none');
      setEditPayRate(p.pay_rate ? String(p.pay_rate) : '');
    }
  };

  const handleSavePayRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayStaff) return;

    const actualPayType = (editPayType as string) === 'custom_daily' ? 'daily' : editPayType;
    const actualPayRate = (editPayType as string) === 'custom_daily' ? 0 : (Number(editPayRate) || 0);

    const res = await dataProvider.updateStaffPayRate(
      editingPayStaff.id,
      actualPayType as PayType,
      actualPayRate
    );

    if (res.success) {
      showToast(
        `Pay basis updated for ${editingPayStaff.full_name}. Future entries will use this rate while historical records remain locked.`,
        'success'
      );
      setEditingPayStaff(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update pay basis', 'error');
    }
  };

  const handleToggleActive = (user: Profile) => {
    const res = dataProvider.toggleUserActive(user.id);
    if (res.success) {
      showToast(`User status toggled to ${res.profile?.active ? 'Active' : 'Inactive'}`, 'info');
      triggerRefresh();
    } else {
      showToast(res.error || 'Action failed', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (portalCurrency && portalCurrency !== appCurrency) {
      await setAppCurrency(portalCurrency);
    }

    const wt = workTypesInput.split(',').map((s) => s.trim()).filter(Boolean);
    const vt = vehicleTypesInput.split(',').map((s) => s.trim()).filter(Boolean);
    const ec = categoriesInput.split(',').map((s) => s.trim()).filter(Boolean);

    const res = dataProvider.updateSettings({
      work_types: wt,
      vehicle_types: vt,
      expense_categories: ec,
      thresholds: {
        margin_warn: marginWarn / 100,
        staff_warn: staffWarn / 100,
        staff_bad: staffBad / 100,
        opex_warn: opexWarn / 100,
        opex_bad: opexBad / 100,
        unpaid_warn: unpaidWarn / 100,
        unpaid_bad: unpaidBad / 100,
        advance_warn: advanceWarn / 100,
        sales_drop_warn: salesDropWarn / 100,
        sales_drop_bad: salesDropBad / 100,
        expense_growth: expGrowthBad / 100,
      },
    });

    if (res.success) {
      showToast('Workshop settings saved successfully!', 'success');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to save settings', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t.team.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.team.subtitle}</p>
        </div>

        {activeSubTab === 'team' && isOwner && (
          <button
            onClick={() => setShowAddUserModal(true)}
            className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition self-start"
          >
            <Plus className="w-4 h-4" />
            {t.team.addUser}
          </button>
        )}
      </div>

      {/* Sub-Tabs: Team Members / Workshop Settings / Audit Log */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4 rtl:space-x-reverse text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveSubTab('team')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === 'team'
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          {t.team.teamTab} ({profiles.length})
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === 'settings'
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {t.team.settingsTab}
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === 'audit'
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          {t.team.auditTab} ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Team Members Roster */}
      {activeSubTab === 'team' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">{t.team.fullName}</th>
                  <th className="py-3 px-4">{t.team.username}</th>
                  <th className="py-3 px-4">{t.team.role}</th>
                  <th className="py-3 px-4">{t.team.payType}</th>
                  <th className="py-3 px-4">{t.common.status}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{p.full_name}</td>
                    <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400">@{p.username}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {p.pay_type === 'commission' ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Commission ({p.pay_rate}%)</span>
                      ) : p.pay_type === 'daily' && Number(p.pay_rate) === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                          Custom (Evening Decided)
                        </span>
                      ) : p.pay_type === 'daily' ? (
                        <span>Daily ({p.pay_rate} {portalCurrency})</span>
                      ) : p.pay_type === 'monthly' ? (
                        <span>Monthly ({p.pay_rate} {portalCurrency})</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right rtl:text-left space-x-2 rtl:space-x-reverse">
                      {isOwner && (
                        <>
                          <button
                            onClick={() => handleOpenEditPay(p)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[11px] font-semibold border border-blue-200 dark:border-blue-800/40"
                          >
                            Edit Rate
                          </button>
                          <button
                            onClick={() => setResetPassUser(p)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700"
                          >
                            Reset Pass
                          </button>
                          {p.role !== 'owner' && (
                            <button
                              onClick={() => handleToggleActive(p)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                                p.active
                                  ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800/30'
                                  : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/30'
                              }`}
                            >
                              {p.active ? t.team.deactivate : t.team.activate}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Workshop Settings & Warning Thresholds Editor */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Portal Currency & Regional Settings */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Portal Currency & Regional Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure your workshop's transaction currency (e.g. UAE Dirhams (AED), Indian Rupees (INR), etc.). This applies dynamically across all receipts, totals, and screens.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                Active: {portalCurrency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  Select Currency Preset
                </label>
                <select
                  value={['AED', 'INR', 'SAR', 'USD', 'OMR', 'QAR', 'KWD', 'BHD', 'EUR', 'GBP'].includes(portalCurrency) ? portalCurrency : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setPortalCurrency(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="AED">🇦🇪 AED - UAE Dirham</option>
                  <option value="INR">🇮🇳 INR - Indian Rupee (₹)</option>
                  <option value="SAR">🇸🇦 SAR - Saudi Riyal</option>
                  <option value="USD">🇺🇸 USD - US Dollar ($)</option>
                  <option value="OMR">🇴🇲 OMR - Omani Rial</option>
                  <option value="QAR">🇶🇦 QAR - Qatari Riyal</option>
                  <option value="KWD">🇰🇼 KWD - Kuwaiti Dinar</option>
                  <option value="BHD">🇧🇭 BHD - Bahraini Dinar</option>
                  <option value="EUR">🇪🇺 EUR - Euro (€)</option>
                  <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
                  <option value="custom">✏ Custom Currency Code...</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  Currency Symbol / ISO Code (Uppercase)
                </label>
                <input
                  type="text"
                  value={portalCurrency}
                  onChange={(e) => setPortalCurrency(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. AED, INR, USD"
                  maxLength={6}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Custom Services & Vehicle Types */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.team.workTypes} & Catalog
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  Work Types / Services (Comma-separated)
                </label>
                <input
                  type="text"
                  value={workTypesInput}
                  onChange={(e) => setWorkTypesInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  Vehicle Types (Comma-separated)
                </label>
                <input
                  type="text"
                  value={vehicleTypesInput}
                  onChange={(e) => setVehicleTypesInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                  Expense Categories (Comma-separated)
                </label>
                <input
                  type="text"
                  value={categoriesInput}
                  onChange={(e) => setCategoriesInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Diagnostic Thresholds */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {t.team.thresholds}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customizable percentages that trigger orange warnings and red alerts in financial reports.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Net Margin Warning (%)</span>
                <input
                  type="number"
                  value={marginWarn}
                  onChange={(e) => setMarginWarn(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Orange if net margin falls below this %</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Staff Cost Warning (%)</span>
                <input
                  type="number"
                  value={staffWarn}
                  onChange={(e) => setStaffWarn(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Orange if staff cost / revenue exceeds this %</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Staff Cost Critical (%)</span>
                <input
                  type="number"
                  value={staffBad}
                  onChange={(e) => setStaffBad(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Red alert if staff cost / revenue exceeds this %</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Operating Expenses Warn (%)</span>
                <input
                  type="number"
                  value={opexWarn}
                  onChange={(e) => setOpexWarn(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Orange if expenses / revenue exceeds this %</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Operating Expenses Bad (%)</span>
                <input
                  type="number"
                  value={opexBad}
                  onChange={(e) => setOpexBad(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Red alert if expenses / revenue exceeds this %</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Uncollected Revenue Bad (%)</span>
                <input
                  type="number"
                  value={unpaidBad}
                  onChange={(e) => setUnpaidBad(Number(e.target.value))}
                  className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Red alert if unpaid revenue exceeds this %</span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
              >
                {t.team.saveSettings}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: Audit Log Table */}
      {activeSubTab === 'audit' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">System & Provider Audit Trail</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Records all changes, provider actions, and deletions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {auditLogs.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{new Date(log.at).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{log.table_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'INSERT'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            : log.action === 'UPDATE'
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{log.user_id ? log.user_id.substring(0, 8) : 'System'}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate font-mono text-[11px]">
                      {JSON.stringify(log.new_data || log.old_data)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={auditPage}
            totalItems={auditLogs.length}
            pageSize={AUDIT_PAGE_SIZE}
            onPageChange={setAuditPage}
            itemName="audit logs"
          />
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.team.addUser}</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.fullName}</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Salim Al-Nuaimi"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.username}</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. salim"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white lowercase"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.role}</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AppRole)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="owner">Owner (Full Garage & Financial Access)</option>
                    <option value="manager">Manager (Operations, Jobs & Expenses)</option>
                    <option value="accountant">Accountant</option>
                    <option value="staff">Staff (Data Entry Only)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.payType}</label>
                  <select
                    value={newPayType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setNewPayType(val);
                      if (val === 'custom_daily') {
                        setNewPayRate('0');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="commission">Commission (% of Total Sales)</option>
                    <option value="daily">Fixed Daily Wage ({portalCurrency}/day)</option>
                    <option value="custom_daily">Custom / Evening Performance Salary</option>
                    <option value="monthly">Monthly Fixed Salary ({portalCurrency}/month)</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              {(newPayType as string) === 'custom_daily' ? (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Custom Performance Salary:</strong> No fixed rate. Evaluate worker in the evening and enter/pay their wage directly in Attendance.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.payRate}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPayRate}
                    onChange={(e) => setNewPayRate(e.target.value)}
                    placeholder="e.g. 35 for commission, 120 for daily"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.team.password}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Reset Password</h3>
              <button onClick={() => setResetPassUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Resetting password for: <strong className="text-slate-900 dark:text-white">@{resetPassUser.username}</strong>
              </p>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">New Password (min 8 chars)</label>
                <input
                  type="password"
                  value={updatedPassword}
                  onChange={(e) => setUpdatedPassword(e.target.value)}
                  placeholder="Enter new 8+ char password"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Pay Rate & Basis */}
      {editingPayStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Update Pay Basis</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingPayStaff.full_name} (@{editingPayStaff.username})
                </p>
              </div>
              <button
                onClick={() => setEditingPayStaff(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayRate} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Point-in-Time Lock Guarantee:</strong> Updating this rate applies <strong>only to new jobs and new attendance entries from this moment onward</strong>. All past jobs, previous attendance entries, and historical payroll remain locked at their historical rates!
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Compensation Type</label>
                <select
                  value={editPayType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setEditPayType(val);
                    if (val === 'custom_daily') {
                      setEditPayRate('0');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="commission">Commission (% of Total Job Sales: Price + Extra)</option>
                  <option value="daily">Fixed Daily Wage ({portalCurrency}/day present)</option>
                  <option value="custom_daily">Custom / Evening Performance Salary (Decided daily in evening)</option>
                  <option value="monthly">Monthly Fixed Salary ({portalCurrency}/month)</option>
                  <option value="none">None / Hourly / External</option>
                </select>
              </div>

              {(editPayType as string) === 'custom_daily' ? (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    <span>Custom / Evening Performance Salary</span>
                  </div>
                  <p className="leading-relaxed">
                    This staff member has no fixed salary. When they come to work, evaluate their performance in the evening and decide their salary for that day (e.g. 50, 75 {portalCurrency}). You can enter their pay and click <strong>Pay Cash</strong> directly in the Attendance Roll-Call screen.
                  </p>
                </div>
              ) : editPayType !== 'none' && (
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
                    {editPayType === 'commission'
                      ? 'Commission Rate (%)'
                      : editPayType === 'daily'
                      ? `Daily Wage (${portalCurrency}/day)`
                      : `Monthly Salary (${portalCurrency}/month)`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editPayRate}
                    onChange={(e) => setEditPayRate(e.target.value)}
                    placeholder="e.g. 35 for commission, 40 for daily, 4000 for monthly"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPayStaff(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/25 active:scale-95 transition"
                >
                  Save New Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
