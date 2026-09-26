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
 * Filter an array of items by checking multiple fields with tokenized advanced search.
 */
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
