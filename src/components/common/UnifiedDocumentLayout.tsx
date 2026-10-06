'use client';

import React from 'react';
import { Company } from '@/types/database';
import { Car, Phone, Check } from 'lucide-react';

export interface UnifiedDocumentItem {
  id: string;
  date?: string;
  ref_no: string;
  description: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  work_type?: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'PAID' | 'UNPAID';
}

export interface UnifiedDocumentProps {
  id: string; // DOM id for printing/previewing
  type: 'invoice' | 'statement' | 'job_card' | 'receipt';
  company: Company | null;
  currency: string;
  documentNumber: string;
  documentDate: string;
  periodLabel?: string;
  status: 'PAID' | 'PARTIALLY PAID' | 'UNPAID' | 'OPEN' | 'IN PROGRESS' | 'COMPLETED' | 'DELIVERED';
  customerName: string;
  customerMobile?: string;
  customerAccountId?: string;
  creditLimit?: number;
  vehiclePlate?: string;
  vehicleType?: string;
  vehicleMakeModel?: string;
  technicianName?: string;
  paymentMethod?: string;
  items: UnifiedDocumentItem[];
  openingBalance?: number;
  grandTotal: number;
  totalPaid: number;
  outstandingDue: number;
  notes?: string;
}

export function UnifiedDocumentLayout({
  id,
  type,
  company,
  currency,
  documentNumber,
  documentDate,
  periodLabel,
  status,
  customerName,
  customerMobile,
  customerAccountId,
  creditLimit,
  vehiclePlate,
  vehicleType,
  vehicleMakeModel,
  technicianName,
  paymentMethod = 'Cash',
  items,
  openingBalance = 0,
  grandTotal,
  totalPaid,
  outstandingDue,
  notes,
}: UnifiedDocumentProps) {
  const companyName = company?.name || 'SUPER FINISH';
  const companyCode = company?.code || '1000';
  const timezone = company?.timezone || 'Asia/Dubai';
  const isInvoice = type === 'invoice';
  const isPaid = status === 'PAID' || status === 'COMPLETED';

  // Format generation timestamp
  const now = new Date();
  const formattedTime = now.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      id={id}
      className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-7 space-y-4 max-w-3xl mx-auto shadow-sm font-sans"
      style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
    >
      {/* 1. Header: Workshop Identity & Document Title */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-1">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
            {companyName}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Automotive Care & Workshop Management
          </p>
        </div>

        {/* Right Header: Black Pill INVOICE Badge & Metadata */}
        <div className="text-left sm:text-right space-y-1">
          <div>
            <span className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white font-black text-xs uppercase tracking-wider shadow-xs">
              INVOICE
            </span>
          </div>
          <div className="text-xs font-mono text-slate-600">
            Invoice No: <span className="font-bold text-slate-900">{documentNumber}</span>
          </div>
          <div className="text-xs text-slate-600">
            Date: <span className="font-semibold text-slate-900">{documentDate}</span>
          </div>
          <div className="pt-0.5">
            <span
              className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-300'
              }`}
            >
              {isPaid ? <Check className="w-3 h-3 text-emerald-600" /> : null}
              <span>{status}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Solid Black Separator Line */}
      <div className="border-b-2 border-slate-900" />

      {/* 2. Customer & Vehicle Details Box */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
            BILLED TO
          </div>
          <div className="text-sm font-bold text-slate-900">{customerName}</div>
          {customerMobile ? (
            <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{customerMobile}</span>
            </div>
          ) : (
            <div className="text-slate-400 text-[11px]">Walk-in Customer</div>
          )}
        </div>

        <div className="space-y-1 sm:text-right flex flex-col sm:items-end justify-center">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
            VEHICLE DETAILS
          </div>
          <div className="flex items-center gap-1.5 text-slate-900 font-mono font-bold text-sm">
            <Car className="w-3.5 h-3.5 text-blue-600" />
            <span>{vehiclePlate || 'NO PLATE'}</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Type: {vehicleType || 'Car'}
          </div>
        </div>
      </div>

      {/* 3. Items & Services Table */}
      <div className="rounded-xl border border-slate-200 overflow-x-auto text-xs">
        <table className="w-full min-w-[560px] text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">SERVICE / ITEM</th>
              <th className="py-2.5 px-3">VEHICLE & DETAILS</th>
              <th className="py-2.5 px-3 text-right">TOTAL ({currency})</th>
              <th className="py-2.5 px-3 text-right">PAID ({currency})</th>
              <th className="py-2.5 px-3 text-right">DUE ({currency})</th>
              <th className="py-2.5 px-3 text-center">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No records to display.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {it.description}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {it.vehicle_plate || vehiclePlate || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {it.total_amount.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                    {it.paid_amount > 0 ? it.paid_amount.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                    {it.outstanding_amount > 0 ? (
                      <span className="text-rose-600">{it.outstanding_amount.toFixed(2)}</span>
                    ) : (
                      '0.00'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        it.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {it.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Payment Terms & Financial Summary */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-1">
        {/* Left: Payment Terms & Instructions */}
        <div className="space-y-1 text-slate-500 max-w-sm text-[11px] leading-relaxed">
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            PAYMENT TERMS & INSTRUCTIONS
          </div>
          <p>1. All services performed under standard workshop quality standards.</p>
          <p>2. Please retain this official document for your records.</p>
          <p>
            3. Cheque / Bank transfers must quote document number{' '}
            <strong className="font-mono text-slate-800">{documentNumber}</strong>.
          </p>
        </div>

        {/* Right: Summary Card */}
        <div className="w-full sm:w-72 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between font-bold text-slate-700">
            <span>Total Amount:</span>
            <span className="font-mono text-slate-900">{grandTotal.toFixed(2)} {currency}</span>
          </div>

          <div className="flex justify-between font-bold text-emerald-600">
            <span>Paid Amount:</span>
            <span className="font-mono">-{totalPaid.toFixed(2)} {currency}</span>
          </div>

          <div className="pt-1.5 border-t border-slate-200 flex justify-between font-extrabold text-sm">
            <span className="text-slate-900">Outstanding Balance:</span>
            <span className={`font-mono ${outstandingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {outstandingDue.toFixed(2)} {currency}
            </span>
          </div>

          <div className={`text-[11px] text-center pt-1 font-bold ${isPaid ? 'text-emerald-700' : 'text-rose-700'}`}>
            Status: <span className="uppercase">{status}</span>
          </div>
        </div>
      </div>

      {/* Subtle Divider Line */}
      <div className="border-b border-slate-200 pt-1" />

      {/* 5. Document Stamp & Signature Footer */}
      <div className="grid grid-cols-2 gap-4 items-end text-[10px] text-slate-500 pt-1">
        <div>
          <div>Thank you for choosing {companyName}. Drive safely!</div>
          <div className="text-slate-400 mt-0.5 font-mono text-[9px]">
            Generated on {formattedTime}
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="w-36 border-b border-slate-400 h-6 mb-1" />
          <span className="font-bold uppercase text-[9px] text-slate-600 tracking-wider">
            AUTHORIZED SIGNATURE & STAMP
          </span>
          <span className="text-[9px] text-slate-400">{companyName}</span>
        </div>
      </div>
    </div>
  );
}
