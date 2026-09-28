/**
 * Advanced multi-token search utility for ERP dropdowns and lists.
 * Matches even if the user searches by the 2nd word, 3rd word, or words in any order.
 * 
 * Example:
 *   matchesAdvancedSearch("Black Granite Slab 18mm", "granite") -> true
 *   matchesAdvancedSearch("Black Granite Slab 18mm", "slab black") -> true
 *   matchesAdvancedSearch("Shree Shyam Marble Traders", "traders shree") -> true
 *   matchesAdvancedSearch("Ramesh Chand Sharma", "sharma") -> true
 */
export function matchesAdvancedSearch(text: string | undefined | null, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!text) return false;

  const cleanText = text.toLowerCase().trim();
  // Split query by whitespace to allow multi-token searching
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;

  // ALL tokens must be found somewhere in the text (any order, anywhere in words)
  return tokens.every((token) => cleanText.includes(token));
}

/**
 * Unified dropdown ordering used across the ERP: pure-number / number-first entries
 * come BEFORE alphabetic entries, and within each group we use natural (numeric-aware)
 * ordering so "Item 2" sorts before "Item 10".
 */
export function smartCompare(a: string | undefined | null, b: string | undefined | null): number {
  const aStr = (a || '').trim();
  const bStr = (b || '').trim();
  const aStartsNum = /^[0-9]/.test(aStr);
  const bStartsNum = /^[0-9]/.test(bStr);
  if (aStartsNum && !bStartsNum) return -1; // numbers first
  if (!aStartsNum && bStartsNum) return 1;
  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
}

export function filterByAdvancedSearch<T>(
  items: T[],
  query: string,
  fieldExtractor: (item: T) => string[]
): T[] {
  if (!query || !query.trim()) return items;

  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const fields = fieldExtractor(item).map((f) => (f || '').toLowerCase());
    const combined = fields.join(' ');
    return tokens.every((token) => combined.includes(token));
  });
}
