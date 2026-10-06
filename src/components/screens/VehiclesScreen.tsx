'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { dataProvider } from '@/lib/data-provider';
import { Job, Profile, Customer } from '@/types/database';
import {
  Car,
  Plus,
  Calendar,
  Phone,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  DollarSign,
  UserCheck,
  CreditCard,
  X,
  Search,
  History,
  RotateCcw,
  CalendarCheck,
  Receipt,
  Printer,
  Camera,
} from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
import SqlConstraintFixModal from '@/components/common/SqlConstraintFixModal';
import { getTodayString, getYesterdayString } from '@/lib/date-utils';
import { ProfessionalInvoiceModal } from '@/components/common/ProfessionalInvoiceModal';
import { supabase } from '@/lib/supabase';

export function VehiclesScreen() {
  const { session, showToast, t, dataVersion, triggerRefresh, setActiveTab, currency } = useApp();

  const todayStr = getTodayString(session?.company?.timezone);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  // Attendance & Present Staff Filter
  const [showOnlyPresentStaff, setShowOnlyPresentStaff] = useState<boolean>(true);
  const [presentStaffIds, setPresentStaffIds] = useState<string[]>([]);

  // Form State
  const [mobile, setMobile] = useState('');
  const [plate, setPlate] = useState('');
  const [workType, setWorkType] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [staffId, setStaffId] = useState('');
  const [price, setPrice] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Photo handling state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  // Modal state for enlarged vehicle image preview
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Edit / Delete / Invoice Modal State
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [constraintModalJob, setConstraintModalJob] = useState<Job | null>(null);
  const [invoiceJob, setInvoiceJob] = useState<Job | null>(null);

  // Customer Warning State
  const [selectedCustomerWarning, setSelectedCustomerWarning] = useState<string | null>(null);

  const role = session?.profile.role || 'staff';
  const isPlatform = ['superadmin', 'superstaff'].includes(role);
  const isOwner = role === 'owner' || isPlatform;
  const isManager = role === 'manager';

  const canAddSelectedDate = isOwner || selectedDate === todayStr;

  useEffect(() => {
    const j = dataProvider.getJobs(selectedDate);
    setJobs(j);

    const s = dataProvider.getCompanyProfiles().filter((p) => p.active);
    setStaffList(s);

    const att = dataProvider.getAttendance(selectedDate);
    const presentIds = att.filter((a) => a.status === 'present').map((a) => a.staff_id);
    setPresentStaffIds(presentIds);

    const c = dataProvider.getCustomers();
    setCustomerList(c);

    const settings = dataProvider.getSettings();
    setWorkTypes(settings.work_types);
    if (!workType && settings.work_types.length > 0) setWorkType(settings.work_types[0]);

    setVehicleTypes(settings.vehicle_types);
    if (!vehicleType && settings.vehicle_types.length > 0) setVehicleType(settings.vehicle_types[0]);
  }, [selectedDate, dataVersion]);

  // Filter staff to Present technicians when attendance has been marked
  const availableStaff = React.useMemo(() => {
    if (showOnlyPresentStaff && presentStaffIds.length > 0) {
      const filtered = staffList.filter((s) => presentStaffIds.includes(s.id));
      return filtered.length > 0 ? filtered : staffList;
    }
    return staffList;
  }, [staffList, presentStaffIds, showOnlyPresentStaff]);

  useEffect(() => {
    if (availableStaff.length > 0) {
      if (!staffId || !availableStaff.some((s) => s.id === staffId)) {
        setStaffId(availableStaff[0].id);
      }
    }
  }, [availableStaff, staffId]);

  // Check customer credit limit warning when selecting customer or typing price
  useEffect(() => {
    if (!customerId) {
      setSelectedCustomerWarning(null);
      return;
    }
    const cust = customerList.find((c) => c.id === customerId);
    if (!cust || cust.credit_limit <= 0) {
      setSelectedCustomerWarning(null);
      return;
    }

    const currentBal = cust.current_balance || 0;
    const addedAmount = (Number(price) || 0) + (Number(extraAmount) || 0);
    const projected = currentBal + addedAmount;

    if (projected > cust.credit_limit) {
      setSelectedCustomerWarning(
        `OVER CREDIT LIMIT: Customer balance will reach ${projected.toFixed(2)} (Limit: ${cust.credit_limit}). Call customer for payment!`
      );
    } else if (projected >= cust.credit_limit * 0.8) {
      setSelectedCustomerWarning(
        `NEAR CREDIT LIMIT: Balance will reach ${projected.toFixed(2)} (80% of limit ${cust.credit_limit}).`
      );
    } else {
      setSelectedCustomerWarning(null);
    }
  }, [customerId, price, extraAmount, customerList]);

  // Quick Date Selectors
  const setQuickDate = (mode: 'today' | 'yesterday') => {
    if (mode === 'today') {
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(getYesterdayString(session?.company?.timezone));
    }
  };

  const handleTogglePayment = async (job: Job) => {
    const newStatus = !job.is_paid;
    // Optimistic local update for instant feedback
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_paid: newStatus } : j))
    );

    const res = await dataProvider.toggleJobPayment(job.id);
    if (res.success) {
      const cust = job.customer_id ? customerList.find((c) => c.id === job.customer_id) : null;
      showToast(
        newStatus
          ? cust
            ? `✓ Vehicle ${job.plate || job.work_type} marked as PAID (${job.total.toFixed(2)} ${currency})! Customer ${cust.name}'s balance reduced.`
            : `✓ Vehicle ${job.plate || job.work_type} marked as PAID (${job.total.toFixed(2)} ${currency})!`
          : `↩ Vehicle ${job.plate || job.work_type} marked as UNPAID!`,
        newStatus ? 'success' : 'info'
      );
      triggerRefresh();
    } else {
      // Revert if error
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_paid: !newStatus } : j))
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
    const res = await dataProvider.toggleJobPayment(constraintModalJob.id);
    if (res.success) {
      setJobs((prev) =>
        prev.map((j) => (j.id === constraintModalJob.id ? { ...j, is_paid: !constraintModalJob.is_paid } : j))
      );
      const cust = constraintModalJob.customer_id ? customerList.find((c) => c.id === constraintModalJob.customer_id) : null;
      showToast(
        `✓ Database constraint cleared! Vehicle marked as PAID (${constraintModalJob.total.toFixed(2)} ${currency})!${cust ? ` ${cust.name} balance reduced.` : ''}`,
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
    await dataProvider.toggleJobPayment(constraintModalJob.id, true);
    setJobs((prev) =>
      prev.map((j) => (j.id === constraintModalJob.id ? { ...j, is_paid: !constraintModalJob.is_paid } : j))
    );
    showToast(`✓ Marked as PAID in local session! Customer balance updated.`, 'success');
    setConstraintModalJob(null);
    triggerRefresh();
  };

  // Reset page when date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;
    const term = searchTerm.toLowerCase().trim();
    return jobs.filter((j) => {
      return (
        (j.plate && j.plate.toLowerCase().includes(term)) ||
        (j.mobile && j.mobile.toLowerCase().includes(term)) ||
        (j.work_type && j.work_type.toLowerCase().includes(term)) ||
        (j.vehicle_type && j.vehicle_type.toLowerCase().includes(term)) ||
        (j.staff_name && j.staff_name.toLowerCase().includes(term)) ||
        (j.customer_name && j.customer_name.toLowerCase().includes(term))
      );
    });
  }, [jobs, searchTerm]);

  const paginatedJobs = filteredJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddSelectedDate) {
      showToast(t.vehicles.todayOnlyNotice, 'error');
      return;
    }

    if (!workType || !vehicleType || !staffId || !price) {
      showToast('Please fill in work type, vehicle type, staff, and price.', 'warning');
      return;
    }

    try {
      const res = await dataProvider.addJob({
        entry_date: selectedDate,
        plate,
        mobile,
        work_type: workType,
        vehicle_type: vehicleType,
        staff_id: staffId,
        price: Number(price),
        extra_amount: Number(extraAmount) || 0,
        customer_id: customerId || null,
        is_paid: isPaid,
      });

      if (res.success) {
        // const entryId = res.id; // assume addJob returns the new record id
        const entryId = res.job?.id ?? '';
        // ---- Photo upload ----
        if (photoFile) {
          const filePath = `vehicle-photos/${entryId}.webp`;
          const { error: uploadErr } = await supabase.storage
            .from('vehicle-photos')
            .upload(filePath, photoFile, { upsert: true });
          if (uploadErr) {
            showToast('Vehicle saved but photo upload failed: ' + uploadErr.message, 'error');
          } else {
            const publicUrl = supabase.storage.from('vehicle-photos').getPublicUrl(filePath).publicURL;
            await dataProvider.updateJob(entryId, { photo_url: publicUrl });
          }
        }
        showToast('Vehicle order recorded successfully!', 'success');
        // Reset entry form
        setPlate('');
        setMobile('');
        setPrice('');
        setExtraAmount('');
        setCustomerId('');
        setIsPaid(false);
        setPhotoFile(null);
        setPhotoPreview(null);
        triggerRefresh();
      } else {
        showToast(res.error || 'Failed to record vehicle', 'error');
      }
    } catch (err: any) {
      console.error('Error adding vehicle job:', err);
      showToast(err?.message || 'Failed to record vehicle', 'error');
    }
  };

  // ------------------------------------------------
  // Photo handling helpers
  // ------------------------------------------------
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotoFile(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let [w, h] = [img.width, img.height];
        const maxSide = 480;
        if (w > h) {
          if (w > maxSide) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          }
        } else {
          if (h > maxSide) {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.45;
        const minQuality = 0.25;
        const maxSize = 30 * 1024; // 30KB
        const attempt = () => {
          canvas.toBlob(async (blob) => {
            if (!blob) return reject('Canvas conversion failed');
            if (blob.size <= maxSize || quality <= minQuality) {
              const file = new File([blob], `${Date.now()}.webp`, { type: 'image/webp' });
              resolve(file);
            } else {
              quality -= 0.05;
              if (quality < minQuality) {
                canvas.width = Math.round(canvas.width * 0.85);
                canvas.height = Math.round(canvas.height * 0.85);
                quality = 0.45;
              }
              attempt();
            }
          }, 'image/webp', quality);
        };
        attempt();
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  };


  const handleUpdateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    try {
      const res = dataProvider.updateJob(editingJob.id, {
        plate: editingJob.plate || '',
        mobile: editingJob.mobile || '',
        work_type: editingJob.work_type,
        vehicle_type: editingJob.vehicle_type,
        staff_id: editingJob.staff_id,
        price: editingJob.price,
        extra_amount: editingJob.extra_amount,
        customer_id: editingJob.customer_id,
        is_paid: editingJob.is_paid,
        entry_date: editingJob.entry_date,
      });

      if (res.success) {
        showToast('Vehicle updated successfully', 'success');
        setEditingJob(null);
        triggerRefresh();
      } else {
        showToast(res.error || 'Failed to update vehicle', 'error');
      }
    } catch (err: any) {
      console.error('Error updating vehicle job:', err);
      showToast(err?.message || 'Failed to update vehicle', 'error');
    }
  };

  const handleDeleteJob = (id: string) => {
    try {
      const res = dataProvider.deleteJob(id);
      if (res.success) {
        showToast('Vehicle record deleted', 'info');
        setDeletingJobId(null);
        triggerRefresh();
      } else {
        showToast(res.error || 'Failed to delete record', 'error');
      }
    } catch (err: any) {
      console.error('Error deleting vehicle job:', err);
      showToast(err?.message || 'Failed to delete record', 'error');
    }
  };

  // Day Totals Breakdown
  const count = jobs.length;
  const totalRev = jobs.reduce((sum, j) => sum + j.total, 0);
  const totalBase = jobs.reduce((sum, j) => sum + (j.price || 0), 0);
  const totalExtra = jobs.reduce((sum, j) => sum + (j.extra_amount || 0), 0);
  const paidRev = jobs.filter((j) => j.is_paid).reduce((sum, j) => sum + j.total, 0);
  const unpaidRev = jobs.filter((j) => !j.is_paid).reduce((sum, j) => sum + j.total, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Screen Title & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t.vehicles.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t.vehicles.subtitle}</p>
        </div>

        {/* Date Selector Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuickDate('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedDate === todayStr
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
          >
            {t.vehicles.today}
          </button>
          <button
            onClick={() => setQuickDate('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedDate !== todayStr
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
          >
            {t.vehicles.yesterday}
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Badges - Total Revenue, Base Amount, and Extra Amount */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.vehicles.count}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{count}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.vehicles.totalRevenue}</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {totalRev.toFixed(2)} <span className="text-xs font-semibold text-slate-400">{currency}</span>
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/40 shadow-sm backdrop-blur-md">
          <div className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Base Amount</div>
          <div className="text-xl font-black text-indigo-900 dark:text-indigo-200 mt-1">
            {totalBase.toFixed(2)} <span className="text-xs font-normal">{currency}</span>
          </div>
          <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">Base Service Value</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 shadow-sm backdrop-blur-md">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Extra Amount</div>
          <div className="text-xl font-black text-amber-900 dark:text-amber-200 mt-1">
            {totalExtra.toFixed(2)} <span className="text-xs font-normal">{currency}</span>
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">Add-on & Polish Value</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 shadow-sm backdrop-blur-md">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t.vehicles.paid}</div>
          <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
            {paidRev.toFixed(2)} <span className="text-xs font-normal">{currency}</span>
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 shadow-sm backdrop-blur-md">
          <div className="text-xs text-rose-700 dark:text-rose-400 font-medium">{t.vehicles.unpaid} / Credit</div>
          <div className="text-xl font-bold text-rose-800 dark:text-rose-300 mt-1">
            {unpaidRev.toFixed(2)} <span className="text-xs font-normal">{currency}</span>
          </div>
        </div>
      </div>

      {/* Fast Cashier Entry Form Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {t.vehicles.addVehicle} ({selectedDate})
          </h2>
          {!canAddSelectedDate && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-0.5 rounded-full">
              Past Date (Owner Only)
            </span>
          )}
        </div>

        {selectedCustomerWarning && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-600/70 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2 animate-bounce">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{selectedCustomerWarning}</span>
          </div>
        )}

        {/* Morning Attendance Reminder */}
        {presentStaffIds.length === 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Day Start Routine:</strong> Please take staff attendance first so only <strong>Present</strong> technicians appear in this assignment list!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 shrink-0"
            >
              Mark Attendance Now
            </button>
          </div>
        )}

        <form onSubmit={handleAddJob} className="space-y-4">
          {/* Form Inputs Grid - Clean Dropdowns for Work Type and Vehicle Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Work Type Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.vehicles.workType} <span className="text-rose-500">*</span>
              </label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                required
              >
                {workTypes.map((wt) => (
                  <option key={wt} value={wt}>
                    {wt}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Type Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.vehicles.vehicleType} <span className="text-rose-500">*</span>
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                required
              >
                {vehicleTypes.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>

            {/* Plate Number */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.vehicles.plate}</label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder={t.vehicles.platePlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm uppercase text-slate-900 dark:text-slate-100 font-mono tracking-wider focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.vehicles.mobile}</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={t.vehicles.mobilePlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Handling Staff Dropdown (Filters to Present Staff) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.vehicles.handlingStaff} <span className="text-rose-500">*</span>
                </label>
                {presentStaffIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowOnlyPresentStaff(!showOnlyPresentStaff)}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    title="Click to toggle between Present staff only and All staff"
                  >
                    {showOnlyPresentStaff ? `🟢 ${availableStaff.length} Present Only` : `👥 All Staff (${staffList.length})`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('attendance')}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    ⚠️ Attendance not marked
                  </button>
                )}
              </div>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                required
              >
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Account (Credit) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.vehicles.customerAccount}</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Walk-in Customer --</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Limit: {c.credit_limit} {currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Base Price */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.vehicles.price} (Base) <span className="text-rose-500">*</span>
                </label>
                {/*  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Staff Commission Basis</span> */}
              </div>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Extra Amount (Polish, Detailing, etc.) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.vehicles.extraAmount}</label>
                {/*  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Garage Revenue</span>  */}
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                placeholder={`Optional extra (${currency})`}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500"
              />
{/* Vehicle Photo Capture */}
<div className="space-y-1">
  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.vehicles.photo || 'Vehicle Photo'}</label>
  {photoPreview ? (
    <div className="relative mt-1 inline-block">
      <img src={photoPreview} alt="Vehicle preview" className="h-24 w-24 object-cover rounded-xl border-2 border-slate-200 shadow-sm" />
      <button type="button" onClick={removePhoto} className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 rounded-full p-1 shadow-md transition">
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  ) : (
    <div className="mt-1">
      <label className="flex flex-col items-center justify-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
        <Camera className="w-6 h-6 text-slate-400" />
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tap to Capture Photo</span>
        <span className="text-[10px] text-slate-500">Very compressed for fast loading</span>
        <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
      </label>
    </div>
  )}
</div>
            </div>
          </div>

          {/* Commission Calculation & Profit Protection Callout */}
          {/*  <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <span>💡 Staff Commission Policy</span>
                <span className="text-[10px] bg-blue-200/70 dark:bg-blue-900/80 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                  Guaranteed Base Price Only
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Staff commission (e.g. 40%) is strictly computed on <strong>Base Price ({price || '0.00'} {currency})</strong> only.
                Extra Amount ({extraAmount || '0.00'} {currency} for polish, parts, detailing) is <strong>100% garage revenue</strong> and never shared with staff.
              </p>
            </div>
            {staffList.find((s) => s.id === staffId)?.pay_type === 'commission' && (
              <div className="shrink-0 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 shadow-sm text-right">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Staff Share ({staffList.find((s) => s.id === staffId)?.pay_rate}% of Base)
                </div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {((Number(price) || 0) * ((staffList.find((s) => s.id === staffId)?.pay_rate || 0) / 100)).toFixed(2)} {currency}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Garage Retains: {(
                    (Number(price) || 0) * (1 - (staffList.find((s) => s.id === staffId)?.pay_rate || 0) / 100) +
                    (Number(extraAmount) || 0)
                  ).toFixed(2)} {currency}
                </div>
              </div>
            )}
          </div> */}

          {/* Payment Toggle (Active for ALL vehicles: Walk-in AND Customer Accounts) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Payment Status {customerId ? '(Customer Vehicle)' : '(Walk-in)'}:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isPaid
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{customerId ? '✓ Paid at Counter (Cash/Card)' : t.vehicles.walkInPaid}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${!isPaid
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{customerId ? '💳 Unpaid / On Credit Account' : t.vehicles.walkInUnpaid}</span>
                </button>
              </div>
            </div>

            {customerId && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                {isPaid ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    ✓ Paid now: Customer settled this job on the spot. It will NOT be added to their credit debt.
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                    💳 Credit account: Added to customer's outstanding balance ledger ({((Number(price) || 0) + (Number(extraAmount) || 0)).toFixed(2)} {currency}).
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Order Button */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t.vehicles.total}:{' '}
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                {((Number(price) || 0) + (Number(extraAmount) || 0)).toFixed(2)}
              </span>
            </div>
            <button
              type="submit"
              disabled={!canAddSelectedDate}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t.vehicles.submitJob}
            </button>
          </div>
        </form>
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
      </div>

      {/* Selected Day's Vehicles List Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-xl transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Registered Vehicles ({searchTerm ? `${filteredJobs.length} of ${jobs.length}` : jobs.length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Date: {selectedDate} (50 per page)</span>
            </div>

            {/* Quick Search Bar */}
            <div className="relative min-w-[200px] sm:min-w-[280px] max-w-sm flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search plate, phone, staff, customer..."
                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('sales')}
            className="py-1.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            Complete Sales History
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {t.vehicles.noVehicles}
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Plate / Mobile</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-4">Value (Price + Extra)</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right rtl:text-left">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {paginatedJobs.map((job) => {
                    const isCredit = Boolean(job.customer_id);
                    const isSameDay = job.entry_date === todayStr;
                    const canEdit = isOwner || isSameDay;
                    const canDelete = isOwner || (isManager && isSameDay);

                    return (
                      <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {job.photo_url && (
                              <img 
                                src={job.photo_url} 
                                alt="Vehicle" 
                                className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm hover:opacity-80 transition"
                                onClick={() => setSelectedPhoto(job.photo_url)}
                                title="Show Vehicle"
                              />
                            )}
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-200">
                              {job.plate || 'NO PLATE'}
                            </div>
                          </div>
                          {job.mobile ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">{job.mobile}</span>
                              <a
                                href={`tel:${job.mobile}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 font-bold text-[10px] transition"
                                title="Call Customer Directly"
                              >
                                <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Call</span>
                              </a>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">-</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white">{job.work_type}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{job.vehicle_type}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {job.staff_name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {job.total.toFixed(2)}
                          </div>
                          {job.extra_amount > 0 && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({job.price} + {job.extra_amount} extra)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isCredit ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                                {job.is_paid ? '✓ Paid' : 'Credit'} · {job.customer_name}
                              </span>
                            ) : job.is_paid ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                ✓ Paid
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                                ✗ Unpaid
                              </span>
                            )}

                            {/* 1-Click Toggle Paid / Unpaid Button */}
                            <button
                              onClick={() => handleTogglePayment(job)}
                              className={`py-1 px-2.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-sm ${job.is_paid
                                ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 font-extrabold'
                                }`}
                              title={job.is_paid ? 'Click to mark as Unpaid' : 'Click to mark as Paid'}
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
                        </td>
                        <td className="py-3 px-4 text-right rtl:text-left space-x-1.5 rtl:space-x-reverse">
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
                              title={t.vehicles.editVehicle}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingJobId(job.id)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                              title={t.vehicles.deleteVehicle}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="md:hidden p-3 space-y-3">
              {paginatedJobs.map((job) => {
                const isCredit = Boolean(job.customer_id);
                const isSameDay = job.entry_date === todayStr;
                const canEdit = isOwner || isSameDay;
                const canDelete = isOwner || (isManager && isSameDay);

                return (
                  <div
                    key={job.id}
                    className={`p-4 rounded-2xl border transition-all ${job.is_paid
                      ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
                      : 'bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-slate-900/90 dark:to-slate-900 border-amber-200/80 dark:border-amber-700/50 shadow-md shadow-amber-950/5 ring-1 ring-amber-500/20'
                      }`}
                  >
                    {/* Card Header: Plate, Vehicle Type & Actions */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.photo_url && (
                          <img 
                            src={job.photo_url} 
                            alt="Vehicle" 
                            className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm hover:opacity-80 transition"
                            onClick={() => setSelectedPhoto(job.photo_url)}
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

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInvoiceJob(job)}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40"
                          title="Print / View Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditingJob(job)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            title={t.vehicles.editVehicle}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeletingJobId(job.id)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30"
                            title={t.vehicles.deleteVehicle}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Body: Service, Staff, Customer */}
                    <div className="py-2.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Service:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{job.work_type}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Handled by:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{job.staff_name}</span>
                      </div>

                      {job.customer_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Customer:</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/50">
                            {job.customer_name}
                          </span>
                        </div>
                      )}

                      {job.mobile && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Customer Mobile:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-700 dark:text-slate-300 text-xs font-semibold">{job.mobile}</span>
                            <a
                              href={`tel:${job.mobile}`}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Call</span>
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-medium">Total Amount</span>
                          {job.extra_amount > 0 && (
                            <span className="text-[10px] text-slate-400">
                              ({job.price.toFixed(2)} + {job.extra_amount.toFixed(2)} extra)
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900 dark:text-white">
                            {job.total.toFixed(2)}{' '}
                            <span className="text-xs font-semibold text-slate-400">{currency}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: 1-Click Mobile Payment Button (Touch-Friendly 44px) */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleTogglePayment(job)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] ${job.is_paid
                          ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                          }`}
                      >
                        {job.is_paid ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mark Unpaid (Currently: Paid ✓)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✓ Mark as Paid ({job.total.toFixed(2)} {currency})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 50-Items-per-Page Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredJobs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="vehicles"
        />
      </div>

      {/* Edit Vehicle Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Vehicle Entry</h3>
              <button
                onClick={() => setEditingJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateJob} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Plate Number</label>
                  <input
                    type="text"
                    value={editingJob.plate || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, plate: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Mobile</label>
                  <input
                    type="tel"
                    value={editingJob.mobile || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, mobile: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Work Type</label>
                  <select
                    value={editingJob.work_type}
                    onChange={(e) => setEditingJob({ ...editingJob, work_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {workTypes.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Vehicle Type</label>
                  <select
                    value={editingJob.vehicle_type}
                    onChange={(e) => setEditingJob({ ...editingJob, vehicle_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {vehicleTypes.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Base Price</label>
                  <input
                    type="number"
                    value={editingJob.price}
                    onChange={(e) => setEditingJob({ ...editingJob, price: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Extra Amount</label>
                  <input
                    type="number"
                    value={editingJob.extra_amount}
                    onChange={(e) => setEditingJob({ ...editingJob, extra_amount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Assigned Staff</label>
                <select
                  value={editingJob.staff_id}
                  onChange={(e) => setEditingJob({ ...editingJob, staff_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <span className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">
                  Payment Status:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer font-semibold transition ${editingJob.is_paid
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <input
                      type="radio"
                      name="editIsPaid"
                      checked={editingJob.is_paid}
                      onChange={() => setEditingJob({ ...editingJob, is_paid: true })}
                      className="sr-only"
                    />
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{editingJob.customer_id ? '✓ Paid at Counter' : '✓ Paid (Cash/Card)'}</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer font-semibold transition ${!editingJob.is_paid
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <input
                      type="radio"
                      name="editIsPaid"
                      checked={!editingJob.is_paid}
                      onChange={() => setEditingJob({ ...editingJob, is_paid: false })}
                      className="sr-only"
                    />
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>{editingJob.customer_id ? '💳 Unpaid / On Credit' : '✗ Unpaid'}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingJobId && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.vehicles.deleteVehicle}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t.vehicles.deleteConfirm}</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setDeletingJobId(null)}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => handleDeleteJob(deletingJobId)}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                {t.common.delete}
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
    </div>
  );
}
