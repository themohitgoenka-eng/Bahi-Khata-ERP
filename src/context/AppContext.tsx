import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Company, FiscalYear, Voucher, VoucherType, AccountGroup, Ledger, InventoryItem, BankAccount, Location, ShortcutKeyConfig, CityMasterItem, StateMasterItem, WorkspaceTab } from '../types';
import { TransactionRecord } from '../db';
import { dbStorage } from '../services/storage/indexedDbStorage';
import { syncEngine, SyncStatusSummary } from '../services/syncEngine';
import { shortcutService } from '../services/shortcutService';
import { cityStateService } from '../services/storage/cityStateService';
import { masterSyncService } from '../services/masterSyncService';
import { startRealtime, stopRealtime, REMOTE_CHANGE_EVENT } from '../services/realtimeSync';
import { getTabMeta, createDefaultDashboardTab } from '../utils/tabUtils';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  // Navigation & Company context
  currentCompany: Company | null;
  currentFiscalYear: FiscalYear | null;
  companies: Company[];
  fiscalYears: FiscalYear[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openTabs: WorkspaceTab[];
  openOrSwitchTab: (tabKey: string, ledgerId?: string | null, ledgerName?: string | null) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (keepTabId: string) => void;
  closeAllTabs: () => void;
  selectedLedgerId: string | null;
  setSelectedLedgerId: (id: string | null) => void;
  selectedLedgerName: string | null;
  setSelectedLedgerName: (name: string | null) => void;
  openLedger: (ledgerId: string, ledgerName?: string, inNewTab?: boolean) => void;
  isSystemInitialized: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;

  // Master lists for active context
  accountGroups: AccountGroup[];
  ledgers: Ledger[];
  inventoryItems: InventoryItem[];
  bankAccounts: BankAccount[];
  locations: Location[];
  saveLocation: (location: Location) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;

  // City & State Master
  cities: CityMasterItem[];
  states: StateMasterItem[];
  saveCity: (city: CityMasterItem) => Promise<void>;
  deleteCity: (id: string) => Promise<void>;
  setDefaultCity: (id: string) => Promise<void>;

  // Network & Sync State
  isOnline: boolean;
  syncSummary: SyncStatusSummary | null;
  pendingSyncCount: number;
  setOnlineMode: (online: boolean) => void;
  triggerSync: () => Promise<void>;

  // Voucher Modal Management
  voucherModalOpen: boolean;
  isVoucherModalOpen: boolean;
  voucherModalType: VoucherType;
  editingVoucher: Voucher | null;
  voucherModalPrefillLedgerId: string | null;
  vouchersVersion: number;
  notifyVouchersUpdated: () => void;
  openVoucherModal: (type?: VoucherType, voucherToEdit?: Voucher, prefillLedgerId?: string) => void;
  closeVoucherModal: () => void;

  // App-level Invoice Modal (persists across tab switches)
  invoiceModal: {
    formType: 'sales_invoice' | 'purchase_invoice' | 'spare_parts_purchase';
    initialData: TransactionRecord | null;
    nextBillNo: string;
    defaultPrintView: boolean;
  } | null;
  openInvoiceModal: (opts: {
    formType: 'sales_invoice' | 'purchase_invoice' | 'spare_parts_purchase';
    initialData?: TransactionRecord | null;
    nextBillNo?: string;
    defaultPrintView?: boolean;
    onClose?: () => void;
    onSaveSuccess?: () => void;
  }) => void;
  closeInvoiceModal: () => void;
  invoiceModalCallbacks: React.MutableRefObject<{ onClose?: () => void; onSaveSuccess?: () => void }>;

  // Minimized Bill / Invoice in Workspace Tabbar
  minimizedInvoice: {
    title: string;
    formType: string;
    billNo: string;
    party?: string;
  } | null;
  setMinimizedInvoice: (info: { title: string; formType: string; billNo: string; party?: string } | null) => void;
  restoreMinimizedInvoice: () => void;
  closeMinimizedInvoice: () => void;
  registerRestoreInvoiceHandler: (handler: (() => void) | null) => void;
  registerCloseInvoiceHandler: (handler: (() => void) | null) => void;

  // Global Search Modal
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;

  // Shortcut Keys Management
  shortcuts: ShortcutKeyConfig[];
  addShortcut: (shortcut: Omit<ShortcutKeyConfig, 'id'>) => boolean;
  updateShortcut: (id: string, updated: Partial<ShortcutKeyConfig>) => boolean;
  deleteShortcut: (id: string) => void;
  resetShortcutsToDefault: () => void;
  isShortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;

  // Actions
  switchCompany: (companyId: string) => Promise<void>;
  switchFiscalYear: (fiscalYearId: string) => Promise<void>;
  createCompany: (company: Company) => Promise<void>;
  updateCompany: (company: Company) => Promise<void>;
  deleteCompany: (companyId: string) => Promise<void>;
  createFiscalYear: (fy: FiscalYear) => Promise<void>;
  updateFiscalYear: (fy: FiscalYear) => Promise<FiscalYear[]>;
  deleteFiscalYear: (
    fiscalYearId: string,
    companyId?: string,
    fyName?: string,
    startDate?: string,
    endDate?: string
  ) => Promise<FiscalYear[]>;
  refreshFiscalYears: (companyId?: string) => Promise<FiscalYear[]>;
  refreshActiveData: () => Promise<void>;

  // Notifications
  notification: Notification | null;
  notifications: Notification[];
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentFiscalYear, setCurrentFiscalYear] = useState<FiscalYear | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);

  // Parse initial tab and ledgerId from URL query parameters (supports opening in new tab)
  const getInitialUrlParams = () => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const ledgerId = params.get('ledgerId');
        const ledgerName = params.get('ledgerName');
        return {
          tab: tab || 'dashboard',
          ledgerId: ledgerId || null,
          ledgerName: ledgerName || null,
        };
      } catch {
        // ignore
      }
    }
    return { tab: 'dashboard', ledgerId: null, ledgerName: null };
  };

  const initialUrlParams = useMemo(() => getInitialUrlParams(), []);
  const [activeTab, setActiveTabState] = useState<string>(initialUrlParams.tab);
  const [selectedLedgerId, setSelectedLedgerIdState] = useState<string | null>(initialUrlParams.ledgerId);
  const [selectedLedgerName, setSelectedLedgerNameState] = useState<string | null>(initialUrlParams.ledgerName);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);

  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => {
    const dash = createDefaultDashboardTab();
    if (initialUrlParams.tab && initialUrlParams.tab !== 'dashboard') {
      const meta = getTabMeta(initialUrlParams.tab, initialUrlParams.ledgerName);
      const tabId =
        initialUrlParams.tab === 'ledgers' && initialUrlParams.ledgerId
          ? `ledgers:${initialUrlParams.ledgerId}`
          : initialUrlParams.tab;
      return [
        dash,
        {
          id: tabId,
          tabKey: initialUrlParams.tab,
          title: meta.title,
          iconName: meta.iconName,
          closable: true,
          ledgerId: initialUrlParams.ledgerId,
          ledgerName: initialUrlParams.ledgerName,
        },
      ];
    }
    return [dash];
  });

  const openOrSwitchTab = useCallback(
    (tabKey: string, ledgerId?: string | null, ledgerName?: string | null) => {
      let tabId = tabKey;
      if (tabKey === 'ledgers' && ledgerId) {
        tabId = `ledgers:${ledgerId}`;
      }

      setOpenTabs((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === tabId);
        if (existingIdx >= 0) {
          if (tabKey === 'ledgers' && ledgerName && prev[existingIdx].title !== ledgerName) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              title: ledgerName,
              ledgerName,
            };
            return updated;
          }
          return prev;
        }

        const meta = getTabMeta(tabKey, ledgerName);
        const newTab: WorkspaceTab = {
          id: tabId,
          tabKey,
          title: meta.title,
          iconName: meta.iconName,
          closable: tabKey !== 'dashboard',
          ledgerId: ledgerId || null,
          ledgerName: ledgerName || null,
        };
        return [...prev, newTab];
      });

      setActiveTabState(tabKey);
      if (tabKey === 'ledgers') {
        if (ledgerId) {
          setSelectedLedgerIdState(ledgerId);
        }
        if (ledgerName) {
          setSelectedLedgerNameState(ledgerName);
        }
      }

      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', tabKey);
          if (tabKey === 'ledgers') {
            if (ledgerId) {
              url.searchParams.set('ledgerId', ledgerId);
              if (ledgerName) url.searchParams.set('ledgerName', ledgerName);
            }
          } else {
            url.searchParams.delete('ledgerId');
            url.searchParams.delete('ledgerName');
          }
          window.history.replaceState({}, '', url.toString());
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      openOrSwitchTab(tab, tab === 'ledgers' ? selectedLedgerId : null, tab === 'ledgers' ? selectedLedgerName : null);
    },
    [openOrSwitchTab, selectedLedgerId, selectedLedgerName]
  );

  const setSelectedLedgerId = useCallback((id: string | null) => {
    setSelectedLedgerIdState(id);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (id) {
          url.searchParams.set('ledgerId', id);
        } else {
          url.searchParams.delete('ledgerId');
        }
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const setSelectedLedgerName = useCallback((name: string | null) => {
    setSelectedLedgerNameState(name);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (name) {
          url.searchParams.set('ledgerName', name);
        } else {
          url.searchParams.delete('ledgerName');
        }
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const tabToClose = prev.find((t) => t.id === tabId);
        if (!tabToClose || !tabToClose.closable) return prev;

        const filtered = prev.filter((t) => t.id !== tabId);
        const safeTabs = filtered.length > 0 ? filtered : [createDefaultDashboardTab()];

        const isCurrentActive =
          activeTab === tabToClose.tabKey &&
          (tabToClose.tabKey !== 'ledgers' || tabToClose.ledgerId === selectedLedgerId);

        if (isCurrentActive) {
          const closedIdx = prev.findIndex((t) => t.id === tabId);
          const nextTarget = safeTabs[Math.min(closedIdx, safeTabs.length - 1)] || safeTabs[0];
          setActiveTabState(nextTarget.tabKey);
          setSelectedLedgerIdState(nextTarget.ledgerId || null);
          setSelectedLedgerNameState(nextTarget.ledgerName || null);

          if (typeof window !== 'undefined') {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', nextTarget.tabKey);
              if (nextTarget.ledgerId) {
                url.searchParams.set('ledgerId', nextTarget.ledgerId);
                if (nextTarget.ledgerName) url.searchParams.set('ledgerName', nextTarget.ledgerName);
              } else {
                url.searchParams.delete('ledgerId');
                url.searchParams.delete('ledgerName');
              }
              window.history.replaceState({}, '', url.toString());
            } catch {
              // ignore
            }
          }
        }

        return safeTabs;
      });
    },
    [activeTab, selectedLedgerId]
  );

  const closeOtherTabs = useCallback((keepTabId: string) => {
    setOpenTabs((prev) => {
      const target = prev.find((t) => t.id === keepTabId);
      if (!target) return prev;
      const dash = prev.find((t) => t.id === 'dashboard') || createDefaultDashboardTab();
      const result = target.id === 'dashboard' ? [dash] : [dash, target];

      setActiveTabState(target.tabKey);
      setSelectedLedgerIdState(target.ledgerId || null);
      setSelectedLedgerNameState(target.ledgerName || null);
      return result;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    const dash = createDefaultDashboardTab();
    setOpenTabs([dash]);
    setActiveTabState('dashboard');
    setSelectedLedgerIdState(null);
    setSelectedLedgerNameState(null);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'dashboard');
        url.searchParams.delete('ledgerId');
        url.searchParams.delete('ledgerName');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const openLedger = useCallback(
    (ledgerId: string, ledgerName?: string, inNewTab: boolean = false) => {
      if (inNewTab && typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'ledgers');
          url.searchParams.set('ledgerId', ledgerId);
          if (ledgerName) {
            url.searchParams.set('ledgerName', ledgerName);
          } else {
            url.searchParams.delete('ledgerName');
          }
          const targetUrl = url.toString();
          const newWin = window.open(targetUrl, '_blank', 'noopener,noreferrer');
          if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
            openOrSwitchTab('ledgers', ledgerId, ledgerName);
          }
        } catch {
          openOrSwitchTab('ledgers', ledgerId, ledgerName);
        }
      } else {
        openOrSwitchTab('ledgers', ledgerId, ledgerName);
      }
    },
    [openOrSwitchTab]
  );

  // Sync state if user clicks browser Back/Forward
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const ledgerId = params.get('ledgerId');
        const ledgerName = params.get('ledgerName');
        if (tab) setActiveTabState(tab);
        if (ledgerId !== undefined) setSelectedLedgerIdState(ledgerId);
        if (ledgerName !== undefined) setSelectedLedgerNameState(ledgerName);
      } catch {
        // ignore
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bahikhata_sidebar_pinned');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return true;
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('bahikhata_sidebar_pinned', String(next));
      }
      return next;
    });
  }, []);

  // Responsive: keep the sidebar as a compact icon-rail on tablet/mobile so the
  // main content always gets full width (transient — does not overwrite the
  // user's desktop pin preference in localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyResponsive = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    };
    applyResponsive();
    window.addEventListener('resize', applyResponsive);
    return () => window.removeEventListener('resize', applyResponsive);
  }, []);

  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // City & State Master State
  const [cities, setCities] = useState<CityMasterItem[]>(() => cityStateService.getCities());
  const states = useMemo(() => cityStateService.getStates(), []);

  // Listen for cityStateService changes
  useEffect(() => {
    const unsub = cityStateService.subscribe(() => {
      setCities(cityStateService.getCities(currentCompany?.id));
    });
    return unsub;
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      setCities(cityStateService.getCities(currentCompany.id));
    }
  }, [currentCompany?.id]);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncSummary, setSyncSummary] = useState<SyncStatusSummary | null>(null);

  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);
  const [voucherModalType, setVoucherModalType] = useState<VoucherType>('PAYMENT');
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [voucherModalPrefillLedgerId, setVoucherModalPrefillLedgerId] = useState<string | null>(null);
  const [vouchersVersion, setVouchersVersion] = useState<number>(0);

  // App-level invoice modal — persists across tab switches (never unmounts on tab change)
  const [invoiceModal, setInvoiceModal] = useState<{
    formType: 'sales_invoice' | 'purchase_invoice' | 'spare_parts_purchase';
    initialData: TransactionRecord | null;
    nextBillNo: string;
    defaultPrintView: boolean;
  } | null>(null);
  const invoiceModalCallbacks = useRef<{ onClose?: () => void; onSaveSuccess?: () => void }>({});

  const openInvoiceModal = useCallback((opts: {
    formType: 'sales_invoice' | 'purchase_invoice' | 'spare_parts_purchase';
    initialData?: TransactionRecord | null;
    nextBillNo?: string;
    defaultPrintView?: boolean;
    onClose?: () => void;
    onSaveSuccess?: () => void;
  }) => {
    invoiceModalCallbacks.current = { onClose: opts.onClose, onSaveSuccess: opts.onSaveSuccess };
    setInvoiceModal({
      formType: opts.formType,
      initialData: opts.initialData ?? null,
      nextBillNo: opts.nextBillNo ?? '',
      defaultPrintView: opts.defaultPrintView ?? false,
    });
  }, []);

  const closeInvoiceModal = useCallback(() => {
    setInvoiceModal(null);
    invoiceModalCallbacks.current = {};
  }, []);

  // Minimized Bill / Invoice in Tabbar
  const [minimizedInvoice, setMinimizedInvoice] = useState<{
    title: string;
    formType: string;
    billNo: string;
    party?: string;
  } | null>(null);

  const restoreInvoiceHandlerRef = useRef<(() => void) | null>(null);
  const closeInvoiceHandlerRef = useRef<(() => void) | null>(null);

  const registerRestoreInvoiceHandler = useCallback((handler: (() => void) | null) => {
    restoreInvoiceHandlerRef.current = handler;
  }, []);

  const registerCloseInvoiceHandler = useCallback((handler: (() => void) | null) => {
    closeInvoiceHandlerRef.current = handler;
  }, []);

  const restoreMinimizedInvoice = useCallback(() => {
    // The handler inside SalesInvoiceModal calls setIsMinimized(false) AND setMinimizedInvoice(null)
    if (restoreInvoiceHandlerRef.current) {
      restoreInvoiceHandlerRef.current();
    } else {
      // Fallback if handler not registered (component unmounted unexpectedly)
      setMinimizedInvoice(null);
    }
  }, []);

  const closeMinimizedInvoice = useCallback(() => {
    // The handler inside SalesInvoiceModal calls onClose() AND setMinimizedInvoice(null)
    if (closeInvoiceHandlerRef.current) {
      closeInvoiceHandlerRef.current();
    } else {
      setMinimizedInvoice(null);
    }
  }, []);

  const notifyVouchersUpdated = useCallback(() => {
    setVouchersVersion((prev) => prev + 1);
  }, []);

  const [globalSearchOpen, setGlobalSearchOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [shortcuts, setShortcuts] = useState<ShortcutKeyConfig[]>(() => shortcutService.loadShortcuts());
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addShortcut = useCallback((newSc: Omit<ShortcutKeyConfig, 'id'>): boolean => {
    const id = `sc-${Date.now()}`;
    const fullSc: ShortcutKeyConfig = {
      ...newSc,
      id,
    };
    setShortcuts((prev) => {
      const updated = [...prev, fullSc];
      shortcutService.saveShortcuts(updated);
      return updated;
    });
    showNotification(`Shortcut "${shortcutService.formatKeyCombo(fullSc)}" for ${fullSc.label} added.`, 'success');
    return true;
  }, [showNotification]);

  const updateShortcut = useCallback((id: string, updatedFields: Partial<ShortcutKeyConfig>): boolean => {
    let modifiedLabel = '';
    setShortcuts((prev) => {
      const updated = prev.map((sc) => {
        if (sc.id === id) {
          const merged = { ...sc, ...updatedFields };
          modifiedLabel = merged.label;
          return merged;
        }
        return sc;
      });
      shortcutService.saveShortcuts(updated);
      return updated;
    });
    showNotification(`Shortcut for "${modifiedLabel || 'Action'}" updated successfully.`, 'success');
    return true;
  }, [showNotification]);

  const deleteShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const updated = prev.filter((sc) => sc.id !== id);
      shortcutService.saveShortcuts(updated);
      return updated;
    });
    showNotification('Shortcut removed.', 'info');
  }, [showNotification]);

  const resetShortcutsToDefault = useCallback(() => {
    const defaults = shortcutService.resetToDefault();
    setShortcuts(defaults);
    showNotification('All shortcuts restored to standard ERP defaults.', 'success');
  }, [showNotification]);

  // Load masters for active company + FY
  const refreshActiveData = useCallback(async () => {
    try {
      const activeCtx = dbStorage.getActiveContext();
      if (!activeCtx.companyId || !activeCtx.fiscalYearId) {
        setAccountGroups([]);
        setLedgers([]);
        setInventoryItems([]);
        setBankAccounts([]);
        setLocations([]);
        return;
      }
      const [groups, allLedgers, items, banks, locs] = await Promise.all([
        dbStorage.getAccountGroups(),
        dbStorage.getLedgers(),
        dbStorage.getInventoryItems(),
        dbStorage.getBankAccounts(),
        dbStorage.getLocations(),
      ]);
      setAccountGroups(groups);
      setLedgers(allLedgers);
      setInventoryItems(items);
      setBankAccounts(banks);
      setLocations(locs);

      // Asynchronously synchronize all master modifications to transactions & vouchers
      masterSyncService.syncAllMasterData().catch((e) => console.warn('Master background sync notice:', e));
    } catch (err: any) {
      console.error('Failed to load active workspace data:', err);
    }
  }, []);

  const saveLocation = useCallback(async (loc: Location) => {
    try {
      await dbStorage.saveLocation(loc);
      await masterSyncService.syncLocationMaster(loc);
      const updated = await dbStorage.getLocations();
      setLocations(updated);
      showNotification(`Location "${loc.name}" saved successfully.`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save location', 'error');
      throw err;
    }
  }, [showNotification]);

  const deleteLocation = useCallback(async (id: string) => {
    try {
      await dbStorage.deleteLocation(id);
      const updated = await dbStorage.getLocations();
      setLocations(updated);
      showNotification('Location deleted successfully.', 'info');
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete location', 'error');
      throw err;
    }
  }, [showNotification]);

  // City Master Handlers
  const saveCity = useCallback(async (city: CityMasterItem) => {
    try {
      const saved = cityStateService.saveCity(city, currentCompany?.id);
      setCities(cityStateService.getCities(currentCompany?.id));
      showNotification(`City "${saved.cityName}" saved successfully.`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save city', 'error');
      throw err;
    }
  }, [currentCompany?.id, showNotification]);

  const deleteCity = useCallback(async (id: string) => {
    try {
      cityStateService.deleteCity(id, currentCompany?.id);
      setCities(cityStateService.getCities(currentCompany?.id));
      showNotification('City deleted successfully.', 'info');
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete city', 'error');
      throw err;
    }
  }, [currentCompany?.id, showNotification]);

  const setDefaultCity = useCallback(async (id: string) => {
    try {
      cityStateService.setDefaultCity(id, currentCompany?.id);
      setCities(cityStateService.getCities(currentCompany?.id));
      showNotification('Primary default city updated.', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to set default city', 'error');
      throw err;
    }
  }, [currentCompany?.id, showNotification]);

  // Initialize System
  useEffect(() => {
    const init = async () => {
      try {
        const { currentCompany: comp, currentFiscalYear: fy } = await dbStorage.initializeSystem();
        const allComps = await dbStorage.getCompanies();
        const allFys = comp ? await dbStorage.getFiscalYears(comp.id) : [];

        setCompanies(allComps);
        setFiscalYears(allFys);
        setCurrentCompany(comp);
        setCurrentFiscalYear(fy);

        if (comp && fy) {
          dbStorage.setActiveContext(comp.id, fy.id);
          await refreshActiveData();
        } else if (comp) {
          dbStorage.setActiveContext(comp.id, '');
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsSystemInitialized(true);
      }
    };
    init();
  }, [refreshActiveData]);

  // Subscribe to sync queue updates
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((summary) => {
      setSyncSummary(summary);
      setIsOnline(summary.isOnline);
    });
    return unsubscribe;
  }, []);

  // Supabase Realtime Sync: subscribe to remote DB changes for the active
  // company and refresh the active dataset when a change is reconciled.
  useEffect(() => {
    const companyId = currentCompany?.id;
    if (!companyId) return;

    if (isOnline) {
      startRealtime(companyId);
    } else {
      stopRealtime();
    }

    const handleRemoteChange = () => {
      refreshActiveData();
    };
    window.addEventListener(REMOTE_CHANGE_EVENT, handleRemoteChange);

    return () => {
      window.removeEventListener(REMOTE_CHANGE_EVENT, handleRemoteChange);
      stopRealtime();
    };
  }, [currentCompany?.id, isOnline, refreshActiveData]);

  // Keyboard shortcut listener (Ctrl+N for Voucher, Ctrl+F for Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setVoucherModalType('PAYMENT');
        setEditingVoucher(null);
        setVoucherModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const switchCompany = async (companyId: string) => {
    let allCompanies = companies;
    let comp = allCompanies.find((c) => c.id === companyId);
    if (!comp) {
      allCompanies = await dbStorage.getCompanies();
      setCompanies(allCompanies);
      comp = allCompanies.find((c) => c.id === companyId);
    }
    if (!comp) return;

    const fys = await dbStorage.getFiscalYears(comp.id);
    const activeFy = fys.length > 0 ? fys[0] : null;

    if (!activeFy) {
      showNotification('Selected company has no active fiscal year.', 'error');
      return;
    }

    setCurrentCompany(comp);
    setFiscalYears(fys);
    setCurrentFiscalYear(activeFy);
    dbStorage.setActiveContext(comp.id, activeFy.id);
    await refreshActiveData();

    showNotification(`Switched to ${comp.name} (${activeFy.name})`, 'success');
  };

  const refreshFiscalYears = useCallback(async (companyId?: string): Promise<FiscalYear[]> => {
    const targetCompId = companyId || currentCompany?.id;
    if (!targetCompId) return [];
    try {
      const allFys = await dbStorage.getFiscalYears(targetCompId);
      setFiscalYears(allFys);
      return allFys;
    } catch (err) {
      console.error('Failed to refresh fiscal years:', err);
      return [];
    }
  }, [currentCompany?.id]);

  const switchFiscalYear = async (fiscalYearId: string) => {
    if (!currentCompany) return;
    const allFys = await dbStorage.getFiscalYears(currentCompany.id);
    setFiscalYears(allFys);
    const fy = allFys.find((f) => f.id === fiscalYearId) || fiscalYears.find((f) => f.id === fiscalYearId);
    if (!fy) return;

    setCurrentFiscalYear(fy);
    dbStorage.setActiveContext(currentCompany.id, fy.id);
    await refreshActiveData();

    showNotification(`Switched fiscal year to ${fy.name}`, 'info');
  };

  const createCompany = async (comp: Company) => {
    await dbStorage.saveCompany(comp);
    const all = await dbStorage.getCompanies();
    setCompanies(all);
    await switchCompany(comp.id);
    showNotification(`Created company "${comp.name}" successfully`, 'success');
  };

  const updateCompany = async (comp: Company) => {
    await dbStorage.saveCompany(comp);
    const all = await dbStorage.getCompanies();
    setCompanies(all);
    if (currentCompany?.id === comp.id) {
      setCurrentCompany(comp);
    }
    showNotification(`Company "${comp.name}" updated successfully`, 'success');
  };

  const deleteCompany = async (companyId: string) => {
    const currentList = await dbStorage.getCompanies();
    if (currentList.length <= 1) {
      showNotification('Cannot delete the only remaining company dataset.', 'error');
      return;
    }
    const target = currentList.find((c) => c.id === companyId);
    await dbStorage.deleteCompany(companyId);
    const remaining = await dbStorage.getCompanies();
    setCompanies(remaining);
    
    if (currentCompany?.id === companyId && remaining.length > 0) {
      await switchCompany(remaining[0].id);
    }
    showNotification(`Company "${target?.name || companyId}" deleted successfully`, 'success');
  };

  const createFiscalYear = async (fy: FiscalYear, autoSwitch: boolean = true) => {
    await dbStorage.createFiscalYear(fy);
    if (currentCompany) {
      const allFys = await dbStorage.getFiscalYears(currentCompany.id);
      setFiscalYears(allFys);
      if (autoSwitch) {
        await switchFiscalYear(fy.id);
      }
      showNotification(`Created fiscal year "${fy.name}"`, 'success');
    }
  };

  const updateFiscalYear = async (fy: FiscalYear): Promise<FiscalYear[]> => {
    if (!currentCompany) return [];
    await dbStorage.updateFiscalYear(fy);
    if (currentFiscalYear?.id === fy.id) {
      setCurrentFiscalYear(fy);
    }
    const updated = await refreshFiscalYears(currentCompany.id);
    setFiscalYears(updated);
    showNotification(`Financial Year "${fy.name}" updated successfully.`, 'success');
    return updated;
  };

  const deleteFiscalYear = async (
    fiscalYearId: string,
    companyId?: string,
    fyName?: string,
    startDate?: string,
    endDate?: string
  ): Promise<FiscalYear[]> => {
    const targetCompId = companyId || currentCompany?.id;
    if (!targetCompId) return [];

    const allFys = await dbStorage.getFiscalYears(targetCompId);
    const sourceList = allFys.length > 0 ? allFys : fiscalYears;
    const targetFY = sourceList.find((f) => f.id === fiscalYearId || f.uuid === fiscalYearId);
    const targetName = fyName || targetFY?.name || 'Financial Year';
    const targetStartDate = startDate || targetFY?.startDate;
    const targetEndDate = endDate || targetFY?.endDate;

    const remaining = sourceList.filter(
      (f) =>
        f.id !== fiscalYearId &&
        f.uuid !== fiscalYearId &&
        (!targetName || f.name.trim().toUpperCase() !== targetName.trim().toUpperCase())
    );

    // 1. Permanently delete from IndexedDB first
    try {
      await dbStorage.deleteFiscalYear(
        fiscalYearId,
        targetCompId,
        targetName,
        targetStartDate,
        targetEndDate
      );
    } catch (dbErr) {
      console.error('Error deleting fiscal year from IndexedDB:', dbErr);
    }

    // 2. Set memory state immediately following DB deletion
    setFiscalYears(remaining);

    // 3. Adjust active context
    const isTargetActive =
      currentFiscalYear?.id === fiscalYearId ||
      currentFiscalYear?.uuid === fiscalYearId ||
      (targetName && currentFiscalYear?.name?.trim().toUpperCase() === targetName.trim().toUpperCase());

    if (remaining.length > 0) {
      if (isTargetActive) {
        const nextActive = remaining[0];
        setCurrentFiscalYear(nextActive);
        dbStorage.setActiveContext(targetCompId, nextActive.id);
      }
    } else {
      setCurrentFiscalYear(null);
      dbStorage.setActiveContext(targetCompId, '');
    }

    // 4. Log audit safely
    try {
      const activeCtx = dbStorage.getActiveContext();
      if (activeCtx.fiscalYearId) {
        await dbStorage.logAudit('CANCEL', 'FISCAL_YEAR', fiscalYearId, `Deleted financial year: ${targetName}`);
      }
    } catch (e) {
      console.warn('Audit log notice:', e);
    }

    // 5. Update active data
    await refreshActiveData();

    showNotification(`Financial Year "${targetName}" deleted successfully.`, 'info');
    return remaining;
  };

  const openVoucherModal = (type: VoucherType = 'PAYMENT', voucherToEdit?: Voucher, prefillLedgerId?: string) => {
    setVoucherModalType(type);
    setEditingVoucher(voucherToEdit || null);
    setVoucherModalPrefillLedgerId(prefillLedgerId || null);
    setVoucherModalOpen(true);
  };

  const closeVoucherModal = () => {
    setVoucherModalOpen(false);
    setEditingVoucher(null);
    setVoucherModalPrefillLedgerId(null);
  };

  const setOnlineMode = (online: boolean) => {
    syncEngine.setOnlineStatus(online);
    setIsOnline(online);
    showNotification(online ? 'System switched to ONLINE mode.' : 'System switched to OFFLINE mode.', online ? 'success' : 'info');
  };

  const triggerSync = async () => {
    const res = await syncEngine.triggerAutoSync();
    showNotification(res.message, res.success ? 'success' : 'error');
  };

  return (
    <AppContext.Provider
      value={{
        currentCompany,
        currentFiscalYear,
        companies,
        fiscalYears,
        activeTab,
        setActiveTab,
        openTabs,
        openOrSwitchTab,
        closeTab,
        closeOtherTabs,
        closeAllTabs,
        selectedLedgerId,
        setSelectedLedgerId,
        selectedLedgerName,
        setSelectedLedgerName,
        openLedger,
        isSystemInitialized,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        accountGroups,
        ledgers,
        inventoryItems,
        bankAccounts,
        locations,
        saveLocation,
        deleteLocation,
        cities,
        states,
        saveCity,
        deleteCity,
        setDefaultCity,
        isOnline,
        syncSummary,
        pendingSyncCount: syncSummary?.pendingCount || 0,
        setOnlineMode,
        triggerSync,
        voucherModalOpen,
        isVoucherModalOpen: voucherModalOpen,
        voucherModalType,
        editingVoucher,
        voucherModalPrefillLedgerId,
        vouchersVersion,
        notifyVouchersUpdated,
        openVoucherModal,
        closeVoucherModal,
        minimizedInvoice,
        setMinimizedInvoice,
        restoreMinimizedInvoice,
        closeMinimizedInvoice,
        registerRestoreInvoiceHandler,
        registerCloseInvoiceHandler,
        globalSearchOpen,
        setGlobalSearchOpen,
        shortcuts,
        addShortcut,
        updateShortcut,
        deleteShortcut,
        resetShortcutsToDefault,
        isShortcutsModalOpen,
        setShortcutsModalOpen,
        switchCompany,
        switchFiscalYear,
        createCompany,
        updateCompany,
        deleteCompany,
        createFiscalYear,
        updateFiscalYear,
        deleteFiscalYear,
        refreshFiscalYears,
        refreshActiveData,
        notification: notifications.length > 0 ? notifications[notifications.length - 1] : null,
        notifications,
        showNotification,
        removeNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
