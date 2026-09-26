/**
 * Global Date Utilities for DD/MM/YYYY standard across the application
 */

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDisplay(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Converts any date representation (ISO YYYY-MM-DD, timestamp, Date, or DD/MM/YYYY)
 * to standard display format: DD/MM/YYYY
 */
export function formatDateDisplay(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '';

  // Already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [d, m, y] = str.split('-');
    return `${d}/${m}/${y}`;
  }

  // ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const cleanStr = str.split('T')[0];
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }

  // Fallback try native Date parsing
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // ignore
  }

  return str;
}

/**
 * Converts DD/MM/YYYY or DD-MM-YYYY to ISO YYYY-MM-DD
 */
export function parseDisplayToISO(displayStr: string | undefined | null): string {
  if (!displayStr) return getTodayISO();
  const str = displayStr.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return parseFlexibleDate(str).iso;
}

/**
 * Comprehensive parser for all user date inputs (Tally-style shortcuts, delimiters, continuous digits)
 */
export function parseFlexibleDate(
  input: string | undefined | null,
  referenceDate?: Date
): { iso: string; display: string; isValid: boolean } {
  const ref = referenceDate || new Date();
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth() + 1;
  const refDay = ref.getDate();

  const defaultIso = `${refYear}-${String(refMonth).padStart(2, '0')}-${String(refDay).padStart(2, '0')}`;
  const defaultDisplay = `${String(refDay).padStart(2, '0')}/${String(refMonth).padStart(2, '0')}/${refYear}`;

  if (!input || !input.trim()) {
    return { iso: defaultIso, display: defaultDisplay, isValid: true };
  }

  const raw = input.trim();

  // Keywords 'today', 't', 'now'
  if (/^(t|today|now)$/i.test(raw)) {
    const todayIso = getTodayISO();
    return { iso: todayIso, display: formatDateDisplay(todayIso), isValid: true };
  }

  let day = refDay;
  let month = refMonth;
  let year = refYear;

  // Check if input is delimited by /, -, ., space, or comma
  const parts = raw.split(/[/.\-,\s]+/).filter(Boolean);

  if (parts.length >= 3) {
    // Check if first part is 4-digit year (YYYY-MM-DD)
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // DD/MM/YYYY or DD/MM/YY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) {
        year = 2000 + y;
      } else {
        year = y;
      }
    }
  } else if (parts.length === 2) {
    // DD/MM -> current year
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = refYear;
  } else if (parts.length === 1) {
    const digitsOnly = parts[0].replace(/\D/g, '');
    if (digitsOnly.length === 8) {
      // DDMMYYYY (e.g. 15082026)
      day = parseInt(digitsOnly.slice(0, 2), 10);
      month = parseInt(digitsOnly.slice(2, 4), 10);
      year = parseInt(digitsOnly.slice(4, 8), 10);
    } else if (digitsOnly.length === 6) {
      // DDMMYY (e.g. 150826)
      day = parseInt(digitsOnly.slice(0, 2), 10);
      month = parseInt(digitsOnly.slice(2, 4), 10);
      const yy = parseInt(digitsOnly.slice(4, 6), 10);
      year = 2000 + yy;
    } else if (digitsOnly.length === 4) {
      // DDMM (e.g. 1508)
      day = parseInt(digitsOnly.slice(0, 2), 10);
      month = parseInt(digitsOnly.slice(2, 4), 10);
      year = refYear;
    } else if (digitsOnly.length >= 1 && digitsOnly.length <= 2) {
      // DD only (e.g. 15 or 5)
      day = parseInt(digitsOnly, 10);
      month = refMonth;
      year = refYear;
    } else {
      return { iso: defaultIso, display: defaultDisplay, isValid: false };
    }
  }

  // Validate and clamp month
  if (isNaN(month) || month < 1) month = 1;
  if (month > 12) month = 12;

  // Validate and clamp year
  if (isNaN(year) || year < 1900) year = refYear;
  if (year > 2100) year = 2100;

  // Validate and clamp day
  const maxDays = getDaysInMonth(month, year);
  if (isNaN(day) || day < 1) day = 1;
  if (day > maxDays) day = maxDays;

  const dStr = String(day).padStart(2, '0');
  const mStr = String(month).padStart(2, '0');
  const yStr = String(year).padStart(4, '20');

  const iso = `${yStr}-${mStr}-${dStr}`;
  const display = `${dStr}/${mStr}/${yStr}`;

  return { iso, display, isValid: true };
}

/**
 * Splits an ISO date string or Date into DD, MM, YYYY strings
 */
export function splitDateParts(dateInput: string | Date | undefined | null): {
  day: string;
  month: string;
  year: string;
} {
  const today = new Date();
  const defaultParts = {
    day: String(today.getDate()).padStart(2, '0'),
    month: String(today.getMonth() + 1).padStart(2, '0'),
    year: String(today.getFullYear()),
  };

  if (!dateInput) return defaultParts;

  const display = formatDateDisplay(dateInput);
  const parts = display.split('/');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return {
      day: parts[0].padStart(2, '0'),
      month: parts[1].padStart(2, '0'),
      year: parts[2],
    };
  }

  return defaultParts;
}

/**
 * Clamps day based on month and year
 */
export function getDaysInMonth(month: number, year: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * Extracts 2-digit start year (XX) and 2-digit end year (YY) from FiscalYear
 */
export function getFiscalYearDigits(fiscalYear?: { startDate?: string; endDate?: string; name?: string } | null): { xx: string; yy: string } {
  let xx = '';
  let yy = '';

  if (fiscalYear?.startDate) {
    const sYear = parseInt(fiscalYear.startDate.split('-')[0], 10);
    if (!isNaN(sYear) && sYear > 1900) {
      xx = String(sYear).slice(-2);
    }
  }

  if (fiscalYear?.endDate) {
    const eYear = parseInt(fiscalYear.endDate.split('-')[0], 10);
    if (!isNaN(eYear) && eYear > 1900) {
      yy = String(eYear).slice(-2);
    }
  }

  if (!xx || !yy) {
    if (fiscalYear?.name) {
      const match = fiscalYear.name.match(/(\d{2,4})\s*[-/]\s*(\d{2,4})/);
      if (match) {
        xx = match[1].slice(-2);
        yy = match[2].slice(-2);
      }
    }
  }

  if (!xx || !yy) {
    const currentYear = new Date().getFullYear();
    xx = String(currentYear).slice(-2);
    yy = String(currentYear + 1).slice(-2);
  }

  return { xx, yy };
}

/**
 * Returns default file name for Trial Balance: "Trial Bal. (XX-YY)"
 */
export function getTrialBalanceDefaultFilename(fiscalYear?: { startDate?: string; endDate?: string; name?: string } | null): string {
  const { xx, yy } = getFiscalYearDigits(fiscalYear);
  return `Trial Bal. (${xx}-${yy})`;
}
