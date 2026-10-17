'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Job, Profile, Customer } from '@/types/database';
import { Pagination } from '@/components/common/Pagination';
import { exportToCSV, printElement } from '@/lib/export';
import SqlConstraintFixModal from '@/components/common/SqlConstraintFixModal';
import { getTodayString, getYesterdayString, getLocalDateString, getFirstDayOfMonthString } from '@/lib/date-utils';
import { ProfessionalInvoiceModal } from '@/components/common/ProfessionalInvoiceModal';
import { PaymentDateModal } from '@/components/common/PaymentDateModal';
import {
  History,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  XCircle,
  CreditCard,
  Download,
  Printer,
  ChevronDown,
  Car,
  User,
  Users,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Edit2,
  Trash2,
  X,
  Clock,
  Sparkles,
  ArrowUpDown,
  Building,
  Phone,
  Banknote,
} from 'lucide-react';

export function SalesHistoryScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, currency } = useApp();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'all' | 'except_late' | 'late_paid' | 'paid' | 'unpaid'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all'); // 'all', 'walkin', 'registered', or customer.id
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Pagination (50 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Invoice & Edit Modals
  const [invoiceJob, setInvoiceJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [constraintModalJob, setConstraintModalJob] = useState<Job | null>(null);
  const [paymentModalJob, setPaymentModalJob] = useState<Job | null>(null);

  const role = session?.profile.role || 'staff';
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const isOwner = role === 'owner' || isPlatform;
  const isManager = role === 'manager';
  const isSeniorStaff = role === 'senior_staff';
  const canEdit = isOwner || isManager;
  const todayStr = getTodayString(session?.company?.timezone);

  // Load complete jobs history
  useEffect(() => {
    const allJobs = dataProvider.getJobs();
    setJobs(allJobs);

    const s = dataProvider.getCompanyProfiles().filter((p) => p.active);
    setStaffList(s);

    const c = dataProvider.getCustomers();
    setCustomerList(c);

    const settings = dataProvider.getSettings();
    setWorkTypes(settings.work_types);
    setVehicleTypes(settings.vehicle_types);
  }, [dataVersion]);

  // Date Range Calculation
  const getDateRange = () => {
    const tz = session?.company?.timezone;
    const todayStr = getTodayString(tz);

    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === 'yesterday') {
      const yStr = getYesterdayString(tz);
      return { start: yStr, end: yStr };
    }
    if (datePreset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      return { start: getLocalDateString(w, tz), end: todayStr };
    }
    if (datePreset === 'month') {
      return { start: getFirstDayOfMonthString(undefined, tz), end: todayStr };
    }
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    return null; // All time
  };

  // Base filtered jobs across date, customer, staff, work type, and search term (BEFORE payment status filter)
  const scopeJobs = useMemo(() => {
    const dateRange = getDateRange();

    return jobs.filter((job) => {
      // 1. Customer Filter
      if (customerFilter === 'walkin' && job.customer_id) return false;
      if (customerFilter === 'registered' && !job.customer_id) return false;
      if (customerFilter !== 'all' && customerFilter !== 'walkin' && customerFilter !== 'registered') {
        if (job.customer_id !== customerFilter) return false;
      }

      // 2. Staff Filter
      if (staffFilter !== 'all' && job.staff_id !== staffFilter) return false;

      // 3. Work Type Filter
      if (workTypeFilter !== 'all' && job.work_type !== workTypeFilter) return false;

      // 4. Date Filter (Includes vehicles washed in range OR old vehicles paid in range)
      if (dateRange) {
        const washedInRange = job.entry_date >= dateRange.start && job.entry_date <= dateRange.end;
        const paidInRange = Boolean(job.is_paid && job.payment_date && job.payment_date >= dateRange.start && job.payment_date <= dateRange.end);
        if (!washedInRange && !paidInRange) {
          return false;
        }
      }

      // 5. Search Term Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesPlate = (job.plate || '').toLowerCase().includes(q);
        const matchesMobile = (job.mobile || '').includes(q);
        const matchesCustomer = (job.customer_name || '').toLowerCase().includes(q);
        const matchesStaff = (job.staff_name || '').toLowerCase().includes(q);
        const matchesWork = (job.work_type || '').toLowerCase().includes(q);
        const matchesVehicle = (job.vehicle_type || '').toLowerCase().includes(q);
        if (!matchesPlate && !matchesMobile && !matchesCustomer && !matchesStaff && !matchesWork && !matchesVehicle) {
          return false;
        }
      }

      return true;
    });
  }, [
    jobs,
    customerFilter,
    staffFilter,
    workTypeFilter,
    datePreset,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  // Overall counts for filter tab badges in the current scope
  const filterCounts = useMemo(() => {
    const allCount = scopeJobs.length;
    const exceptLateCount = scopeJobs.filter((j) => !(j.is_paid && j.payment_date && j.payment_date !== j.entry_date)).length;
    const lateCount = scopeJobs.filter((j) => Boolean(j.is_paid && j.payment_date && j.payment_date !== j.entry_date)).length;
    const paidCount = scopeJobs.filter((j) => j.is_paid).length;
    const unpaidCount = scopeJobs.filter((j) => !j.is_paid).length;
    return { allCount, exceptLateCount, lateCount, paidCount, unpaidCount };
  }, [scopeJobs]);

  // Final filtered & sorted jobs applying statusFilter and sortBy
  const filteredJobs = useMemo(() => {
    return scopeJobs
      .filter((job) => {
        const isLatePaid = Boolean(job.is_paid && job.payment_date && job.payment_date !== job.entry_date);
        if (statusFilter === 'except_late' && isLatePaid) return false;
        if (statusFilter === 'late_paid' && !isLatePaid) return false;
        if (statusFilter === 'paid' && !job.is_paid) return false;
        if (statusFilter === 'unpaid' && job.is_paid) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const dateComp = b.entry_date.localeCompare(a.entry_date);
          if (dateComp !== 0) return dateComp;
          return (b.created_at || '').localeCompare(a.created_at || '');
        }
        if (sortBy === 'oldest') {
          const dateComp = a.entry_date.localeCompare(b.entry_date);
          if (dateComp !== 0) return dateComp;
          return (a.created_at || '').localeCompare(b.created_at || '');
        }
        if (sortBy === 'highest') {
          return b.total - a.total;
        }
        if (sortBy === 'lowest') {
          return a.total - b.total;
        }
        return 0;
      });
  }, [scopeJobs, statusFilter, sortBy]);

  // Summary Metrics calculated dynamically from filteredJobs (changes amount on top according to filter, like old!)
  const metrics = useMemo(() => {
    const totalCount = filteredJobs.length;
    const totalRevenue = filteredJobs.reduce((sum, j) => sum + j.total, 0);
    const totalBase = filteredJobs.reduce((sum, j) => sum + (j.price || 0), 0);
    const totalExtra = filteredJobs.reduce((sum, j) => sum + (j.extra_amount || 0), 0);
    const paidJobs = filteredJobs.filter((j) => j.is_paid);
    const unpaidJobs = filteredJobs.filter((j) => !j.is_paid);

    const paidRevenue = paidJobs.reduce((sum, j) => sum + j.total, 0);
    const unpaidRevenue = unpaidJobs.reduce((sum, j) => sum + j.total, 0);

    return {
      totalCount,
      totalRevenue,
      totalBase,
      totalExtra,
      paidCount: paidJobs.length,
      paidRevenue,
      unpaidCount: unpaidJobs.length,
      unpaidRevenue,
    };
  }, [filteredJobs]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, customerFilter, staffFilter, workTypeFilter, datePreset, customStartDate, customEndDate, searchTerm, sortBy]);

  // Paginated Sliced Jobs (50 per page)
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredJobs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredJobs, currentPage]);

  // Quick 1-Click Toggle Paid / Unpaid Status
  const handleTogglePayment = async (job: Job) => {
    if (!job.is_paid) {
      if (job.entry_date === todayStr) {
        // Today's service marked on today: directly mark as paid today in 1-click!
        await handleConfirmPayment(job, todayStr);
        return;
      }
      // Marking after that same day (late payment): show option late/pick date!
      setPaymentModalJob(job);
      return;
    }

    // Reverting to UNPAID
    const newStatus = false;
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_paid: false, payment_date: undefined } : j))
    );

    const res = await dataProvider.setJobPaymentStatus(job.id, false);
    if (res.success) {
      showToast(`↩ Vehicle ${job.plate || job.work_type} marked as UNPAID!`, 'info');
      triggerRefresh();
    } else {
      // Revert if error
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_paid: true, payment_date: job.payment_date } : j))
      );
      showToast(res.error || 'Failed to update payment status', 'error');
    }
  };

  const handleConfirmPayment = async (job: Job, paymentDate: string) => {
    setPaymentModalJob(null);

    // Optimistic local update for instant feedback
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_paid: true, payment_date: paymentDate } : j))
    );

    const res = await dataProvider.setJobPaymentStatus(job.id, true, false, paymentDate);
    if (res.success) {
      const cust = job.customer_id ? customerList.find((c) => c.id === job.customer_id) : null;
      showToast(
        cust
          ? `✓ Vehicle ${job.plate || job.work_type} marked as PAID on ${paymentDate} (${job.total.toFixed(2)} ${currency})! Customer ${cust.name}'s balance reduced.`
          : `✓ Vehicle ${job.plate || job.work_type} marked as PAID on ${paymentDate} (${job.total.toFixed(2)} ${currency})!`,
        'success'
      );
      if (res.isConstraintError) {
        setConstraintModalJob(job);
      }
      triggerRefresh();
    } else {
      // Revert if error
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_paid: job.is_paid, payment_date: job.payment_date } : j))
      );
      if (res.isConstraintError) {
        setConstraintModalJob(job);
      } else {
        showToast(res.error || 'Failed to update payment status', 'error');
      }
    }
  };

  const handleRetryAfterSql = async () => {
    if (!constraintModalJob) return;
    const tz = session?.company?.timezone;
    const todayStr = getTodayString(tz);
    const payDate = constraintModalJob.payment_date || todayStr;
    const res = await dataProvider.setJobPaymentStatus(constraintModalJob.id, true, false, payDate);
    if (res.success) {
      setJobs((prev) =>
        prev.map((j) => (j.id === constraintModalJob.id ? { ...j, is_paid: true, payment_date: payDate } : j))
      );
      const cust = constraintModalJob.customer_id ? customerList.find((c) => c.id === constraintModalJob.customer_id) : null;
      showToast(
        `✓ Database constraint cleared! Vehicle marked as PAID on ${payDate} (${constraintModalJob.total.toFixed(2)} ${currency})!${cust ? ` ${cust.name} balance reduced.` : ''}`,
        'success'
      );
      setConstraintModalJob(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Constraint still active in database. Did you click Run in Supabase SQL editor?', 'error');
    }
  };

  const handleMarkLocally = async () => {
    if (!constraintModalJob) return;
    const tz = session?.company?.timezone;
    const todayStr = getTodayString(tz);
    const payDate = constraintModalJob.payment_date || todayStr;
    await dataProvider.setJobPaymentStatus(constraintModalJob.id, true, true, payDate);
    setJobs((prev) =>
      prev.map((j) => (j.id === constraintModalJob.id ? { ...j, is_paid: true, payment_date: payDate } : j))
    );
    showToast(`✓ Marked as PAID in local session! Customer balance updated.`, 'success');
    setConstraintModalJob(null);
    triggerRefresh();
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredJobs.length === 0) {
      showToast('No sales data to export', 'warning');
      return;
    }
    const rows = filteredJobs.map((j) => ({
      Date: j.entry_date,
      Plate: j.plate || 'NO PLATE',
      Mobile: j.mobile || '',
      Customer: j.customer_name || 'Walk-in',
      Service: j.work_type,
      'Vehicle Type': j.vehicle_type,
      Staff: j.staff_name,
      'Base Price': j.price.toFixed(2),
      Extra: j.extra_amount.toFixed(2),
      Total: j.total.toFixed(2),
      'Payment Status': j.is_paid
        ? j.payment_date && j.payment_date !== j.entry_date
          ? `PAID LATE (${j.payment_date})`
          : `PAID (${j.payment_date || j.entry_date})`
        : 'UNPAID',
    }));
    exportToCSV(`sales_history_${getTodayString(session?.company?.timezone)}`, rows);
    showToast('Exported sales history to CSV', 'success');
  };

  // Print Filtered Sales List
  const handlePrintTable = () => {
    const compName = session?.company?.name || 'Super Finish';
    printElement('sales-history-printable', `${compName} - Sales History`);
  };

  // Handle Edit Job
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    const todayStr = getTodayString(session?.company?.timezone);
    const resolvedPaymentDate = editingJob.is_paid ? (editingJob.payment_date || todayStr) : undefined;

    const res = dataProvider.updateJob(editingJob.id, {
      plate: editingJob.plate || undefined,
      mobile: editingJob.mobile || undefined,
      work_type: editingJob.work_type,
      vehicle_type: editingJob.vehicle_type,
      staff_id: editingJob.staff_id,
      price: editingJob.price,
      extra_amount: editingJob.extra_amount,
      customer_id: editingJob.customer_id,
      is_paid: editingJob.is_paid,
      entry_date: editingJob.entry_date,
      payment_date: resolvedPaymentDate,
    });

    if (res.success) {
      showToast('Sales record updated successfully', 'success');
      const updatedStaff = staffList.find((s) => s.id === editingJob.staff_id);
      const updatedCustomer = customerList.find((c) => c.id === editingJob.customer_id);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === editingJob.id
            ? {
                ...j,
                ...editingJob,
                payment_date: resolvedPaymentDate,
                staff_name: updatedStaff?.full_name || j.staff_name,
                customer_name: updatedCustomer?.name || (editingJob.customer_id ? j.customer_name : undefined),
              }
            : j
        )
      );
      setEditingJob(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update vehicle', 'error');
    }
  };

  // Handle Delete Job
  const handleDeleteJob = () => {
    if (!deletingJobId) return;
    const res = dataProvider.deleteJob(deletingJobId);
    if (res.success) {
      showToast('Vehicle entry deleted', 'info');
      setDeletingJobId(null);
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to delete vehicle', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            Complete Sales History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Audit, track, and filter all paid and unpaid customer jobs with 1-click status updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Export CSV
          </button>
          <button
            onClick={handlePrintTable}
            className="py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print List
          </button>
        </div>
      </div>

      {/* Top Summary KPI Cards - Total Sales, Base Amount, Extra Amount, Paid, Unpaid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Sales / Revenue */}
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900/90 border transition cursor-pointer shadow-sm hover:shadow-md backdrop-blur-md ${
            statusFilter === 'all'
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-600 dark:text-blue-400">Total Sales</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 truncate">
            {metrics.totalRevenue.toFixed(2)}{' '}
            <span className="text-xs font-bold text-slate-400">{currency}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-semibold flex items-center justify-between">
            <span>{metrics.totalCount} orders</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">View All →</span>
          </div>
        </div>

        {/* 2. Base Amount */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-600 dark:text-indigo-400">Base Amount</span>
            <Car className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 truncate">
            {metrics.totalBase.toFixed(2)}{' '}
            <span className="text-xs font-bold text-slate-400">{currency}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Standard Base Price
          </div>
        </div>

        {/* 3. Extra Amount */}
        <div className="p-4 sm:p-5 rounded-3xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-400 font-medium">
            <span className="font-bold uppercase tracking-wider text-[11px]">Extra Amount</span>
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-900 dark:text-purple-200 mt-2 truncate">
            {metrics.totalExtra.toFixed(2)}{' '}
            <span className="text-xs font-bold text-purple-600/70">{currency}</span>
          </div>
          <div className="text-xs text-purple-700/80 dark:text-purple-400/80 mt-1 font-medium">
            Polish, Parts & Add-ons
          </div>
        </div>

        {/* 4. Total Cash (Paid / Collected) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
          className={`p-4 sm:p-5 rounded-3xl bg-emerald-50/80 dark:bg-emerald-950/20 border transition cursor-pointer shadow-sm hover:shadow-md backdrop-blur-md ${
            statusFilter === 'paid'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-emerald-200 dark:border-emerald-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="font-bold uppercase tracking-wider text-[11px]">Paid (Total Cash)</span>
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-2 truncate">
            {metrics.paidRevenue.toFixed(2)}{' '}
            <span className="text-xs font-bold text-emerald-600/70">{currency}</span>
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-semibold flex items-center justify-between">
            <span>{metrics.paidCount} paid orders</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Filter Cash →</span>
          </div>
        </div>

        {/* 5. Total Unpaid / Credit Due */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'unpaid' ? 'all' : 'unpaid')}
          className={`p-4 sm:p-5 rounded-3xl bg-rose-50/70 dark:bg-rose-950/20 border transition cursor-pointer shadow-sm hover:shadow-md backdrop-blur-md col-span-2 sm:col-span-1 ${
            statusFilter === 'unpaid'
              ? 'border-rose-500 ring-2 ring-rose-500/20'
              : 'border-rose-200 dark:border-rose-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-medium">
            <span className="font-bold uppercase tracking-wider text-[11px]">Unpaid / Due</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-2 truncate">
            {metrics.unpaidRevenue.toFixed(2)}{' '}
            <span className="text-xs font-bold text-rose-600/70">{currency}</span>
          </div>
          <div className="text-xs text-rose-700 dark:text-rose-400 mt-1 font-semibold flex items-center justify-between">
            <span>{metrics.unpaidCount} unpaid/credit</span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Filter Unpaid →</span>
          </div>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        {/* Row 1: Payment Status Tabs (All, Except Late Paid, Late Paid, Paid Only, Unpaid Only) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center flex-wrap gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>All Sales</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{filterCounts.allCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter('except_late')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'except_late'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40'
              }`}
              title="Today's sales excluding older recovered payments"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Except Late Paid</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{filterCounts.exceptLateCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter('late_paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'late_paid'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
              }`}
              title="Old jobs from prior days collected on this date"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              <span>Late Paid</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{filterCounts.lateCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Paid Only</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{filterCounts.paidCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Unpaid Only</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{filterCounts.unpaidCount}</span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Date:</span>
            {[
                            { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              ...(isOwner || isManager || isSeniorStaff ? [{ id: 'month', label: 'This Month' }, { id: 'custom', label: 'Custom Range' }] : []),
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDatePreset(d.id as any)}
                className={`px-2.5 py-1.5 rounded-xl font-medium transition ${
                  datePreset === d.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers (if Custom Range is selected) */}
        {datePreset === 'custom' && (
          <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
            <span className="font-bold text-indigo-900 dark:text-indigo-300">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Row 2: Secondary Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plate, phone, vehicle, name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="all">👥 All Customers (Walk-in & Account)</option>
              <option value="walkin">🚶 Walk-in Customers Only</option>
              <option value="registered">🏢 Registered Credit Accounts Only</option>
              <optgroup label="Specific Customer Accounts">
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Service / Work Type Filter */}
          <div>
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="all">🔧 All Services / Work Types</option>
              {workTypes.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="all">👤 All Technicians / Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Sort & Active Filter Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>

          {(statusFilter !== 'all' || customerFilter !== 'all' || staffFilter !== 'all' || workTypeFilter !== 'all' || datePreset !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setCustomerFilter('all');
                setStaffFilter('all');
                setWorkTypeFilter('all');
                setDatePreset('all');
                setSearchTerm('');
              }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales History Table Card */}
      <div id="sales-history-printable" className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
              Sales Records ({filteredJobs.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing 50 sales per page with 1-click Paid / Unpaid switch
            </p>
          </div>

          {/* Quick Info Tag */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
              Paid: {metrics.paidCount} ({metrics.paidRevenue.toFixed(2)} {currency})
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
              Unpaid: {metrics.unpaidCount} ({metrics.unpaidRevenue.toFixed(2)} {currency})
            </span>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">No sales match your active filters</div>
            <p className="text-xs text-slate-400">Try adjusting your date range, customer, or payment status filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plate / Vehicle</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-4 text-right rtl:text-left">Base Amount ({currency})</th>
                    <th className="py-3 px-4 text-right rtl:text-left">Extra Amount ({currency})</th>
                    <th className="py-3 px-4 text-right rtl:text-left">Total ({currency})</th>
                    <th className="py-3 px-4">Payment Status & Toggle</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {paginatedJobs.map((job) => {
                    const isCredit = Boolean(job.customer_id);

                    return (
                      <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        {/* 1. Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-200 font-mono text-xs">
                            {job.entry_date}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {job.created_at ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                        </td>

                        {/* 2. Plate & Vehicle */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {job.photo_url && (
                              <img 
                                src={job.photo_url} 
                                alt="Vehicle" 
                                className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm hover:opacity-80 transition"
                                onClick={() => setSelectedPhoto(job.photo_url!)}
                                title="Show Vehicle"
                              />
                            )}
                            <div>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block border border-slate-200 dark:border-slate-700">
                                {job.plate || 'NO PLATE'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {job.vehicle_type}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Customer */}
                        <td className="py-3 px-4">
                          {isCredit ? (
                            <div>
                              <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                <Building className="w-3 h-3 text-blue-500" />
                                {job.customer_name}
                              </span>
                              {job.mobile ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono">{job.mobile}</span>
                                  <a
                                    href={`tel:${job.mobile}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/40 font-bold text-[9px] transition"
                                    title="Call Customer"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Call</span>
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">-</span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                Walk-in
                              </span>
                              {job.mobile ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono">{job.mobile}</span>
                                  <a
                                    href={`tel:${job.mobile}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/40 font-bold text-[9px] transition"
                                    title="Call Customer"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Call</span>
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 block font-mono">-</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Service */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{job.work_type}</span>
                        </td>

                        {/* 5. Staff */}
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {job.staff_name}
                        </td>

                        {/* 6. Base Amount */}
                        <td className="py-3 px-4 text-right rtl:text-left font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {job.price.toFixed(2)}
                        </td>

                        {/* 7. Extra Amount */}
                        <td className="py-3 px-4 text-right rtl:text-left">
                          {job.extra_amount > 0 ? (
                            <span className="font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/40 font-mono">
                              +{job.extra_amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0.00</span>
                          )}
                        </td>

                        {/* 8. Total Amount */}
                        <td className="py-3 px-4 text-right rtl:text-left">
                          <div className="font-black text-slate-900 dark:text-slate-100 text-sm font-mono">
                            {job.total.toFixed(2)}
                          </div>
                        </td>

                        {/* 7. Payment Status & Quick 1-Click Toggle */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Current Status Badge with Date Distinction */}
                            {(() => {
                              const isPaidLate = Boolean(job.is_paid && job.payment_date && job.payment_date !== job.entry_date);
                              const payDateDisplay = job.payment_date || job.entry_date;
                              if (isPaidLate) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setPaymentModalJob(job)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60 shadow-sm transition cursor-pointer"
                                    title={`Service Date: ${job.entry_date} → Paid on: ${job.payment_date}. Click to change payment date.`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                    PAID LATE ({job.payment_date})
                                    <Calendar className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                  </button>
                                );
                              }
                              if (job.is_paid) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setPaymentModalJob(job)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 transition cursor-pointer"
                                    title="Click to change payment date"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    PAID ({payDateDisplay})
                                    <Calendar className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                  </button>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  UNPAID
                                </span>
                              );
                            })()}

                            {/* Payment Actions: Change Date & Toggle Paid/Unpaid */}
                            <div className="inline-flex items-center gap-1">
                              {job.is_paid && (
                                <button
                                  type="button"
                                  onClick={() => setPaymentModalJob(job)}
                                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 transition shadow-sm"
                                  title="Change Payment Date"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleTogglePayment(job)}
                                className={`py-1 px-2.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-sm ${
                                  job.is_paid
                                    ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 font-extrabold'
                                }`}
                                title={job.is_paid ? 'Click to mark this transaction as UNPAID' : 'Click to mark this transaction as PAID'}
                              >
                                {job.is_paid ? (
                                  <>
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Mark Unpaid</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Mark as Paid</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 8. Actions (Receipt / Edit / Delete) */}
                        <td className="py-3 px-4 text-right rtl:text-left space-x-1.5 rtl:space-x-reverse whitespace-nowrap">
                          <button
                            onClick={() => setInvoiceJob(job)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 transition"
                            title="Print / View Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => setEditingJob(job)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              title="Edit Record & Assigned Staff"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => setDeletingJobId(job.id)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-950/90 text-slate-800 dark:text-slate-200 font-bold border-t-2 border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <td colSpan={5} className="py-3.5 px-4 font-semibold text-slate-500 dark:text-slate-400">
                      Totals for filtered view ({filteredJobs.length} orders):
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left font-mono font-bold text-slate-900 dark:text-white">
                      {metrics.totalBase.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left font-mono font-bold text-purple-600 dark:text-purple-400">
                      {metrics.totalExtra > 0 ? `+${metrics.totalExtra.toFixed(2)}` : '0.00'}
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                      {metrics.totalRevenue.toFixed(2)}
                    </td>
                    <td colSpan={2} className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-sm">
                        <Banknote className="w-3.5 h-3.5" />
                        Total Cash: {metrics.paidRevenue.toFixed(2)} {currency}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="md:hidden p-3 space-y-3">
              {paginatedJobs.map((job) => {
                const isCredit = Boolean(job.customer_id);

                return (
                  <div
                    key={job.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      job.is_paid
                        ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
                        : 'bg-gradient-to-br from-rose-50/40 via-white to-white dark:from-rose-950/20 dark:via-slate-900/90 dark:to-slate-900 border-rose-200/80 dark:border-rose-800/50 shadow-md shadow-rose-950/5 ring-1 ring-rose-500/20'
                    }`}
                  >
                    {/* Header: Date, Plate & Action icons */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.photo_url && (
                            <img 
                              src={job.photo_url} 
                              alt="Vehicle" 
                              className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm hover:opacity-80 transition"
                              onClick={() => setSelectedPhoto(job.photo_url!)}
                              title="Show Vehicle"
                            />
                          )}
                          <span className="font-mono font-black text-sm px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 tracking-wider shadow-sm">
                            {job.plate || 'NO PLATE'}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                            {job.vehicle_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono flex-wrap">
                          <Clock className="w-3 h-3" />
                          <span>Washed: {job.entry_date}</span>
                          {job.is_paid ? (
                            <button
                              type="button"
                              onClick={() => setPaymentModalJob(job)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                                job.payment_date && job.payment_date !== job.entry_date
                                  ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-300 border border-purple-300'
                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300'
                              }`}
                              title="Click to change payment date"
                            >
                              <span>• Paid: {job.payment_date || job.entry_date}</span>
                              <Calendar className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                            </button>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                              • ✗ Unpaid
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInvoiceJob(job)}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"
                          title="Print / View Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditingJob(job)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            title="Edit Record & Assigned Staff"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isOwner && (
                          <button
                            onClick={() => setDeletingJobId(job.id)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:border-rose-800/30"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details: Customer, Service, Staff, Base, Extra, Total */}
                    <div className="py-2.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Customer:</span>
                        {isCredit ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/50">
                            {job.customer_name}
                          </span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">Walk-in</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Service:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{job.work_type}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Staff:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{job.staff_name}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Base Amount:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {job.price.toFixed(2)} {currency}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Extra Amount:</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono">
                          {job.extra_amount > 0 ? `+${job.extra_amount.toFixed(2)}` : '0.00'} {currency}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-medium">Total Amount</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                            {job.total.toFixed(2)}{' '}
                            <span className="text-xs font-semibold text-slate-400">{currency}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 1-Click Touch Friendly Payment Button (44px height) */}
                    <div className="pt-2 space-y-1.5">
                      <button
                        onClick={() => handleTogglePayment(job)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] ${
                          job.is_paid
                            ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                        }`}
                      >
                        {job.is_paid ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mark Unpaid</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Mark as Paid</span>
                          </>
                        )}
                      </button>
                      {job.is_paid && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalJob(job)}
                          className="w-full py-2 px-3 rounded-xl text-[11px] font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Change Payment Date ({job.payment_date || job.entry_date})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 50-Items-per-Page Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredJobs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="sales transactions"
        />
      </div>

      {/* Professional Invoice / Receipt Modal */}
      {invoiceJob && (
        <ProfessionalInvoiceModal
          job={invoiceJob}
          company={session?.company || null}
          currency={currency}
          onClose={() => setInvoiceJob(null)}
          onTogglePayment={handleTogglePayment}
        />
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Sales Record</h3>
              <button
                onClick={() => setEditingJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Plate Number</label>
                  <input
                    type="text"
                    value={editingJob.plate || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, plate: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Customer Mobile</label>
                  <input
                    type="text"
                    value={editingJob.mobile || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, mobile: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Work Type</label>
                  <select
                    value={editingJob.work_type}
                    onChange={(e) => setEditingJob({ ...editingJob, work_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {workTypes.map((wt) => (
                      <option key={wt} value={wt}>
                        {wt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Vehicle Type</label>
                  <select
                    value={editingJob.vehicle_type}
                    onChange={(e) => setEditingJob({ ...editingJob, vehicle_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {vehicleTypes.map((vt) => (
                      <option key={vt} value={vt}>
                        {vt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Base Price ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={editingJob.price}
                    onChange={(e) => {
                      const p = Number(e.target.value) || 0;
                      setEditingJob({ ...editingJob, price: p, total: p + editingJob.extra_amount });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Extra Amount ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={editingJob.extra_amount}
                    onChange={(e) => {
                      const ext = Number(e.target.value) || 0;
                      setEditingJob({ ...editingJob, extra_amount: ext, total: editingJob.price + ext });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Assigned Staff</label>
                  <select
                    value={editingJob.staff_id}
                    onChange={(e) => setEditingJob({ ...editingJob, staff_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {s.role ? `(${s.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Customer Account</label>
                  <select
                    value={editingJob.customer_id || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, customer_id: e.target.value || null })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Walk-in Customer</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">Payment Status</label>
                <select
                  value={editingJob.is_paid ? 'paid' : 'unpaid'}
                  onChange={(e) => {
                    const isPaid = e.target.value === 'paid';
                    const tz = session?.company?.timezone;
                    const todayStr = getTodayString(tz);
                    setEditingJob({
                      ...editingJob,
                      is_paid: isPaid,
                      payment_date: isPaid ? (editingJob.payment_date || todayStr) : undefined,
                    });
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="paid">{editingJob.customer_id ? '✓ PAID (Paid at Counter)' : '✓ PAID (Cash/Card)'}</option>
                  <option value="unpaid">{editingJob.customer_id ? '💳 UNPAID (Customer Credit)' : '✗ UNPAID'}</option>
                </select>

                {editingJob.is_paid && (
                  <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Payment Date</span>
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const tz = session?.company?.timezone;
                            const todayStr = getTodayString(tz);
                            setEditingJob({ ...editingJob, payment_date: todayStr });
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        >
                          Today
                        </button>
                        {editingJob.entry_date && (
                          <button
                            type="button"
                            onClick={() => setEditingJob({ ...editingJob, payment_date: editingJob.entry_date })}
                            className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          >
                            Wash Date ({editingJob.entry_date})
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="date"
                      value={editingJob.payment_date || getTodayString(session?.company?.timezone)}
                      onChange={(e) => setEditingJob({ ...editingJob, payment_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      required
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {editingJob.payment_date && editingJob.payment_date !== editingJob.entry_date ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          Recorded as Late Payment on {editingJob.payment_date} (Washed on {editingJob.entry_date})
                        </span>
                      ) : (
                        <span>Paid on wash date ({editingJob.entry_date})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Total: <span className="text-blue-600">{(editingJob.price + editingJob.extra_amount).toFixed(2)} {currency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingJob(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingJobId && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Sales Record?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently delete this vehicle and sales record? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingJobId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteJob}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Constraint Fix Modal */}
      <SqlConstraintFixModal
        isOpen={Boolean(constraintModalJob)}
        onClose={() => setConstraintModalJob(null)}
        onRetry={handleRetryAfterSql}
        onMarkLocally={handleMarkLocally}
        vehicleInfo={
          constraintModalJob
            ? {
                plate: constraintModalJob.plate,
                workType: constraintModalJob.work_type,
                customerName: customerList.find((c) => c.id === constraintModalJob.customer_id)?.name,
                total: constraintModalJob.total,
                currency,
              }
            : undefined
        }
      />
      {/* Photo enlarge modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div className="max-w-[90vw] max-h-[80vh] bg-white dark:bg-slate-900 rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-slate-500 hover:text-slate-800" onClick={() => setSelectedPhoto(null)}>
              <X className="w-5 h-5" />
            </button>
            <img src={selectedPhoto} alt="Vehicle enlarged" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}
      {/* Payment Date Picker Modal (Late/Custom/Default Today) */}
      <PaymentDateModal
        job={paymentModalJob}
        isOpen={Boolean(paymentModalJob)}
        onClose={() => setPaymentModalJob(null)}
        onConfirm={handleConfirmPayment}
        timezone={session?.company?.timezone}
        currency={currency}
      />
    </div>
  );
}
