import { Company } from '@/types/database';
import { copyBlobToClipboard } from '@/lib/pdf-generator';

export interface GarageBranding {
  name: string;
  code?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  logo_url?: string;
}

export interface CustomerInfo {
  name: string;
  phone?: string | null;
  accountId?: string;
  address?: string;
}

export interface VehicleInfo {
  plate?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  color?: string | null;
  type?: string | null;
  mileage?: string | number | null;
  vin?: string | null;
}

export interface InvoiceItem {
  service: string;
  qty: number;
  price: number;
  total: number;
}

export interface InvoiceDocData {
  invoiceNo: string;
  date: string;
  garage: GarageBranding;
  customer: CustomerInfo;
  vehicle: VehicleInfo;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paid: number;
  balance: number;
  status: 'PAID' | 'PARTIALLY PAID' | 'UNPAID';
  currency: string;
  notes?: string;
}

export interface StatementTransaction {
  date: string;
  refNo: string;
  description: string;
  total: number;
  paid: number;
  balance: number;
  status?: string;
}

export interface StatementDocData {
  statementNo: string;
  date: string;
  period: string;
  garage: GarageBranding;
  customer: CustomerInfo;
  vehicle?: VehicleInfo;
  transactions: StatementTransaction[];
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  currentBalance: number;
  status: 'PAID' | 'PARTIALLY PAID' | 'UNPAID';
  currency: string;
}

export interface JobCardItem {
  title: string;
  notes?: string;
  status?: string;
}

export interface JobCardDocData {
  jobCardNo: string;
  date: string;
  garage: GarageBranding;
  customer: CustomerInfo;
  vehicle: VehicleInfo;
  workRequested: JobCardItem[];
  technician?: string;
  status: 'OPEN' | 'IN PROGRESS' | 'COMPLETED' | 'DELIVERED';
  currency?: string;
  estimatedTotal?: number;
  remarks?: string;
}

export interface PaymentReceiptDocData {
  receiptNo: string;
  date: string;
  garage: GarageBranding;
  customer: CustomerInfo;
  vehicle?: VehicleInfo;
  invoiceRef?: string;
  amountReceived: number;
  paymentMethod: 'Cash' | 'Card' | 'Bank' | 'Online' | string;
  previousBalance: number;
  amountPaid: number;
  remainingBalance: number;
  status: 'PAID' | 'PARTIALLY PAID';
  currency: string;
  notes?: string;
}

export type DocumentPayload =
  | { type: 'invoice'; data: InvoiceDocData }
  | { type: 'statement'; data: StatementDocData }
  | { type: 'job_card'; data: JobCardDocData }
  | { type: 'receipt'; data: PaymentReceiptDocData };

export interface SharePNGResult {
  success: boolean;
  method: 'native_share' | 'unsupported' | 'cancelled' | 'download_copied';
  filename: string;
  blob?: Blob;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Helpers & Templating
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderHeader(garage: GarageBranding, docTitle: string, docNo: string, docDate: string, statusText: string, statusColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate') {
  const colorMap = {
    emerald: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    amber: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    rose: { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    slate: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155' },
  };
  const sc = colorMap[statusColor] || colorMap.emerald;

  // Build contact line (hide any empty fields)
  const contacts: string[] = [];
  if (garage.phone) contacts.push(`Phone: <strong>${escapeHtml(garage.phone)}</strong>`);
  if (garage.whatsapp) contacts.push(`WhatsApp: <strong>${escapeHtml(garage.whatsapp)}</strong>`);
  if (garage.address) contacts.push(escapeHtml(garage.address));
  if (garage.email) contacts.push(escapeHtml(garage.email));
  const contactLine = contacts.join(' &nbsp;·&nbsp; ');

  const logoMarkup = garage.logo_url
    ? `<img src="${escapeHtml(garage.logo_url)}" alt="Logo" style="max-height: 64px; max-width: 140px; object-fit: contain;" />`
    : `<div style="width: 58px; height: 58px; border-radius: 12px; background: linear-gradient(135deg, #1e40af, #2563eb); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
        ${escapeHtml((garage.code || garage.name || 'GAR').slice(0, 3).toUpperCase())}
       </div>`;

  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #0f172a;">
      <div style="display: flex; align-items: center; gap: 18px;">
        ${logoMarkup}
        <div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.1;">
            ${escapeHtml(garage.name || 'Super Finish')}
          </h1>
          <p style="font-size: 13px; font-weight: 600; color: #475569; margin: 4px 0 0 0; letter-spacing: 0.2px;">
            ${escapeHtml(garage.tagline || 'Automotive Service Center & Workshop Management')}
          </p>
          ${contactLine ? `<div style="font-size: 12px; color: #64748b; margin-top: 6px;">${contactLine}</div>` : ''}
        </div>
      </div>

      <div style="text-align: right; min-width: 260px;">
        <div style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 7px 18px; border-radius: 8px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
          ${escapeHtml(docTitle)}
        </div>
        <div style="font-size: 14px; font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 8px;">
          ${escapeHtml(docNo)}
        </div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
          Date: <strong style="color: #0f172a;">${escapeHtml(docDate)}</strong>
        </div>
        <div style="margin-top: 8px;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${sc.bg}; border: 1.5px solid ${sc.border}; color: ${sc.text};">
            ${escapeHtml(statusText)}
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderCustomerAndVehicle(customer: CustomerInfo, vehicle?: VehicleInfo) {
  // Filter out customer empty fields
  const custItems: Array<{ label: string; value: string }> = [];
  if (customer.name) custItems.push({ label: 'Customer Name', value: customer.name });
  if (customer.phone) custItems.push({ label: 'Phone', value: customer.phone });
  if (customer.accountId) custItems.push({ label: 'Account ID', value: customer.accountId });
  if (customer.address) custItems.push({ label: 'Address', value: customer.address });

  // Filter out vehicle empty fields
  const vehItems: Array<{ label: string; value: string }> = [];
  if (vehicle?.plate) vehItems.push({ label: 'Plate No', value: vehicle.plate });
  if (vehicle?.make || vehicle?.model) vehItems.push({ label: 'Make / Model', value: `${vehicle?.make || ''} ${vehicle?.model || ''}`.trim() });
  if (vehicle?.type) vehItems.push({ label: 'Vehicle Type', value: vehicle.type });
  if (vehicle?.year) vehItems.push({ label: 'Year', value: String(vehicle.year) });
  if (vehicle?.color) vehItems.push({ label: 'Color', value: vehicle.color });
  if (vehicle?.mileage) vehItems.push({ label: 'Mileage', value: `${vehicle.mileage} KM` });
  if (vehicle?.vin) vehItems.push({ label: 'VIN / Chassis', value: vehicle.vin });

  const hasVehicle = vehItems.length > 0;

  return `
    <div style="display: grid; grid-template-columns: ${hasVehicle ? '1fr 1fr' : '1fr'}; gap: 20px; margin: 24px 0;">
      <!-- Customer Card -->
      <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px 22px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 10px;">
          CUSTOMER INFORMATION
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
          ${escapeHtml(customer.name || 'Walk-in Customer')}
        </div>
        ${customer.phone ? `
          <div style="font-size: 13px; color: #334155; margin-bottom: 4px;">
            Phone: <strong style="color: #0f172a;">${escapeHtml(customer.phone)}</strong>
          </div>
        ` : ''}
        ${customer.accountId ? `
          <div style="font-size: 12px; color: #64748b; font-family: monospace;">
            Account ID: ${escapeHtml(customer.accountId)}
          </div>
        ` : ''}
        ${customer.address ? `
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${escapeHtml(customer.address)}
          </div>
        ` : ''}
      </div>

      <!-- Vehicle Card -->
      ${hasVehicle ? `
        <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
              VEHICLE DETAILS
            </div>
            ${vehicle?.plate ? `
              <div style="border: 2px solid #0f172a; background: #ffffff; padding: 3px 10px; border-radius: 6px; font-family: monospace; font-weight: 900; font-size: 13px; color: #0f172a; letter-spacing: 1px;">
                ${escapeHtml(vehicle.plate)}
              </div>
            ` : ''}
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
            ${vehItems.filter(v => v.label !== 'Plate No').map(v => `
              <div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${escapeHtml(v.label)}</div>
                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(v.value)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderFooter(garageName: string, phoneOrWa?: string) {
  return `
    <div style="margin-top: 36px; padding-top: 20px; border-top: 2px dashed #cbd5e1; text-align: center;">
      <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">
        Thank you for choosing ${escapeHtml(garageName)}!
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
        ${phoneOrWa ? `For questions, warranty, or bookings: <strong>${escapeHtml(phoneOrWa)}</strong>` : 'We look forward to serving you again.'}
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 10px; font-family: monospace;">
        OFFICIAL DIGITAL DOCUMENT · ${escapeHtml((garageName || 'SUPER FINISH').toUpperCase())}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INVOICE HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function generateInvoiceHTML(doc: InvoiceDocData): string {
  const statusColor = doc.status === 'PAID' ? 'emerald' : doc.status === 'PARTIALLY PAID' ? 'amber' : 'rose';

  return `
    <div style="width: 1200px; padding: 50px 60px; box-sizing: border-box; background-color: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
      ${renderHeader(doc.garage, 'INVOICE', doc.invoiceNo, doc.date, doc.status, statusColor)}
      ${renderCustomerAndVehicle(doc.customer, doc.vehicle)}

      <!-- Service / Item Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 14px 18px; text-align: left; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">Service / Item</th>
            <th style="padding: 14px 18px; text-align: center; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; width: 80px;">Qty</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; width: 140px;">Unit Price (${doc.currency})</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; width: 160px;">Total (${doc.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${doc.items.map((it, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 14px 18px; font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(it.service)}</td>
              <td style="padding: 14px 18px; font-size: 14px; font-weight: 600; text-align: center; color: #334155;">${it.qty}</td>
              <td style="padding: 14px 18px; font-size: 14px; font-weight: 600; text-align: right; color: #334155; font-family: monospace;">${it.price.toFixed(2)}</td>
              <td style="padding: 14px 18px; font-size: 14px; font-weight: 800; text-align: right; color: #0f172a; font-family: monospace;">${it.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Financial Totals Summary -->
      <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
        <div style="width: 420px; background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px 24px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 8px;">
            <span>Subtotal:</span>
            <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${doc.subtotal.toFixed(2)} ${doc.currency}</span>
          </div>

          ${doc.discount && doc.discount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #e11d48; margin-bottom: 8px;">
              <span>Discount:</span>
              <span style="font-family: monospace; font-weight: 700;">- ${doc.discount.toFixed(2)} ${doc.currency}</span>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; margin: 10px 0;">
            <span style="font-size: 18px; font-weight: 900; color: #0f172a;">TOTAL:</span>
            <span style="font-size: 22px; font-weight: 900; color: #2563eb; font-family: monospace;">${doc.total.toFixed(2)} ${doc.currency}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #059669; margin-bottom: 8px;">
            <span>Amount Paid:</span>
            <span style="font-family: monospace; font-weight: 700;">${doc.paid.toFixed(2)} ${doc.currency}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: ${doc.balance > 0 ? '#e11d48' : '#059669'};">
            <span>Balance Due:</span>
            <span style="font-family: monospace; font-weight: 900;">${doc.balance.toFixed(2)} ${doc.currency}</span>
          </div>
        </div>
      </div>

      ${doc.notes ? `
        <div style="margin-top: 20px; padding: 14px 18px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; font-size: 12px; color: #92400e;">
          <strong>Notes:</strong> ${escapeHtml(doc.notes)}
        </div>
      ` : ''}

      ${renderFooter(doc.garage.name, doc.garage.phone || doc.garage.whatsapp)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CUSTOMER STATEMENT HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function generateStatementHTML(doc: StatementDocData): string {
  const statusColor = doc.status === 'PAID' ? 'emerald' : doc.status === 'PARTIALLY PAID' ? 'amber' : 'rose';

  return `
    <div style="width: 1200px; padding: 50px 60px; box-sizing: border-box; background-color: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
      ${renderHeader(doc.garage, 'CUSTOMER STATEMENT', doc.statementNo, doc.date, doc.status, statusColor)}
      
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 12px 20px; border-radius: 10px; margin: 20px 0 10px 0; border: 1px solid #e2e8f0;">
        <div style="font-size: 13px; font-weight: 700; color: #334155;">
          Statement Period: <strong style="color: #0f172a;">${escapeHtml(doc.period)}</strong>
        </div>
        <div style="font-size: 12px; color: #64748b;">
          Total Activity: <strong>${doc.transactions.length} records</strong>
        </div>
      </div>

      ${renderCustomerAndVehicle(doc.customer, doc.vehicle)}

      <!-- Transaction Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 100px;">Date</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 140px;">Ref / Inv</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase;">Description</th>
            <th style="padding: 12px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 120px;">Total (${doc.currency})</th>
            <th style="padding: 12px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 120px;">Paid (${doc.currency})</th>
            <th style="padding: 12px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 130px;">Balance (${doc.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${doc.transactions.map((t, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 11px 14px; font-size: 12px; color: #475569;">${escapeHtml(t.date)}</td>
              <td style="padding: 11px 14px; font-size: 12px; font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(t.refNo)}</td>
              <td style="padding: 11px 14px; font-size: 12px; font-weight: 600; color: #1e293b;">${escapeHtml(t.description)}</td>
              <td style="padding: 11px 14px; font-size: 12px; font-weight: 600; text-align: right; font-family: monospace; color: ${t.total > 0 ? '#0f172a' : '#94a3b8'};">
                ${t.total > 0 ? t.total.toFixed(2) : '-'}
              </td>
              <td style="padding: 11px 14px; font-size: 12px; font-weight: 700; text-align: right; font-family: monospace; color: ${t.paid > 0 ? '#059669' : '#94a3b8'};">
                ${t.paid > 0 ? t.paid.toFixed(2) : '-'}
              </td>
              <td style="padding: 11px 14px; font-size: 12px; font-weight: 800; text-align: right; font-family: monospace; color: #0f172a;">
                ${t.balance.toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Statement Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 24px;">
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Invoiced</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; font-family: monospace; margin-top: 4px;">
            ${doc.totalInvoiced.toFixed(2)} ${doc.currency}
          </div>
        </div>

        <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">Total Paid</div>
          <div style="font-size: 18px; font-weight: 800; color: #059669; font-family: monospace; margin-top: 4px;">
            ${doc.totalPaid.toFixed(2)} ${doc.currency}
          </div>
        </div>

        <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #9f1239; text-transform: uppercase;">Total Outstanding</div>
          <div style="font-size: 18px; font-weight: 800; color: #e11d48; font-family: monospace; margin-top: 4px;">
            ${doc.totalOutstanding.toFixed(2)} ${doc.currency}
          </div>
        </div>

        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Net Ledger Balance</div>
          <div style="font-size: 18px; font-weight: 900; color: #2563eb; font-family: monospace; margin-top: 4px;">
            ${doc.currentBalance.toFixed(2)} ${doc.currency}
          </div>
        </div>
      </div>

      ${renderFooter(doc.garage.name, doc.garage.phone || doc.garage.whatsapp)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. JOB CARD HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function generateJobCardHTML(doc: JobCardDocData): string {
  const statusColor = doc.status === 'COMPLETED' ? 'emerald' : doc.status === 'IN PROGRESS' ? 'amber' : doc.status === 'OPEN' ? 'blue' : 'slate';

  return `
    <div style="width: 1200px; padding: 50px 60px; box-sizing: border-box; background-color: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
      ${renderHeader(doc.garage, 'JOB CARD', doc.jobCardNo, doc.date, doc.status, statusColor)}
      ${renderCustomerAndVehicle(doc.customer, doc.vehicle)}

      <!-- Work Requested Section -->
      <div style="margin-top: 10px; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 12px 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">
          WORK REQUESTED & SERVICE SPECIFICATIONS
        </div>
        <div style="padding: 16px 20px; background-color: #ffffff;">
          ${doc.workRequested.map((w, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; ${idx < doc.workRequested.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}">
              <div style="display: flex; gap: 12px; align-items: flex-start;">
                <div style="width: 24px; height: 24px; border-radius: 6px; background: #e2e8f0; color: #0f172a; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; shrink-0;">
                  ${idx + 1}
                </div>
                <div>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${escapeHtml(w.title)}</div>
                  ${w.notes ? `<div style="font-size: 13px; color: #64748b; margin-top: 3px;">${escapeHtml(w.notes)}</div>` : ''}
                </div>
              </div>
              ${w.status ? `
                <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: #f1f5f9; color: #334155; text-transform: uppercase;">
                  ${escapeHtml(w.status)}
                </span>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Technician & Notes Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
            ASSIGNED TECHNICIAN
          </div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 6px;">
            ${escapeHtml(doc.technician || 'Workshop Duty Team')}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Authorized Service Bay
          </div>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
            ESTIMATED TOTAL
          </div>
          <div style="font-size: 18px; font-weight: 900; color: #2563eb; font-family: monospace; margin-top: 4px;">
            ${doc.estimatedTotal !== undefined ? `${doc.estimatedTotal.toFixed(2)} ${doc.currency || 'AED'}` : 'As Quoted'}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Subject to customer approval
          </div>
        </div>
      </div>

      ${doc.remarks ? `
        <div style="margin-top: 18px; padding: 14px 18px; background: #f1f5f9; border-radius: 10px; font-size: 12px; color: #334155;">
          <strong>Workshop Remarks:</strong> ${escapeHtml(doc.remarks)}
        </div>
      ` : ''}

      <!-- Authorization Sign-off Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding: 20px 24px; background: #fafafa; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
            CUSTOMER SIGN-OFF / AUTHORIZATION
          </div>
          <div style="height: 48px; border-bottom: 1.5px solid #94a3b8; margin-top: 8px;"></div>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
            I approve the requested vehicle diagnosis and services.
          </div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
            WORKSHOP SUPERVISOR
          </div>
          <div style="height: 48px; border-bottom: 1.5px solid #94a3b8; margin-top: 8px;"></div>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
            Job verified and admitted to workshop.
          </div>
        </div>
      </div>

      ${renderFooter(doc.garage.name, doc.garage.phone || doc.garage.whatsapp)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAYMENT RECEIPT HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function generatePaymentReceiptHTML(doc: PaymentReceiptDocData): string {
  const statusColor = doc.status === 'PAID' ? 'emerald' : 'amber';

  return `
    <div style="width: 1200px; padding: 50px 60px; box-sizing: border-box; background-color: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
      ${renderHeader(doc.garage, 'PAYMENT RECEIPT', doc.receiptNo, doc.date, doc.status, statusColor)}
      ${renderCustomerAndVehicle(doc.customer, doc.vehicle)}

      <!-- Huge Prominent Amount Received Card -->
      <div style="background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border: 2.5px solid #86efac; border-radius: 16px; padding: 28px 32px; text-align: center; margin: 24px 0; box-shadow: 0 4px 16px rgba(16,185,129,0.08);">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #065f46;">
          OFFICIAL AMOUNT RECEIVED
        </div>
        <div style="font-size: 44px; font-weight: 900; color: #059669; font-family: monospace; margin: 10px 0 6px 0; letter-spacing: -1px;">
          ${doc.currency} ${doc.amountReceived.toFixed(2)}
        </div>
        <div style="font-size: 14px; font-weight: 700; color: #047857;">
          Payment Method: <span style="background: #ffffff; padding: 3px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-left: 6px;">${escapeHtml(doc.paymentMethod)}</span>
        </div>
      </div>

      <!-- Payment Breakdown Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
            <td style="padding: 16px 20px; font-size: 13px; font-weight: 700; color: #64748b; width: 300px;">Receipt Number:</td>
            <td style="padding: 16px 20px; font-size: 15px; font-weight: 800; font-family: monospace; color: #0f172a;">${escapeHtml(doc.receiptNo)}</td>
          </tr>
          ${doc.invoiceRef ? `
            <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
              <td style="padding: 16px 20px; font-size: 13px; font-weight: 700; color: #64748b;">Applied to Invoice / Job:</td>
              <td style="padding: 16px 20px; font-size: 14px; font-weight: 800; color: #2563eb; font-family: monospace;">${escapeHtml(doc.invoiceRef)}</td>
            </tr>
          ` : ''}
          <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
            <td style="padding: 16px 20px; font-size: 13px; font-weight: 700; color: #64748b;">Previous Outstanding Balance:</td>
            <td style="padding: 16px 20px; font-size: 14px; font-weight: 700; font-family: monospace; color: #475569;">${doc.previousBalance.toFixed(2)} ${doc.currency}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
            <td style="padding: 16px 20px; font-size: 13px; font-weight: 700; color: #64748b;">Amount Paid in This Transaction:</td>
            <td style="padding: 16px 20px; font-size: 16px; font-weight: 900; font-family: monospace; color: #059669;">- ${doc.amountPaid.toFixed(2)} ${doc.currency}</td>
          </tr>
          <tr style="background: #ffffff;">
            <td style="padding: 16px 20px; font-size: 14px; font-weight: 800; color: #0f172a;">Remaining Balance:</td>
            <td style="padding: 16px 20px; font-size: 18px; font-weight: 900; font-family: monospace; color: ${doc.remainingBalance > 0 ? '#e11d48' : '#059669'};">
              ${doc.remainingBalance.toFixed(2)} ${doc.currency}
            </td>
          </tr>
        </tbody>
      </table>

      ${doc.notes ? `
        <div style="margin-top: 20px; padding: 14px 18px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 12px; color: #334155;">
          <strong>Receipt Note:</strong> ${escapeHtml(doc.notes)}
        </div>
      ` : ''}

      <!-- Cashier Confirmation -->
      <div style="margin-top: 28px; display: flex; justify-content: flex-end;">
        <div style="text-align: center; width: 240px; padding: 16px; border: 1.5px dashed #cbd5e1; border-radius: 10px; background: #fafafa;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
            PAYMENT CONFIRMED
          </div>
          <div style="margin-top: 6px; font-size: 13px; font-weight: 800; color: #059669;">
            ✓ OFFICIAL STAMP
          </div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
            ${escapeHtml(doc.date)}
          </div>
        </div>
      </div>

      ${renderFooter(doc.garage.name, doc.garage.phone || doc.garage.whatsapp)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Renderer: Generates High-Resolution PNG Blob
// ─────────────────────────────────────────────────────────────────────────────

export async function renderDocumentToPNGBlob(payload: DocumentPayload): Promise<{ blob: Blob; filename: string; title: string; text: string }> {
  let html = '';
  let filename = '';
  let title = '';
  let text = '';

  switch (payload.type) {
    case 'invoice':
      html = generateInvoiceHTML(payload.data);
      filename = `Invoice-${payload.data.invoiceNo}.png`;
      title = `Invoice ${payload.data.invoiceNo}`;
      text = `Invoice from ${payload.data.garage.name}`;
      break;
    case 'statement':
      html = generateStatementHTML(payload.data);
      const safeCustName = (payload.data.customer.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '-');
      filename = `Customer-Statement-${safeCustName}.png`;
      title = `Customer Statement ${payload.data.customer.name}`;
      text = `Customer Statement from ${payload.data.garage.name}`;
      break;
    case 'job_card':
      html = generateJobCardHTML(payload.data);
      filename = `Job-Card-${payload.data.jobCardNo}.png`;
      title = `Job Card ${payload.data.jobCardNo}`;
      text = `Job Card from ${payload.data.garage.name}`;
      break;
    case 'receipt':
      html = generatePaymentReceiptHTML(payload.data);
      filename = `Payment-Receipt-${payload.data.receiptNo}.png`;
      title = `Payment Receipt ${payload.data.receiptNo}`;
      text = `Payment Receipt from ${payload.data.garage.name}`;
      break;
  }

  // 1. Create an off-screen container mounted to document.body
  const container = document.createElement('div');
  container.id = 'garage-erp-document-png-offscreen';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1200px';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.backgroundColor = '#ffffff';
  container.innerHTML = html;

  document.body.appendChild(container);

  try {
    const { default: html2canvas } = await import('html2canvas');

    // 2. Render to canvas at 1.5x scale (giving 1800px width crystal-clear image)
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      useCORS: true,
      logging: false,
      windowWidth: 1200,
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not generate PNG blob from canvas');

    return { blob, filename, title, text };
  } finally {
    // 3. Immediately clean up off-screen element
    container.remove();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Share Function: Dispatches File to Native Share Sheet
// NEVER triggers an automatic file download!
// ─────────────────────────────────────────────────────────────────────────────

export async function shareDocumentAsPNG(payload: DocumentPayload): Promise<SharePNGResult> {
  const { blob, filename, title, text } = await renderDocumentToPNGBlob(payload);

  const file = new File([blob], filename, { type: 'image/png' });

  // Debugging console logs as strictly required:
  console.log("navigator.share:", typeof navigator !== 'undefined' ? !!navigator.share : false);
  console.log("navigator.canShare:", typeof navigator !== 'undefined' ? !!navigator.canShare : false);
  const fileSharingSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.canShare &&
    navigator.canShare({ files: [file] });
  console.log("file sharing supported:", fileSharingSupported);

  // 1. If file sharing is supported, call navigator.share() immediately:
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    fileSharingSupported
  ) {
    try {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return { success: true, method: 'native_share', filename, blob };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User closed or dismissed the native share sheet — stay quiet
        return { success: false, method: 'cancelled', filename, blob };
      }
      console.warn('Native share threw error:', err);
      return {
        success: false,
        method: 'unsupported',
        filename,
        blob,
        error: 'Your browser encountered an error while opening the share sheet.',
      };
    }
  }

  // 2. Fallback ONLY if native file sharing is unavailable.
  // The PNG remains in memory. The Share button must NEVER trigger an automatic browser download.
  return {
    success: false,
    method: 'unsupported',
    filename,
    blob,
    error: 'Your browser does not support direct file sharing.',
  };
}

/**
 * Manual Save Image helper — ONLY invoked when user explicitly clicks [Save Image] button
 */
export function saveImageBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
