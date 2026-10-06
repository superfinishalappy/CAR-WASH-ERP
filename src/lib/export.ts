import * as XLSX from 'xlsx';

export function exportToCSV(filename: string, rows: Record<string, any>[]): void {
  if (!rows || rows.length === 0) {
    alert('No data available to export.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToXLSX(filename: string, sheets: { name: string; data: Record<string, any>[] }[]): void {
  if (!sheets || sheets.length === 0) {
    alert('No sheets to export.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.data.length ? s.data : [{ 'No Data': '' }]);
    XLSX.utils.book_append_sheet(workbook, ws, s.name.substring(0, 31)); // 31 char max for sheet name
  });

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function printElement(elementId?: string, documentTitle?: string): void {
  if (typeof window !== 'undefined') {
    const originalTitle = document.title;
    if (documentTitle) {
      document.title = documentTitle;
    }
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      if (documentTitle) {
        document.title = originalTitle;
      }
    };
    window.addEventListener('afterprint', restore, { once: true });
    window.print();
    setTimeout(restore, 120000);
  }
}
