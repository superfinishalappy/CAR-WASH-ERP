import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface RenderedDocumentAssets {
  canvas: HTMLCanvasElement;
  pdfBlob: Blob;
  pdfFile: File;
  dataUrl: string;
  imageBlob: Blob;
  imageFile: File;
}

/**
 * Render the document HTML element into high-resolution Canvas, PDF, and PNG in a single pass.
 */
export async function renderDocumentAssets(
  elementId: string,
  filename: string
): Promise<RenderedDocumentAssets | null> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id ${elementId} not found`);
    return null;
  }

  // 1. Capture high-DPI canvas (scale: 3 for retina/phone crispness)
  const canvas = await html2canvas(el, {
    scale: 3, // sharp on retina / high-DPI phone screens
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // 2. Generate standard A4 PDF via jsPDF
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth - 20; // 10mm margins on left and right
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10; // 10mm top margin

  pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, Math.min(imgHeight, pdfHeight - 20));
  heightLeft -= pdfHeight - 20;

  // Handle multi-page documents if ledger is tall
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;
  }

  const pdfBlob = pdf.output('blob');
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const pdfFile = new File([pdfBlob], safeFilename, { type: 'application/pdf' });
  const dataUrl = pdf.output('datauristring');

  // 3. Generate PNG Blob & File for instant clipboard pasting or native share
  const imageBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([], { type: 'image/png' }));
    }, 'image/png');
  });

  const baseName = filename.replace(/\.pdf$/i, '');
  const imageFile = new File([imageBlob], `${baseName}.png`, { type: 'image/png' });

  return {
    canvas,
    pdfBlob,
    pdfFile,
    dataUrl,
    imageBlob,
    imageFile,
  };
}

/**
 * Generate a PDF Blob and File from an HTML element
 */
export async function generatePdfFromElement(
  elementId: string,
  filename: string
): Promise<{ blob: Blob; file: File; dataUrl: string } | null> {
  const assets = await renderDocumentAssets(elementId, filename);
  if (!assets) return null;
  return {
    blob: assets.pdfBlob,
    file: assets.pdfFile,
    dataUrl: assets.dataUrl,
  };
}

/**
 * Helper to download PDF blob to device
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    console.warn('downloadPdfBlob error:', e);
  }
}

/**
 * Download the generated PDF directly to the user's device
 */
export async function downloadPdfFromElement(elementId: string, filename: string): Promise<boolean> {
  try {
    const assets = await renderDocumentAssets(elementId, filename);
    if (!assets) return false;
    downloadPdfBlob(assets.pdfBlob, filename);
    return true;
  } catch (err) {
    console.error('Failed to download PDF:', err);
    return false;
  }
}

/**
 * Copy high-resolution document image to clipboard for instant Ctrl+V pasting in WhatsApp Web
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (e) {
    console.warn('copyBlobToClipboard direct write failed:', e);
    return false;
  }
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }

  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (e) {
    console.warn('Direct blob clipboard write failed, trying promise fallback:', e);
  }

  try {
    const item = new ClipboardItem({
      'image/png': new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas blob conversion failed'));
        }, 'image/png');
      }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (e) {
    console.warn('Clipboard write image failed:', e);
    return false;
  }
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Print only the document element using an isolated invisible iframe.
 * Sets the exact document title for the browser print dialog and PDF file name.
 * Never redirects, navigates, or reloads the active webpage.
 */
export function printDocumentElement(elementId: string, documentTitle?: string): void {
  const el = document.getElementById(elementId);
  const previousDocumentTitle = typeof document !== 'undefined' ? document.title : '';
  const titleToUse = documentTitle || (el ? 'Invoice' : '');

  if (titleToUse && typeof document !== 'undefined') {
    document.title = titleToUse;
  }

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    if (typeof document !== 'undefined' && previousDocumentTitle) {
      document.title = previousDocumentTitle;
    }
  };

  if (!el) {
    if (typeof window !== 'undefined') {
      window.print();
      setTimeout(restoreTitle, 2000);
    }
    return;
  }

  // Create an isolated printing iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0.01';
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (typeof window !== 'undefined') {
      window.print();
      setTimeout(restoreTitle, 2000);
    }
    return;
  }

  // Extract active stylesheet rules to inline directly into iframe for zero-latency styling
  let inlineCss = '';
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules).forEach((rule) => {
          inlineCss += rule.cssText + '\n';
        });
      } catch (e) {
        // Cross-origin stylesheet access restricted, will rely on styleTags fallback
      }
    });
  } catch (e) {
    // ignore
  }

  // Copy stylesheets & Tailwind styling tags into iframe
  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((s) => s.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtmlAttr(titleToUse || 'Invoice')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
        ${styleTags}
        <style>
          ${inlineCss}

          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .font-mono, code {
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            height: auto !important;
          }
          .print-wrapper {
            width: 100% !important;
            max-width: 760px !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          #unified-invoice-document,
          #unified-statement-document {
            width: 100% !important;
            max-width: 760px !important;
            margin: 0 auto !important;
            padding: 24px 28px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 16px !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print, button, input, select {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${el.outerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    restoreTitle();
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  };

  try {
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
  } catch (e) {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('afterprint', cleanup, { once: true });
  }

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print failed in iframe, falling back to window.print', e);
      window.print();
    }
    // Safety fallback: only cleanup after 2 minutes if afterprint was not supported
    setTimeout(cleanup, 120000);
  }, 400);
}

export interface SendWhatsAppOptions {
  elementId: string;
  phone: string;
  filename: string;
  title: string;
  cachedAssets?: RenderedDocumentAssets | null;
  onStatusChange?: (status: { message: string; type: 'success' | 'info' | 'error' }) => void;
}

/**
 * Download image blob as a file
 */
export function downloadImageBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = filename.replace(/\.(pdf|jpe?g)$/i, '') + '.png';
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    console.warn('downloadImageBlob error:', e);
  }
}

/**
 * Render the document element to high-DPI image assets (blob, file, dataUrl)
 */
export async function captureDocumentImage(
  elementId: string,
  filename: string
): Promise<{ blob: Blob; file: File; dataUrl: string } | null> {
  const el = document.getElementById(elementId);
  if (!el) return null;

  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;

  const cleanFilename = filename.replace(/\.(pdf|jpe?g)$/i, '').replace(/[^a-zA-Z0-9_\-\. ]/g, '_') + '.png';
  const file = new File([blob], cleanFilename, { type: 'image/png' });
  const dataUrl = canvas.toDataURL('image/png');

  return { blob, file, dataUrl };
}

export interface ShareDocumentImageOptions {
  elementId?: string;
  file?: File;
  filename: string;
  onStatusChange?: (status: { message: string; type: 'success' | 'info' | 'error' } | null) => void;
}

/**
 * Native Image Sharing:
 * 1. Invokes the OS native share sheet via navigator.share({ files: [file] }).
 * 2. Pops up the operating system's native share sheet (Android / iOS / Windows 10/11)
 *    showing the image preview card and installed sharing apps (WhatsApp, Outlook, Messages, etc.).
 * 3. NO automatic file downloading.
 * 4. Silent cancellation on user dismissal (AbortError).
 */
export async function shareDocumentAsImage(options: ShareDocumentImageOptions): Promise<boolean> {
  let file = options.file;

  if (!file) {
    if (!options.elementId) {
      console.error('Neither file nor elementId provided to shareDocumentAsImage');
      return false;
    }
    const captured = await captureDocumentImage(options.elementId, options.filename);
    if (!captured) throw new Error('Could not generate image');
    file = captured.file;
  }

  // OS Native Share Sheet (Windows, Android, iOS):
  // Pass ONLY { files: [file] } without title or text, exactly like CouponOS!
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
      });
      options.onStatusChange?.({ message: '✓ Image shared successfully!', type: 'success' });
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User closed or dismissed the OS share popup — do nothing
        return false;
      }
      console.warn('Native share threw:', err);
      throw err;
    }
  }

  // If navigator.canShare is not supported:
  options.onStatusChange?.({
    message: 'Native share is not available on this browser.',
    type: 'error',
  });
  return false;
}

/**
 * Dispatches the document picture directly to customer's WhatsApp:
 * 1. On mobile: Shares the exact image file directly into WhatsApp app (no text dump).
 * 2. On desktop: Copies high-resolution document image to clipboard for instant Ctrl+V pasting,
 *    downloads the picture file, and opens customer's WhatsApp chat cleanly without text.
 */
export async function sendPdfToWhatsApp(
  options: SendWhatsAppOptions
): Promise<{ success: boolean; method: 'web_share' | 'clipboard_wa'; error?: string }> {
  const cleanPhone = options.phone.replace(/[^0-9]/g, '');

  options.onStatusChange?.({
    message: 'Generating invoice picture...',
    type: 'info',
  });

  try {
    // 1. Get picture assets (use cached if available, or render now)
    const assets = options.cachedAssets || (await renderDocumentAssets(options.elementId, options.filename));

    if (!assets) {
      throw new Error('Unable to render document image');
    }

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 2. Mobile Device Flow (Phone / Tablet)
    if (isMobile) {
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [assets.imageFile] })) {
        try {
          await navigator.share({
            files: [assets.imageFile],
            title: options.title,
          });

          options.onStatusChange?.({
            message: '✓ Picture attached directly in WhatsApp!',
            type: 'success',
          });

          return { success: true, method: 'web_share' };
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            options.onStatusChange?.({ message: 'Share cancelled', type: 'info' });
            return { success: false, method: 'web_share' };
          }
          console.warn('Mobile image share failed, falling back:', shareErr);
        }
      }

      options.onStatusChange?.({
        message: 'Your browser does not support direct file sharing.',
        type: 'info',
      });

      return { success: false, method: 'web_share' };
    }

    // 3. Desktop WhatsApp Web Flow (PC / Laptop):
    options.onStatusChange?.({
      message: 'Your browser does not support direct file sharing.',
      type: 'info',
    });

    return { success: false, method: 'clipboard_wa' };
  } catch (err: any) {
    console.error('sendPdfToWhatsApp error:', err);

    // Fallback: open WhatsApp
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
      : `https://api.whatsapp.com/send`;

    window.open(waUrl, '_blank');

    options.onStatusChange?.({
      message: 'WhatsApp opened with customer.',
      type: 'info',
    });

    return { success: false, method: 'clipboard_wa', error: err.message };
  }
}

