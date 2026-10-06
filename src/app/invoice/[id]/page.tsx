'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { dataProvider } from '@/lib/data-provider';
import { Job, Company } from '@/types/database';
import { UnifiedDocumentLayout, UnifiedDocumentItem, UnifiedDocumentProps } from '@/components/common/UnifiedDocumentLayout';
import { printDocumentElement, downloadPdfFromElement } from '@/lib/pdf-generator';
import { renderDocumentToCanvasFile } from '@/lib/canvas-invoice-renderer';
import { Printer, Download, Car, ArrowLeft, Share2, Loader2 } from 'lucide-react';

export default function PublicInvoicePage() {
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    // Load from dataProvider or local cache
    const allJobs = dataProvider.getJobs();
    const found = allJobs.find((j) => j.id === jobId);

    if (found) {
      setJob(found);
      const comps = dataProvider.getCompanies();
      const comp = comps.find((c) => c.id === found.company_id) || dataProvider.getCurrentSession()?.company || null;
      setCompany(comp);
    }
    setLoading(false);
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-slate-500 font-semibold text-sm">Loading Invoice...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 max-w-sm">
          <Car className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Invoice Not Found</h2>
          <p className="text-xs text-slate-500">
            This invoice link may be expired or the record is unavailable.
          </p>
        </div>
      </div>
    );
  }

  const invoiceNumber = `INV-${job.entry_date.replace(/-/g, '')}-${job.id.slice(0, 6).toUpperCase()}`;
  const customer = job.customer_id
    ? dataProvider.getCustomers().find((c) => c.id === job.customer_id)
    : null;
  const customerName = customer?.name || job.customer_name || 'Walk-in Customer';
  const currency = company?.currency || 'AED';

  // Convert job into document items - single consolidated line showing vehicle total
  const totalAmount = job.total ?? (job.price + (job.extra_amount || 0));
  const paidAmount = job.is_paid ? totalAmount : 0;
  const outstandingAmount = job.is_paid ? 0 : totalAmount;

  const items: UnifiedDocumentItem[] = [
    {
      id: `${job.id}-total`,
      ref_no: invoiceNumber,
      description: job.work_type || 'Automotive Service',
      vehicle_plate: job.plate || undefined,
      vehicle_type: job.vehicle_type,
      work_type: job.work_type,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      status: job.is_paid ? 'PAID' : 'UNPAID',
    },
  ];

  const companyName = company?.name || 'Super Finish';
  const docTitle = `${companyName} ${invoiceNumber}`;

  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const cachedFileRef = useRef<File | null>(null);
  const docProps: UnifiedDocumentProps = {
    id: 'unified-invoice-document',
    type: 'invoice',
    company,
    currency,
    documentNumber: invoiceNumber,
    documentDate: job.entry_date,
    status: job.is_paid ? 'PAID' : 'UNPAID',
    customerName,
    customerMobile: customer?.mobile || job.mobile || undefined,
    customerAccountId: job.customer_id ? job.customer_id.slice(0, 8) : undefined,
    vehiclePlate: job.plate || 'NO PLATE',
    vehicleType: job.vehicle_type,
    items,
    grandTotal: job.total,
    totalPaid: job.is_paid ? job.total : 0,
    outstandingDue: job.is_paid ? 0 : job.total,
  };

  // Instant Canvas 2D background pre-generation (<8ms)
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        const file = await renderDocumentToCanvasFile(docProps, `${docTitle}.png`);
        if (active) {
          cachedFileRef.current = file;
        }
      } catch (err) {
        console.warn('Canvas invoice pre-render error:', err);
      }
    };
    prepare();
    return () => {
      active = false;
    };
  }, [docTitle, job]);

  const handleShareImage = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareToast(null);

    try {
      const fileToShare = cachedFileRef.current || (await renderDocumentToCanvasFile(docProps, `${docTitle}.png`));
      cachedFileRef.current = fileToShare;

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
        });
      } else {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost';
        setShareToast({
          message: isHttp
            ? 'Mobile share requires HTTPS. Please deploy to Vercel or use HTTPS tunnel.'
            : 'Native share is not supported on this browser.',
          type: 'error',
        });
        setTimeout(() => setShareToast(null), 5000);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Share image error:', err);
        setShareToast({
          message: 'Could not open share. Please try again.',
          type: 'error',
        });
        setTimeout(() => setShareToast(null), 4000);
      }
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = docTitle;
  }, [docTitle]);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center">
      {/* Action Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between pb-4 no-print">
        <span className="text-xs text-slate-500 font-bold">
          Official Digital Invoice · {invoiceNumber}
        </span>
        <div className="flex items-center gap-2">
          {shareToast && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in">
              {shareToast.message}
            </span>
          )}

          {/* Native Share Image Button */}
          <button
            type="button"
            onClick={handleShareImage}
            disabled={isSharing}
            className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
            title="Share invoice image via Android / iOS Native Share"
          >
            {isSharing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{isSharing ? 'Preparing...' : 'Share Image'}</span>
          </button>

          <button
            onClick={() => downloadPdfFromElement('unified-invoice-document', `${docTitle}.pdf`)}
            className="py-1.5 px-3.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={() => printDocumentElement('unified-invoice-document', docTitle)}
            className="py-1.5 px-3.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-blue-500 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="w-full max-w-3xl">
        <UnifiedDocumentLayout
          id="unified-invoice-document"
          type="invoice"
          company={company}
          currency={currency}
          documentNumber={invoiceNumber}
          documentDate={job.entry_date}
          status={job.is_paid ? 'PAID' : 'UNPAID'}
          customerName={customerName}
          customerMobile={customer?.mobile || job.mobile || undefined}
          customerAccountId={job.customer_id ? job.customer_id.slice(0, 8) : undefined}
          vehiclePlate={job.plate || 'NO PLATE'}
          vehicleType={job.vehicle_type}
          items={items}
          grandTotal={job.total}
          totalPaid={job.is_paid ? job.total : 0}
          outstandingDue={job.is_paid ? 0 : job.total}
        />
      </div>
    </div>
  );
}
