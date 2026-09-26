import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceTab } from '../../types';
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  FileText,
  Scale,
  TrendingUp,
  BarChart3,
  Clock,
  FolderTree,
  Package,
  Wrench,
  Warehouse,
  MapPin,
  Globe,
  Landmark,
  CheckCheck,
  Boxes,
  ArrowRightLeft,
  Layers,
  AlertTriangle,
  Cloud,
  Building2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Coins,
  Sparkles,
  ExternalLink,
  Search,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import { VoucherType } from '../../types';

interface WorkspaceTaskbarProps {
  className?: string;
}

export const WorkspaceTaskbar: React.FC<WorkspaceTaskbarProps> = ({ className = '' }) => {
  const {
    activeTab,
    selectedLedgerId,
    selectedLedgerName,
    openTabs,
    openOrSwitchTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    voucherModalOpen,
    voucherModalType,
    editingVoucher,
    closeVoucherModal,
    openVoucherModal,
    minimizedInvoice,
    restoreMinimizedInvoice,
    closeMinimizedInvoice,
  } = useApp();

  const [isNewTabMenuOpen, setIsNewTabMenuOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsNewTabMenuOpen(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(target)) {
        setIsOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Quick form items list for the "+" new tab button
  const formOptions = [
    // Vouchers
    { key: 'voucher:PAYMENT', label: 'Payment Voucher (F5)', category: 'Voucher Entry', icon: Receipt, voucherType: 'PAYMENT' as VoucherType },
    { key: 'voucher:RECEIPT', label: 'Receipt Voucher (F6)', category: 'Voucher Entry', icon: Receipt, voucherType: 'RECEIPT' as VoucherType },
    { key: 'voucher:DEBIT_NOTE', label: 'Debit Note (F10)', category: 'Voucher Entry', icon: Receipt, voucherType: 'PURCHASE_RETURN' as VoucherType },
    { key: 'voucher:CREDIT_NOTE', label: 'Credit Note (F11)', category: 'Voucher Entry', icon: Receipt, voucherType: 'SALES_RETURN' as VoucherType },
    { key: 'voucher:JOURNAL', label: 'Journal Entry (F7)', category: 'Voucher Entry', icon: Receipt, voucherType: 'JOURNAL' as VoucherType },
    { key: 'voucher:CONTRA', label: 'Contra Voucher (F4)', category: 'Voucher Entry', icon: Receipt, voucherType: 'CONTRA' as VoucherType },
    { key: 'voucher:SALES', label: 'Sales Invoice (F8)', category: 'Voucher Entry', icon: ShoppingBag, voucherType: 'SALES' as VoucherType },
    { key: 'voucher:PURCHASE', label: 'Purchase Voucher (F9)', category: 'Voucher Entry', icon: ShoppingCart, voucherType: 'PURCHASE' as VoucherType },
    
    // Transactions
    { key: 'sales_register', label: 'Sales Register', category: 'Transactions', icon: ShoppingBag },
    { key: 'purchase_register', label: 'Purchase Register', category: 'Transactions', icon: ShoppingCart },
    { key: 'spare_parts_purchase', label: 'Spare Parts Purchase', category: 'Accounting & Spares', icon: Wrench },
    
    // Financial Reports
    { key: 'trial_balance', label: 'Trial Balance', category: 'Reports & Accounts', icon: Scale },
    { key: 'day_book', label: 'Day Book', category: 'Reports & Accounts', icon: BookOpen },
    { key: 'cash_book', label: 'Cash Book', category: 'Reports & Accounts', icon: Coins },
    { key: 'vouchers', label: 'Voucher Register', category: 'Reports & Accounts', icon: Receipt },
    { key: 'profit_loss', label: 'Profit & Loss Statement', category: 'Reports & Accounts', icon: TrendingUp },
    { key: 'balance_sheet', label: 'Balance Sheet', category: 'Reports & Accounts', icon: BarChart3 },
    { key: 'outstanding', label: 'Outstandings (Aging)', category: 'Reports & Accounts', icon: Clock },
    { key: 'ledgers', label: 'Ledger Statement', category: 'Reports & Accounts', icon: FileText },
    
    // Inventory
    { key: 'inventory_summary', label: 'Stock Summary', category: 'Inventory', icon: Boxes },
    { key: 'stock_journal', label: 'Stock Journal Transfer', category: 'Inventory', icon: ArrowRightLeft },
    { key: 'stock_ledger', label: 'Stock Item Ledger', category: 'Inventory', icon: Layers },
    { key: 'wastage_analysis', label: 'Wastage & Scrap Analysis', category: 'Inventory', icon: AlertTriangle },
    
    // Masters
    { key: 'chart_of_accounts', label: 'Chart of Accounts', category: 'Masters', icon: FolderTree },
    { key: 'item_master', label: 'Item & Products Master', category: 'Masters', icon: Package },
    { key: 'spare_parts_master', label: 'Spare Parts Master', category: 'Masters', icon: Wrench },
    { key: 'location_master', label: 'Godown / Locations', category: 'Masters', icon: Warehouse },
    { key: 'bank_accounts', label: 'Bank Accounts', category: 'Banking', icon: Landmark },
    { key: 'bank_reconciliation', label: 'Bank Reconciliation (BRS)', category: 'Banking', icon: CheckCheck },
    { key: 'city_master', label: 'Cities Master', category: 'Masters', icon: MapPin },
    { key: 'sync', label: 'Cloud Sync Center', category: 'System', icon: Cloud },
    { key: 'comp_data', label: 'Comp. Data (Companies & FY)', category: 'System', icon: Building2 },
  ];

  const filteredOptions = formOptions.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      opt.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleOpenFormOption = (opt: typeof formOptions[0]) => {
    setIsNewTabMenuOpen(false);
    setSearchFilter('');
    if (opt.key.startsWith('voucher:') && opt.voucherType) {
      openVoucherModal(opt.voucherType);
    } else {
      openOrSwitchTab(opt.key);
    }
  };

  const getIconForTab = (iconName?: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return LayoutDashboard;
      case 'BookOpen': return BookOpen;
      case 'Coins': return Coins;
      case 'Receipt': return Receipt;
      case 'FileText': return FileText;
      case 'Scale': return Scale;
      case 'TrendingUp': return TrendingUp;
      case 'BarChart3': return BarChart3;
      case 'Clock': return Clock;
      case 'FolderTree': return FolderTree;
      case 'Package': return Package;
      case 'Wrench': return Wrench;
      case 'Warehouse': return Warehouse;
      case 'MapPin': return MapPin;
      case 'Globe': return Globe;
      case 'Landmark': return Landmark;
      case 'CheckCheck': return CheckCheck;
      case 'Boxes': return Boxes;
      case 'ArrowRightLeft': return ArrowRightLeft;
      case 'Layers': return Layers;
      case 'AlertTriangle': return AlertTriangle;
      case 'Cloud': return Cloud;
      case 'ShoppingBag': return ShoppingBag;
      case 'ShoppingCart': return ShoppingCart;
      default: return FileText;
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 220;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Determine which tab is actively selected
  const isTabActive = (tab: WorkspaceTab) => {
    if (voucherModalOpen) return false;
    if (tab.tabKey === 'ledgers') {
      if (tab.ledgerId) {
        return activeTab === 'ledgers' && tab.ledgerId === selectedLedgerId;
      }
      return activeTab === 'ledgers' && !selectedLedgerId;
    }
    return activeTab === tab.tabKey;
  };

  return (
    <div
      id="workspace-invisible-taskbar"
      className={`relative z-20 flex items-center justify-between border-b border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.60)] backdrop-blur-xl backdrop-blur-md px-2 sm:px-4 py-1 select-none shrink-0 ${className}`}
      style={{ minHeight: '38px' }}
    >
      {/* Scroll Left Button */}
      <div className="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="hidden sm:flex items-center justify-center p-1 text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded transition cursor-pointer"
          title="Scroll tabs left"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Scrollable Tabs Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 pr-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {openTabs.map((tab) => {
            const IconComponent = getIconForTab(tab.iconName);
            const active = isTabActive(tab);

            return (
              <div
                key={tab.id}
                id={`taskbar-tab-${tab.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`}
                onClick={() => openOrSwitchTab(tab.tabKey, tab.ledgerId, tab.ledgerName)}
                onAuxClick={(e) => {
                  // Middle click closes tab
                  if (e.button === 1 && tab.closable) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                className={`group relative flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-lg transition-all duration-150 cursor-pointer border-t-2 border-x whitespace-nowrap w-[160px] sm:w-[185px] shrink-0 select-none ${
                  active
                    ? 'bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8] border-[#2588E8] border-x-[#163A5E] shadow-sm font-semibold'
                    : 'text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(18,48,76,0.42)] backdrop-blur-xl border-transparent border-x-transparent'
                }`}
                title={`${tab.title}${tab.closable ? ' (Middle-click to close)' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <IconComponent
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      active ? 'text-[#2588E8]' : 'text-[#7F98AE] group-hover:text-[#B7C9D9]'
                    }`}
                  />
                  <span className="truncate text-xs tracking-tight">{tab.title}</span>
                </div>

                {/* Tab Close Button */}
                {tab.closable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`shrink-0 ml-1 p-0.5 rounded-full transition-colors ${
                      active
                        ? 'text-[#7F98AE] hover:text-[#FF647C] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl'
                        : 'opacity-0 group-hover:opacity-100 text-[#7F98AE] hover:text-[#FF647C] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl'
                    }`}
                    title="Close tab (Ctrl+W)"
                    aria-label={`Close ${tab.title} tab`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Active Voucher Modal Indicator Tab (If modal is open) */}
          {voucherModalOpen && (
            <div
              id="taskbar-active-voucher-tab"
              onClick={() => {
                // Focus / already open
              }}
              className="group relative flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-lg transition-all bg-[#143d2c] text-[#55D68A] border-t-2 border-[#55D68A] border-x border-[#55D68A]/30 shadow-sm whitespace-nowrap w-[160px] sm:w-[185px] shrink-0 cursor-pointer select-none"
              title="Active Voucher Entry Form"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#55D68A] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#55D68A]"></span>
                </span>
                <Receipt className="w-3.5 h-3.5 text-[#55D68A] shrink-0" />
                <span className="truncate text-xs font-semibold">
                  {editingVoucher ? `Edit: ${editingVoucher.voucherNumber}` : `New ${voucherModalType}`}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeVoucherModal();
                }}
                className="shrink-0 ml-1 p-0.5 rounded-full text-[#55D68A] hover:text-[#FF647C] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl transition-colors cursor-pointer"
                title="Close voucher form"
                aria-label="Close voucher form"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Minimized Bill / Invoice Tab in Workspace Tabbar */}
          {minimizedInvoice && (
            <div
              id="taskbar-minimized-invoice-tab"
              onClick={() => restoreMinimizedInvoice()}
              className="group relative flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-lg transition-all duration-150 bg-transparent hover:bg-[rgba(245,158,11,0.15)] text-amber-400/70 hover:text-amber-300 border-t-2 border-amber-500/40 hover:border-amber-400 border-x border-transparent whitespace-nowrap w-[160px] sm:w-[185px] shrink-0 cursor-pointer select-none"
              title={`${minimizedInvoice.title}: ${minimizedInvoice.billNo || 'Draft'} (${minimizedInvoice.party || 'No Party'}) - Click to Restore`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400/60"></span>
                </span>
                <FileText className="w-3.5 h-3.5 text-amber-400/60 group-hover:text-amber-400 shrink-0 transition-colors" />
                <span className="truncate text-xs font-medium text-amber-300/70 group-hover:text-amber-200 transition-colors">
                  {minimizedInvoice.billNo ? minimizedInvoice.billNo : minimizedInvoice.title}
                </span>
                <span className="text-[8.5px] px-1 rounded bg-amber-500/15 text-amber-400/60 uppercase font-mono shrink-0">
                  min
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeMinimizedInvoice();
                }}
                className="shrink-0 ml-1 p-0.5 rounded-full text-amber-400/50 opacity-0 group-hover:opacity-100 hover:text-[#FF647C] hover:bg-black/30 transition-all cursor-pointer"
                title="Close bill"
                aria-label="Close bill"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* New Tab "+" Button */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              id="taskbar-new-tab-btn"
              type="button"
              onClick={() => setIsNewTabMenuOpen((prev) => !prev)}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] hover:text-[#2588E8] transition cursor-pointer"
              title="Open new form or report in tab (+)"
              aria-label="New tab"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Quick Form Selector Dropdown */}
            {isNewTabMenuOpen && (
              <div
                id="taskbar-new-tab-dropdown"
                className="absolute left-0 top-full mt-2 w-72 max-h-96 overflow-y-auto rounded-xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] shadow-2xl z-50 p-2.5 text-[#FFFFFF] animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl"
              >
                {/* Search Header */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#7F98AE]" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search form or report..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 pl-8 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-none focus:border-[#2588E8]"
                  />
                </div>

                <div className="text-[10px] uppercase font-semibold text-[#7F98AE] px-2 py-1 tracking-wider">
                  Open Form in Workspace
                </div>

                <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                  {filteredOptions.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-[#7F98AE]">
                      No matching form found
                    </div>
                  ) : (
                    filteredOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleOpenFormOption(opt)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-[rgba(37, 136, 232, 0.12)] text-[#B7C9D9] hover:text-[#FFFFFF] transition group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className="w-3.5 h-3.5 text-[#7F98AE] group-hover:text-[#2588E8] shrink-0" />
                            <span className="truncate">{opt.label}</span>
                          </div>
                          <span className="text-[10px] text-[#7F98AE] group-hover:text-[#B7C9D9] shrink-0">
                            {opt.category}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="hidden sm:flex items-center justify-center p-1 text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded transition cursor-pointer"
          title="Scroll tabs right"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Taskbar Right-Side Tab Operations */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <span className="hidden md:inline-block text-[11px] text-[#7F98AE] font-mono">
          {openTabs.length} {openTabs.length === 1 ? 'tab' : 'tabs'}
        </span>

        {openTabs.length > 1 && (
          <div className="relative" ref={optionsRef}>
            <button
              id="taskbar-options-menu-btn"
              type="button"
              onClick={() => setIsOptionsOpen((prev) => !prev)}
              className="p-1 rounded text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl transition cursor-pointer"
              title="Tab options"
              aria-label="Tab options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {isOptionsOpen && (
              <div
                id="taskbar-options-dropdown"
                className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] shadow-2xl z-50 p-2 text-xs text-[#FFFFFF] backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    const current = openTabs.find(isTabActive) || openTabs[0];
                    closeOtherTabs(current.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[rgba(37, 136, 232, 0.12)] text-[#B7C9D9] hover:text-[#FFFFFF] flex items-center justify-between transition cursor-pointer"
                >
                  <span>Close Other Tabs</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    closeAllTabs();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[#FF647C]/15 text-[#FF647C] flex items-center justify-between transition cursor-pointer"
                >
                  <span>Close All Tabs</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
