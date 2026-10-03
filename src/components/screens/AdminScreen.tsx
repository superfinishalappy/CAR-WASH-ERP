'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Company, Profile } from '@/types/database';
import { getLocalDateString } from '@/lib/date-utils';
import {
  Building2,
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Trash2,
  KeyRound,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  X,
  ExternalLink,
} from 'lucide-react';

export function AdminScreen() {
  const { session, setActingCompany, setActiveTab, showToast, t, dataVersion, triggerRefresh } = useApp();

  const [activeTab, setActiveTabLocal] = useState<'companies' | 'superstaff'>('companies');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [superStaffList, setSuperStaffList] = useState<Profile[]>([]);

  // Modals
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [dateModalCompany, setDateModalCompany] = useState<Company | null>(null);
  const [customDate, setCustomDate] = useState('');

  // New Company Form State
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return getLocalDateString(d);
  });
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  // Super Staff Form State
  const [staffUsername, setStaffUsername] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Add User to Company State
  const [showAddCompanyUserModal, setShowAddCompanyUserModal] = useState(false);
  const [selectedCompanyForUser, setSelectedCompanyForUser] = useState<Company | null>(null);
  const [newCompanyUsername, setNewCompanyUsername] = useState('');
  const [newCompanyFullName, setNewCompanyFullName] = useState('');
  const [newCompanyRole, setNewCompanyRole] = useState<'owner' | 'manager' | 'accountant' | 'staff'>('owner');
  const [newCompanyPassword, setNewCompanyPassword] = useState('');
  const [newCompanyPayRate, setNewCompanyPayRate] = useState('');
  const [newCompanyPayType, setNewCompanyPayType] = useState<'none' | 'commission' | 'daily' | 'monthly'>('none');

  const role = session?.profile.role || '';
  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    const s = dataProvider.getCrossCompanySummaries();
    setSummaries(s);

    if (isSuperAdmin) {
      const ssl = dataProvider.getSuperStaffList();
      setSuperStaffList(ssl);
    }
  }, [dataVersion, isSuperAdmin]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (ownerPassword && ownerPassword.length < 8) {
      showToast('Owner password must be at least 8 characters long.', 'error');
      return;
    }

    const res = await dataProvider.createCompany({
      name: compName,
      code: compCode,
      valid_until: validUntil,
      owner_username: ownerUsername,
      owner_full_name: ownerFullName,
      owner_password: ownerPassword,
    });

    if (res.success && res.company) {
      showToast(`Company ${res.company.name} created successfully!`, 'success');
      setShowCreateCompanyModal(false);
      setCompName('');
      setCompCode('');
      setOwnerUsername('');
      setOwnerFullName('');
      setOwnerPassword('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to create company', 'error');
    }
  };

  const handleCreateUserForCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForUser) return;

    if (newCompanyPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    const res = await dataProvider.createCompanyUser({
      company_id: selectedCompanyForUser.id,
      username: newCompanyUsername,
      full_name: newCompanyFullName,
      role: newCompanyRole,
      password: newCompanyPassword,
      pay_type: newCompanyPayType,
      pay_rate: Number(newCompanyPayRate) || 0,
    });

    if (res.success) {
      showToast(`User ${newCompanyUsername} created for ${selectedCompanyForUser.name}! They can now log in.`, 'success');
      setShowAddCompanyUserModal(false);
      setSelectedCompanyForUser(null);
      setNewCompanyUsername('');
      setNewCompanyFullName('');
      setNewCompanyPassword('');
      setNewCompanyPayRate('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to create user', 'error');
    }
  };

  const handleAdd30Days = (companyId: string) => {
    const res = dataProvider.setSubscription(companyId, 'add_30_days');
    if (res.success) {
      showToast('Added 30 days to subscription!', 'success');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update subscription', 'error');
    }
  };

  const handleToggleSuspend = (companyId: string) => {
    const res = dataProvider.setSubscription(companyId, 'toggle_active');
    if (res.success) {
      showToast(
        `Company status changed to ${res.company?.active ? 'Active' : 'Suspended'}`,
        'info'
      );
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to toggle status', 'error');
    }
  };

  const handleSetCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateModalCompany || !customDate) return;

    const res = dataProvider.setSubscription(dateModalCompany.id, 'set_date', customDate);
    if (res.success) {
      showToast(`Subscription date updated to ${customDate}`, 'success');
      setDateModalCompany(null);
      setCustomDate('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update date', 'error');
    }
  };

  const handleDeleteCompany = (companyId: string, companyName: string) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin can delete a company.', 'error');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete company "${companyName}" and all associated jobs, users, and data?`)) {
      const res = dataProvider.deleteCompany(companyId);
      if (res.success) {
        showToast('Company deleted successfully.', 'info');
        triggerRefresh();
      } else {
        showToast(res.error || 'Failed to delete company', 'error');
      }
    }
  };

  const handleCreateSuperStaff = (e: React.FormEvent) => {
    e.preventDefault();

    if (staffPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    const res = dataProvider.createSuperStaff(staffUsername, staffFullName, staffPassword);
    if (res.success) {
      showToast(`Super Staff ${staffUsername} created!`, 'success');
      setShowCreateStaffModal(false);
      setStaffUsername('');
      setStaffFullName('');
      setStaffPassword('');
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to create super staff', 'error');
    }
  };

  const handleRemoveSuperStaff = (userId: string) => {
    if (confirm('Remove this Super Staff account?')) {
      const res = dataProvider.removeSuperStaff(userId);
      if (res.success) {
        showToast('Super Staff account removed', 'info');
        triggerRefresh();
      } else {
        showToast(res.error || 'Failed to remove', 'error');
      }
    }
  };

  const handleActAsCompany = (company: Company) => {
    setActingCompany(company);
    setActiveTab('vehicles');
    showToast(`Now acting in: ${company.name}`, 'info');
  };

  const totalPlatformRevenue = summaries.reduce((sum, s) => sum + s.thisMonthRevenue, 0);
  const activeCount = summaries.filter((s) => s.status === 'active').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            {t.admin.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.admin.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateCompanyModal(true)}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            {t.admin.createCompany}
          </button>
        </div>
      </div>

      {/* Global SaaS Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.admin.activeCompanies}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {activeCount} <span className="text-xs text-slate-400">/ {summaries.length} total</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Month Sales Across All Companies</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {totalPlatformRevenue.toFixed(2)} AED
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400">Platform Role Privileges</div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 leading-relaxed">
            {isSuperAdmin
              ? 'Super Admin: Full platform governance, subscription control & super staff administration.'
              : 'Super Staff: Full company switcher & operations across all workshops.'}
          </div>
        </div>
      </div>

      {/* Tabs: All Companies vs Super Staff Management */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4 rtl:space-x-reverse text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTabLocal('companies')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'companies'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t.admin.allCompanies} ({summaries.length})
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTabLocal('superstaff')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'superstaff'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {t.admin.superStaffTab} ({superStaffList.length})
          </button>
        )}
      </div>

      {/* Tab 1: Companies Grid & Management */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map(({ company, userCount, thisMonthRevenue, daysLeft, status }) => {
            const isSuspended = status === 'suspended';
            const isExpired = status === 'expired';

            return (
              <div
                key={company.id}
                className={`p-5 rounded-3xl bg-white dark:bg-slate-900/90 border shadow-md dark:shadow-xl flex flex-col justify-between space-y-4 backdrop-blur-md transition-colors ${
                  isSuspended
                    ? 'border-amber-300 dark:border-amber-700/60'
                    : isExpired
                    ? 'border-rose-300 dark:border-rose-700/60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">{company.name}</h3>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                        Company ID: <strong>{company.code}</strong>
                      </div>
                    </div>

                    {isSuspended ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                        Suspended
                      </span>
                    ) : isExpired ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Company stats card */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Valid Until:</span>
                      <strong className="text-slate-900 dark:text-slate-200 font-semibold">{company.valid_until}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Days Left:</span>
                      <strong className={daysLeft < 0 ? 'text-rose-600 dark:text-rose-400' : daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {daysLeft < 0 ? `Expired (${Math.abs(daysLeft)}d ago)` : `${daysLeft} days`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Users & Staff:</span>
                      <strong className="text-slate-900 dark:text-slate-200 font-semibold">{userCount} users</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>This Month Sales:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{thisMonthRevenue.toFixed(2)} AED</strong>
                    </div>
                  </div>
                </div>

                {/* Subscription & Switch Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {/* Enter Company & Add User Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleActAsCompany(company)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Enter & Work in {company.code}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCompanyForUser(company);
                        setShowAddCompanyUserModal(true);
                      }}
                      className="py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1 transition border border-blue-200 dark:border-blue-800/40"
                      title="Create Owner or Staff for this company"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      + User
                    </button>
                  </div>

                  {/* Subscription Controls (+30 Days, Set Date, Suspend, Delete) */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <button
                      onClick={() => handleAdd30Days(company.id)}
                      className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold transition text-center"
                    >
                      {t.admin.add30Days}
                    </button>

                    <button
                      onClick={() => {
                        setDateModalCompany(company);
                        setCustomDate(company.valid_until);
                      }}
                      className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition text-center border border-slate-200 dark:border-transparent"
                    >
                      {t.admin.editDate}
                    </button>

                    <button
                      onClick={() => handleToggleSuspend(company.id)}
                      className={`py-1.5 rounded-lg font-medium transition text-center ${
                        company.active
                          ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                          : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                      }`}
                    >
                      {company.active ? t.admin.suspend : t.admin.activate}
                    </button>
                  </div>

                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDeleteCompany(company.id, company.name)}
                      className="w-full py-1 text-center text-[10px] text-rose-600 hover:text-rose-500 dark:text-rose-400 transition"
                    >
                      Delete Company Permanently
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Super Staff Management (Super Admin only) */}
      {activeTab === 'superstaff' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateStaffModal(true)}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
            >
              <UserPlus className="w-4 h-4" />
              {t.admin.createSuperStaff}
            </button>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Synthetic Email</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {superStaffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{staff.full_name}</td>
                      <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">@{staff.username}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40">
                          Super Staff
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                        {staff.username}@admin.erp.local
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left">
                        <button
                          onClick={() => handleRemoveSuperStaff(staff.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                          title="Remove super staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.admin.createCompany}</h3>
              <button onClick={() => setShowCreateCompanyModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.admin.companyName}</label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="e.g. Desert Star Garage"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.admin.companyCode}</label>
                  <input
                    type="text"
                    value={compCode}
                    onChange={(e) => setCompCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DESERTSTAR"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">{t.admin.validUntil}</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-300">Default Owner Account:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">Owner Full Name</label>
                    <input
                      type="text"
                      value={ownerFullName}
                      onChange={(e) => setOwnerFullName(e.target.value)}
                      placeholder="e.g. Mansoor Ahmed"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">{t.admin.ownerUsername}</label>
                    <input
                      type="text"
                      value={ownerUsername}
                      onChange={(e) => setOwnerUsername(e.target.value.toLowerCase())}
                      placeholder="e.g. mansoor"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white lowercase"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">{t.admin.ownerPassword} (min 8 chars)</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCompanyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create Company & Owner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Subscription Date Modal */}
      {dateModalCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Set Expiry Date</h3>
              <button onClick={() => setDateModalCompany(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSetCustomDate} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Company: <strong className="text-slate-900 dark:text-white">{dateModalCompany.name}</strong>
              </p>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">New Expiry Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDateModalCompany(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Save Expiry Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Super Staff Modal */}
      {showCreateStaffModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.admin.createSuperStaff}</h3>
              <button onClick={() => setShowCreateStaffModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSuperStaff} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Full Name</label>
                <input
                  type="text"
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  placeholder="e.g. Zaid Support"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Username</label>
                <input
                  type="text"
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. zaid"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white lowercase"
                  required
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Uses Company ID: ADMIN</span>
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Password (min 8 chars)</label>
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add User to Company Modal */}
      {showAddCompanyUserModal && selectedCompanyForUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Add User / Owner
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                  Company: {selectedCompanyForUser.name} ({selectedCompanyForUser.code})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddCompanyUserModal(false);
                  setSelectedCompanyForUser(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserForCompany} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">User Role</label>
                <select
                  value={newCompanyRole}
                  onChange={(e) => setNewCompanyRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="owner">Owner (Full Garage & Financial Access)</option>
                  <option value="manager">Manager (Operations, Jobs & Expenses)</option>
                  <option value="accountant">Accountant (Customers, Invoices & Reports)</option>
                  <option value="staff">Staff / Technician</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Username</label>
                <input
                  type="text"
                  value={newCompanyUsername}
                  onChange={(e) => setNewCompanyUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. admin or tariq"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white lowercase"
                  required
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Will log in using Company ID: <strong>{selectedCompanyForUser.code}</strong>
                </span>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Full Name</label>
                <input
                  type="text"
                  value={newCompanyFullName}
                  onChange={(e) => setNewCompanyFullName(e.target.value)}
                  placeholder="e.g. Tariq Al-Mansoor"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Password (min 8 chars)</label>
                <input
                  type="password"
                  value={newCompanyPassword}
                  onChange={(e) => setNewCompanyPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCompanyUserModal(false);
                    setSelectedCompanyForUser(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create User & Enable Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
