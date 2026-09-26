import { ShortcutKeyConfig } from '../types';

const STORAGE_KEY = 'bahikhata_erp_shortcuts_v1';
const LEGACY_STORAGE_KEY = 'lekhaveda_erp_shortcuts_v1';

export const DEFAULT_SHORTCUTS: ShortcutKeyConfig[] = [
  // Voucher Fast Keys
  {
    id: 'sc-contra',
    label: 'Contra Voucher',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'CONTRA',
    key: 'F4',
    enabled: true,
    isSystemDefault: true,
    description: 'Quick Bank to Cash / Bank to Bank Contra Entry',
  },
  {
    id: 'sc-payment',
    label: 'Payment Voucher',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'PAYMENT',
    key: 'F5',
    enabled: true,
    isSystemDefault: true,
    description: 'Record Expense or Outward Payment',
  },
  {
    id: 'sc-receipt',
    label: 'Receipt Voucher',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'RECEIPT',
    key: 'F6',
    enabled: true,
    isSystemDefault: true,
    description: 'Record Inward Customer / Revenue Receipt',
  },
  {
    id: 'sc-journal',
    label: 'Journal Voucher',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'JOURNAL',
    key: 'F7',
    enabled: true,
    isSystemDefault: true,
    description: 'Record Adjustment and Non-Cash Entries',
  },
  {
    id: 'sc-sales',
    label: 'Sales Invoice',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'SALES',
    key: 'F8',
    enabled: true,
    isSystemDefault: true,
    description: 'Create Outward Sales Invoice with Inventory Stock',
  },
  {
    id: 'sc-purchase',
    label: 'Purchase Invoice',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'PURCHASE',
    key: 'F9',
    enabled: true,
    isSystemDefault: true,
    description: 'Create Inward Purchase Invoice with Inventory Stock',
  },
  {
    id: 'sc-debit-note',
    label: 'Debit Note (Purchase Return)',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'PURCHASE_RETURN',
    key: 'F10',
    enabled: true,
    isSystemDefault: true,
    description: 'Purchase Return / Vendor Debit Note',
  },
  {
    id: 'sc-credit-note',
    label: 'Credit Note (Sales Return)',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'SALES_RETURN',
    key: 'F11',
    enabled: true,
    isSystemDefault: true,
    description: 'Sales Return / Customer Credit Note',
  },
  {
    id: 'sc-quick-new',
    label: 'Quick Voucher Entry',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'PAYMENT',
    key: 'N',
    ctrlKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Open standard voucher creation',
  },

  // Navigation Keys
  {
    id: 'sc-nav-dash',
    label: 'Open Dashboard',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'dashboard',
    key: 'D',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Main ERP Dashboard',
  },
  {
    id: 'sc-nav-vouchers',
    label: 'Open Voucher Register',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'vouchers',
    key: 'V',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Voucher Register',
  },
  {
    id: 'sc-nav-ledgers',
    label: 'Open Ledger Statement',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'ledgers',
    key: 'L',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Account Ledger Statements',
  },
  {
    id: 'sc-nav-daybook',
    label: 'Open Day Book',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'day_book',
    key: 'B',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Day Book',
  },
  {
    id: 'sc-nav-stock',
    label: 'Open Stock Summary',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'inventory_summary',
    key: 'S',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Inventory Stock Summary',
  },
  {
    id: 'sc-nav-stock-journal',
    label: 'Open Stock Journal',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'stock_journal',
    key: 'J',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Stock Journal (Manufacturing & Transfers)',
  },
  {
    id: 'sc-nav-trial',
    label: 'Open Trial Balance',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'trial_balance',
    key: 'T',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Trial Balance Report',
  },
  {
    id: 'sc-nav-brs',
    label: 'Open Bank Reconciliation',
    category: 'Navigation',
    actionType: 'NAVIGATE_TAB',
    targetPayload: 'bank_reconciliation',
    key: 'R',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Jump to Bank Reconciliation (BRS)',
  },

  // Actions
  {
    id: 'sc-act-search',
    label: 'Global Search',
    category: 'Actions',
    actionType: 'GLOBAL_SEARCH',
    key: 'F',
    ctrlKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Search accounts, ledgers, items and vouchers',
  },
  {
    id: 'sc-act-sync',
    label: 'Cloud Sync',
    category: 'Actions',
    actionType: 'SYNC_CLOUD',
    key: 'Y',
    altKey: true,
    enabled: true,
    isSystemDefault: true,
    description: 'Trigger instant cloud synchronization',
  },
];

export const shortcutService = {
  loadShortcuts(): ShortcutKeyConfig[] {
    try {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        stored = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (stored) {
          localStorage.setItem(STORAGE_KEY, stored);
        }
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load custom shortcuts from localStorage:', e);
    }
    return DEFAULT_SHORTCUTS;
  },

  saveShortcuts(shortcuts: ShortcutKeyConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch (e) {
      console.error('Failed to save shortcuts to localStorage:', e);
    }
  },

  resetToDefault(): ShortcutKeyConfig[] {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to reset shortcuts:', e);
    }
    return [...DEFAULT_SHORTCUTS];
  },

  formatKeyCombo(sc: Pick<ShortcutKeyConfig, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
    const parts: string[] = [];
    if (sc.ctrlKey) parts.push('Ctrl');
    if (sc.altKey) parts.push('Alt');
    if (sc.shiftKey) parts.push('Shift');
    if (sc.metaKey) parts.push('Cmd');
    parts.push(sc.key ? sc.key.toUpperCase() : '');
    return parts.join(' + ');
  },

  matchesEvent(e: KeyboardEvent, sc: ShortcutKeyConfig): boolean {
    if (!sc.enabled || !sc.key) return false;

    // Normalize keys
    const eventKey = e.key.toUpperCase();
    const configKey = sc.key.toUpperCase();

    // Check key match
    if (eventKey !== configKey) {
      // Special handle for function keys or uppercase single characters
      if (configKey.startsWith('F') && eventKey === configKey) {
        // match
      } else {
        return false;
      }
    }

    // Check modifier keys match exactly
    const matchCtrl = Boolean(sc.ctrlKey) === (e.ctrlKey || (sc.metaKey ? e.metaKey : false));
    const matchAlt = Boolean(sc.altKey) === e.altKey;
    const matchShift = Boolean(sc.shiftKey) === e.shiftKey;

    return matchCtrl && matchAlt && matchShift;
  },
};
