/**
 * Universal number, quantity, pcs, and currency formatting utilities
 * with Indian number system thousand separators (en-IN).
 * Rule: Pcs (Pieces) are always strictly 2 decimal places.
 */

/**
 * Formats an amount with thousand separators.
 * Defaults to 2 decimal places if not specified.
 * Example: 1234567.89 -> "12,34,567.89"
 */
export function formatAmount(
  val: number | string | null | undefined,
  decimalPlaces: number = 2
): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const clean = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
  if (isNaN(clean)) return '0.00';
  const dec = Math.max(0, decimalPlaces);
  return clean.toLocaleString('en-IN', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/**
 * Formats a quantity with thousand separators.
 * If decimalPlaces is specified, it will use that exact precision.
 * Otherwise, it will format using natural fractional digits (up to 3 decimals).
 * Example: 1500 -> "1,500", 1250.75 -> "1,250.75"
 */
export function formatQty(
  val: number | string | null | undefined,
  decimalPlaces?: number
): string {
  if (val === null || val === undefined || val === '') return '0';
  const clean = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
  if (isNaN(clean)) return '0';

  if (decimalPlaces !== undefined && decimalPlaces !== null && !isNaN(Number(decimalPlaces))) {
    const dec = Math.max(0, Number(decimalPlaces));
    return clean.toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  // If no decimal places specified, format up to 3 decimals or natural
  return clean.toLocaleString('en-IN', {
    minimumFractionDigits: clean % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 3,
  });
}

/**
 * Formats PCS (Pieces) - MUST ALWAYS HAVE EXACTLY 2 DECIMAL PLACES and thousand separators!
 * e.g. 50 -> "50.00", 1250 -> "1,250.00", 10.5 -> "10.50"
 */
export function formatPcs(
  val: number | string | null | undefined
): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const clean = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
  if (isNaN(clean)) return '0.00';
  return clean.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats Currency with ₹ and Indian thousand separators.
 * Defaults to 2 decimal places.
 * Example: 100000 -> "₹1,00,000.00"
 */
export function formatCurrency(
  val: number | string | null | undefined,
  decimalPlaces: number = 2
): string {
  if (val === null || val === undefined || val === '') return '₹0.00';
  const clean = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
  if (isNaN(clean)) return '₹0.00';
  const dec = Math.max(0, decimalPlaces);
  const isNeg = clean < 0;
  const absFormatted = Math.abs(clean).toLocaleString('en-IN', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return isNeg ? `-₹${absFormatted}` : `₹${absFormatted}`;
}

/**
 * Formats a unit-aware quantity with thousand separators:
 * If unit is PCS / NOS / item is pieces, formats with exactly 2 decimals!
 * Otherwise uses configured decimal precision or standard quantity formatting.
 */
export function formatUnitQty(
  val: number | string | null | undefined,
  unit?: string,
  decimalPlaces?: number
): string {
  if (val === null || val === undefined || val === '') return '0';
  const cleanUnit = (unit || '').trim().toUpperCase();
  if (cleanUnit === 'PCS' || cleanUnit === 'PIECES' || cleanUnit === 'PIECE') {
    return `${formatPcs(val)} ${unit || 'Pcs'}`;
  }
  return `${formatQty(val, decimalPlaces)} ${unit || ''}`.trim();
}
