/**
 * Date Utilities for Garage ERP
 * Ensures all dates use local / company timezone rather than UTC ISO string conversions.
 * Avoids the UTC-offset bug where `new Date().toISOString().split('T')[0]` returns yesterday
 * when the local time is after midnight (e.g. GMT+4).
 */

export function getLocalDateString(dateInput?: Date | string | number | null, timeZone?: string): string {
  if (!dateInput) {
    return formatLocalYMD(new Date(), timeZone);
  }

  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return formatLocalYMD(new Date(), timeZone);
  }

  return formatLocalYMD(d, timeZone);
}

function formatLocalYMD(d: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(d);
    } catch {
      // Fallback to local system time if timeZone identifier is invalid
    }
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayString(timeZone?: string): string {
  return getLocalDateString(new Date(), timeZone);
}

export function getYesterdayString(timeZone?: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d, timeZone);
}

export function getFirstDayOfMonthString(dateInput?: Date | string | number, timeZone?: string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return getLocalDateString(first, timeZone);
}

export function getLastDayOfMonthString(year: number, monthZeroIndexed: number, timeZone?: string): string {
  const last = new Date(year, monthZeroIndexed + 1, 0);
  return getLocalDateString(last, timeZone);
}
