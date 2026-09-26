import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  Layers,
  Database,
  Wrench,
  Receipt,
  FileText,
  BookOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronDown,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  ArrowRightLeft,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Wallet,
  Landmark,
  Boxes,
  PieChart,
  BarChart3,
  Scale,
  Keyboard,
  Clock,
  X,
  Warehouse,
  MapPin,
  Globe,
  Truck,
  FolderCog,
  FolderOpen,
  Download,
  Upload,
  LogOut,
} from 'lucide-react';
import { VoucherType } from '../../types';
import { BackupLocationModal } from '../backup/BackupLocationModal';
import { ExitConfirmModal } from './ExitConfirmModal';
import { backupService } from '../../services/backupService';
import {
  isAlwaysSaveEnabled,
  getSavedDirectoryHandle,
  getSavedFolderName,
} from '../../services/backupStorageLocationService';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    syncSummary,
    setShortcutsModalOpen,
    isOnline,
    openVoucherModal,
    isSidebarOpen,
    toggleSidebar,
    refreshActiveData,
    showNotification,
  } = useApp();

  type SectionKey = 'master' | 'accounting' | 'transaction' | 'banking' | 'inventory' | 'reports' | 'data_config';

  // State for sub-dropdowns in Transaction flyout (closed by default)
  const [isSaleOpen, setIsSaleOpen] = useState<boolean>(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState<boolean>(false);

  // Hover state (allows expanding when cursor goes over sidebar)
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const isExpanded = isSidebarOpen || isHovered;

  // Active right-side navigation flyout
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [flyoutY, setFlyoutY] = useState<number>(80); // fixed Y position in viewport
  const [flyoutX, setFlyoutX] = useState<number>(168); // fixed X position in viewport

  // Close flyout when sidebar is collapsed/closed, and reset transaction sub-dropdowns
  useEffect(() => {
    if (!isExpanded) {
      setOpenSection(null);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (openSection !== 'transaction') {
      setIsSaleOpen(false);
      setIsPurchaseOpen(false);
    }
  }, [openSection]);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  // Data Config state & handlers
  const [backupModalOpen, setBackupModalOpen] = useState<boolean>(false);
  const [savedFolderNameState, setSavedFolderNameState] = useState<string | null>(getSavedFolderName());
  const [exitModalOpen, setExitModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setSavedFolderNameState(getSavedFolderName());
  }, [backupModalOpen]);

  const handleBackupClick = () => {
    // Open backup modal when backup button is clicked
    setBackupModalOpen(true);
  };

  const handleRestoreInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const text = await file.text();
        const res = await backupService.restoreBackup(text);
        if (res.success) {
          showNotification(res.message, 'success');
          await refreshActiveData();
        } else {
          showNotification(res.message, 'error');
        }
      } catch (err: any) {
        showNotification(err.message || 'Failed to restore backup.', 'error');
      }
      e.target.value = '';
    }
  };

  // Click outside sidebar or flyout closes the right-side menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(target) &&
        flyoutRef.current &&
        !flyoutRef.current.contains(target)
      ) {
        setOpenSection(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenSection(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleButtonHover = (section: SectionKey, e: React.MouseEvent<HTMLButtonElement>) => {
    const btnRect = e.currentTarget.getBoundingClientRect();
    const y = Math.round(btnRect.top);
    const x = Math.round(btnRect.right + 6);
    setFlyoutY(y);
    setFlyoutX(x);
    setOpenSection(section);
  };

  const toggleSection = (section: SectionKey, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openSection === section) {
      setOpenSection(null);
      return;
    }
    const btnRect = e.currentTarget.getBoundingClientRect();
    // Align menu box top EXACTLY with the clicked button's top edge
    const y = Math.round(btnRect.top);
    const x = Math.round(btnRect.right + 6);
    setFlyoutY(y);
    setFlyoutX(x);
    setOpenSection(section);
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setOpenSection(null);
  };

  const handleVoucherClick = (type: VoucherType) => {
    openVoucherModal(type);
    setOpenSection(null);
  };

  // Group active highlights
  const isMasterActive = [
    'chart_of_accounts',
    'item_master',
    'item',
    'items',
    'spare_parts',
    'spare_parts_master',
    'location_master',
    'locations',
    'city_state_master',
    'city_master',
    'cities',
    'state_master',
    'states',
    'state_gst_master',
    'state_gst',
    'gst_codes',
  ].includes(activeTab);

  const isAccountingActive = [
    'vouchers',
    'day_book',
    'spare_parts_purchase',
  ].includes(activeTab);

  const isTransactionActive = [
    'sales',
    'sales_quotation',
    'sales_invoice',
    'sales_challan',
    'sales_sundry',
    'sales_register',
    'purchase_register',
  ].includes(activeTab);

  const isBankingActive = [
    'cash_book',
    'bank_accounts',
    'bank_reconciliation',
  ].includes(activeTab);

  const isInventoryActive = [
    'inventory_summary',
    'stock_summary',
    'stock_journal',
    'stock_journals',
    'stock_ledger',
    'wastage_analysis',
    'wastage',
  ].includes(activeTab);

  const isReportsActive = [
    'ledgers',
    'trial_balance',
    'profit_loss',
    'balance_sheet',
    'outstanding',
  ].includes(activeTab);

  return (
    <aside
      ref={sidebarRef}
      id="main_app_sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (flyoutRef.current && related && flyoutRef.current.contains(related)) {
          return;
        }
        setIsHovered(false);
        setOpenSection(null);
      }}
      className={`sticky top-14 h-[calc(100vh-3.5rem)] z-40 bg-[rgba(7,25,43,0.72)] backdrop-blur-[22px] border-r border-[rgba(112,185,245,0.22)] flex flex-col justify-between shrink-0 select-none shadow-2xl transition-[width] duration-200 ease-in-out ${
        isExpanded ? 'w-[160px]' : 'w-14'
      }`}
    >
      {/* Fixed Navigation List — buttons stay in place, no scrolling, no shifting */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-2 space-y-1">
        {/* Dashboard */}
        <button
          onClick={() => handleNavClick('dashboard')}
          onMouseEnter={() => setOpenSection(null)}
          id="nav_dashboard_btn"
          title="Dashboard"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            activeTab === 'dashboard'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)]'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <TrendingUp
            className={`w-4 h-4 shrink-0 ${
              activeTab === 'dashboard' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'
            }`}
          />
          {isExpanded && <span className="whitespace-nowrap truncate">Dashboard</span>}
        </button>

        {/* Master Section */}
        <button
          onClick={(e) => toggleSection('master', e)}
          onMouseEnter={(e) => handleButtonHover('master', e)}
          id="nav_master_group_btn"
          title="Master Records"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'master'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isMasterActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <Database
            className={`w-4 h-4 shrink-0 ${
              openSection === 'master' || isMasterActive ? 'text-[#2588E8]' : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Master</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'master' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Accounting Section */}
        <button
          onClick={(e) => toggleSection('accounting', e)}
          onMouseEnter={(e) => handleButtonHover('accounting', e)}
          id="nav_accounting_group_btn"
          title="Accounting & Vouchers"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'accounting'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isAccountingActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <Receipt
            className={`w-4 h-4 shrink-0 ${
              openSection === 'accounting' || isAccountingActive
                ? 'text-[#2588E8]'
                : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Accounting</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'accounting' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Transaction Section */}
        <button
          onClick={(e) => toggleSection('transaction', e)}
          onMouseEnter={(e) => handleButtonHover('transaction', e)}
          id="nav_transaction_group_btn"
          title="Sale & Purchase Transactions"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'transaction'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isTransactionActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <ArrowRightLeft
            className={`w-4 h-4 shrink-0 ${
              openSection === 'transaction' || isTransactionActive
                ? 'text-[#2588E8]'
                : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Transaction</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'transaction' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Cash & Bank Section */}
        <button
          onClick={(e) => toggleSection('banking', e)}
          onMouseEnter={(e) => handleButtonHover('banking', e)}
          id="nav_banking_group_btn"
          title="Cash & Bank Accounts"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'banking'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isBankingActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <Building2
            className={`w-4 h-4 shrink-0 ${
              openSection === 'banking' || isBankingActive ? 'text-[#2588E8]' : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Cash & Bank</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'banking' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Inventory Section */}
        <button
          onClick={(e) => toggleSection('inventory', e)}
          onMouseEnter={(e) => handleButtonHover('inventory', e)}
          id="nav_inventory_group_btn"
          title="Inventory & Stock"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'inventory'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isInventoryActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <Boxes
            className={`w-4 h-4 shrink-0 ${
              openSection === 'inventory' || isInventoryActive
                ? 'text-[#2588E8]'
                : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Inventory</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'inventory' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Reports Section */}
        <button
          onClick={(e) => toggleSection('reports', e)}
          onMouseEnter={(e) => handleButtonHover('reports', e)}
          id="nav_reports_group_btn"
          title="Reports & Analytics"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'reports'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : isReportsActive
              ? 'bg-[rgba(37,136,232,0.12)] text-[#2588E8] border-transparent'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <BarChart3
            className={`w-4 h-4 shrink-0 ${
              openSection === 'reports' || isReportsActive ? 'text-[#2588E8]' : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Reports</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'reports' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Data Config (Opens Flyout to the Right) */}
        <button
          onClick={(e) => toggleSection('data_config', e)}
          onMouseEnter={(e) => handleButtonHover('data_config', e)}
          id="nav_data_config_btn"
          title="Data Configuration & Backups"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            openSection === 'data_config'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <FolderCog
            className={`w-4 h-4 shrink-0 ${
              openSection === 'data_config' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
            }`}
          />
          {isExpanded && (
            <>
              <span className="whitespace-nowrap truncate">Data Config</span>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 ml-auto transition-colors duration-150 ${
                  openSection === 'data_config' ? 'text-[#2588E8]' : 'text-[#7F98AE]'
                }`}
              />
            </>
          )}
        </button>

        {/* Comp. Data (Company Datasets & Fiscal Years) */}
        <button
          onClick={() => handleNavClick('comp_data')}
          onMouseEnter={() => setOpenSection(null)}
          id="nav_comp_data_btn"
          title="Company Data & Financial Years"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            activeTab === 'comp_data' || activeTab === 'company_data'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)]'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <Building2
            className={`w-4 h-4 shrink-0 ${
              activeTab === 'comp_data' || activeTab === 'company_data' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'
            }`}
          />
          {isExpanded && <span className="whitespace-nowrap truncate">Comp. Data</span>}
        </button>

        {/* Cloud Sync */}
        <button
          onClick={() => handleNavClick('sync')}
          onMouseEnter={() => setOpenSection(null)}
          id="nav_cloud_sync_btn"
          title="Cloud Sync Center"
          className={`w-full h-[38px] shrink-0 flex items-center gap-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer border box-border select-none ${
            activeTab === 'sync'
              ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)]'
              : 'text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(45,120,180,0.16)] border-transparent'
          }`}
        >
          <RefreshCw
            className={`w-4 h-4 shrink-0 ${
              activeTab === 'sync' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'
            }`}
          />
          {isExpanded && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="whitespace-nowrap truncate">Cloud Sync</span>
              {syncSummary && syncSummary.pendingCount > 0 && (
                <span className="bg-[#2588E8] text-[#FFFFFF] text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full shadow-sm shrink-0">
                  {syncSummary.pendingCount}
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {/* 3. Bottom Footer Status & Exit */}
      <div onMouseEnter={() => setOpenSection(null)} className="p-2 border-t border-[rgba(112,185,245,0.25)] shrink-0 space-y-1.5">
        {isExpanded ? (
          <>
            {/* Online / Offline Status */}
            <div className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] flex items-center justify-between text-[9px]">
              <span className="text-[#7F98AE] font-mono flex items-center gap-1 truncate">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-[#55D68A] shrink-0" />
                    <span className="text-[#55D68A] font-semibold truncate">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-[#FF647C] shrink-0" />
                    <span className="text-[#FF647C] font-semibold truncate">Offline</span>
                  </>
                )}
              </span>
              <span className="text-[8px] px-1 py-0.2 rounded bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-mono border border-[rgba(112,185,245,0.25)] shrink-0">
                DB
              </span>
            </div>

            {/* Exit Application Button */}
            <button
              onClick={() => setExitModalOpen(true)}
              id="sidebar_exit_btn"
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#251014] hover:bg-[#3D141B] text-[9px] font-bold uppercase tracking-wider text-rose-300 hover:text-rose-100 transition-all border border-rose-900/40 shadow-sm cursor-pointer truncate"
              title="Exit Application"
            >
              <LogOut className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">Exit</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => setExitModalOpen(true)}
              id="sidebar_exit_collapsed_btn"
              title="Exit Application"
              className="p-1.5 rounded-lg bg-[#251014] hover:bg-[#3D141B] text-rose-300 border border-rose-900/40 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
            </button>
            <div
              title={isOnline ? 'Online Sync Active' : 'Offline Storage'}
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#55D68A] ring-2 ring-[#55D68A]/20 shadow-sm' : 'bg-[#FF647C] ring-2 ring-[#FF647C]/20'
              }`}
            />
          </div>
        )}
      </div>

      {/* 4. RIGHT-SIDE FLYOUT NAVIGATION MENU (PORTALLED TO DOCUMENT.BODY) */}
      {typeof document !== 'undefined' && openSection && createPortal(
        <div
          ref={flyoutRef}
          id="sidebar_right_flyout_menu"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={(e) => {
            const related = e.relatedTarget as Node | null;
            if (sidebarRef.current && related && sidebarRef.current.contains(related)) {
              return;
            }
            setIsHovered(false);
            setOpenSection(null);
          }}
          style={{
            top: `${flyoutY}px`,
            left: `${flyoutX}px`,
            maxHeight: `calc(100vh - ${flyoutY + 12}px)`
          }}
          className="fixed z-[9999] w-72 flex flex-col bg-[rgba(8,27,46,0.96)] backdrop-blur-[24px] border border-[rgba(112,185,245,0.30)] shadow-[0_20px_50px_rgba(0,0,0,0.60),inset_0_1px_0_rgba(255,255,255,0.10)] rounded-[20px] p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100 before:content-[''] before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:bg-transparent"
        >
          {/* Flyout Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(112,185,245,0.25)] px-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]">
                {openSection === 'master' && <Database className="w-3.5 h-3.5" />}
                {openSection === 'accounting' && <Receipt className="w-3.5 h-3.5" />}
                {openSection === 'transaction' && <ArrowRightLeft className="w-3.5 h-3.5" />}
                {openSection === 'banking' && <Building2 className="w-3.5 h-3.5" />}
                {openSection === 'inventory' && <Boxes className="w-3.5 h-3.5" />}
                {openSection === 'reports' && <BarChart3 className="w-3.5 h-3.5" />}
                {openSection === 'data_config' && <FolderCog className="w-3.5 h-3.5" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#FFFFFF]">
                {openSection === 'master' && 'Master Records'}
                {openSection === 'accounting' && 'Accounting & Vouchers'}
                {openSection === 'transaction' && 'Transactions'}
                {openSection === 'banking' && 'Cash & Bank'}
                {openSection === 'inventory' && 'Inventory & Stock'}
                {openSection === 'reports' && 'Reports & Analytics'}
                {openSection === 'data_config' && 'Data Configuration'}
              </span>
            </div>
            <button
              onClick={() => setOpenSection(null)}
              className="p-1 rounded-md text-[#B7C9D9] hover:text-[#F1F7FC] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl transition cursor-pointer"
              title="Close Menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Flyout Content by Section */}
          <div className="space-y-1 overflow-y-auto pr-0.5 flex-1 min-h-0 [scrollbar-width:thin]">
            {/* MASTER FLYOUT */}
            {openSection === 'master' && (
              <>
                <button
                  onClick={() => handleNavClick('chart_of_accounts')}
                  id="flyout_chart_of_accounts_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'chart_of_accounts'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className={`w-4 h-4 ${activeTab === 'chart_of_accounts' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Chart of Accounts</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'chart_of_accounts' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Ledgers</span>
                </button>

                <button
                  onClick={() => handleNavClick('item_master')}
                  id="flyout_item_master_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'item_master' || activeTab === 'item' || activeTab === 'items'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className={`w-4 h-4 ${activeTab === 'item_master' || activeTab === 'item' || activeTab === 'items' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Item Master</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'item_master' || activeTab === 'item' || activeTab === 'items' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Products</span>
                </button>

                <button
                  onClick={() => handleNavClick('spare_parts')}
                  id="flyout_spare_parts_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'spare_parts' || activeTab === 'spare_parts_master'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Wrench className={`w-4 h-4 ${activeTab === 'spare_parts' || activeTab === 'spare_parts_master' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Spare Parts Master</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'spare_parts' || activeTab === 'spare_parts_master' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Stock</span>
                </button>

                <button
                  onClick={() => handleNavClick('location_master')}
                  id="flyout_location_master_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'location_master' || activeTab === 'locations'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Warehouse className={`w-4 h-4 ${activeTab === 'location_master' || activeTab === 'locations' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Location Master</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'location_master' || activeTab === 'locations' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Godowns</span>
                </button>

                <button
                  onClick={() => handleNavClick('city_state_master')}
                  id="flyout_city_master_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'city_state_master' || activeTab === 'city_master' || activeTab === 'cities'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className={`w-4 h-4 ${activeTab === 'city_state_master' || activeTab === 'city_master' || activeTab === 'cities' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>City Master</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'city_state_master' || activeTab === 'city_master' || activeTab === 'cities' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Cities</span>
                </button>
              </>
            )}

            {/* ACCOUNTING FLYOUT */}
            {openSection === 'accounting' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-[#7F98AE] uppercase tracking-wider px-2 pt-0.5">
                    Registers & Books
                  </div>
                  <button
                    onClick={() => handleNavClick('vouchers')}
                    id="flyout_vouchers_register_btn"
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      activeTab === 'vouchers'
                        ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                        : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className={`w-4 h-4 ${activeTab === 'vouchers' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                      <span>Vouchers Register</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                      Alt+V
                    </span>
                  </button>

                  <button
                    onClick={() => handleNavClick('day_book')}
                    id="flyout_day_book_btn"
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      activeTab === 'day_book'
                        ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                        : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar className={`w-4 h-4 ${activeTab === 'day_book' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                      <span>Day Book</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                      Alt+B
                    </span>
                  </button>
                </div>

                {/* Quick Voucher Entries */}
                <div className="pt-2 border-t border-[rgba(112,185,245,0.25)]">
                  <div className="text-[10px] font-semibold text-[#7F98AE] uppercase tracking-wider px-2 mb-1.5">
                    Quick Voucher Entry
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleVoucherClick('CONTRA')}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Contra</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F4
                      </span>
                    </button>

                    <button
                      onClick={() => handleVoucherClick('PAYMENT')}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#FF647C] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Payment</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#FF647C] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F5
                      </span>
                    </button>

                    <button
                      onClick={() => handleVoucherClick('RECEIPT')}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#55D68A] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Receipt</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#55D68A] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F6
                      </span>
                    </button>

                    <button
                      onClick={() => handleVoucherClick('JOURNAL')}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <BookOpen className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Journal</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F7
                      </span>
                    </button>

                    {/* Quick Debit Note Action */}
                    <button
                      onClick={() => handleVoucherClick('PURCHASE_RETURN')}
                      id="flyout_debit_note_btn"
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#FF647C] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Debit Note</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#FF647C] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F10
                      </span>
                    </button>

                    {/* Quick Credit Note Action */}
                    <button
                      onClick={() => handleVoucherClick('SALES_RETURN')}
                      id="flyout_credit_note_btn"
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#55D68A] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Credit Note</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#55D68A] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        F11
                      </span>
                    </button>

                    {/* Quick Spare Parts Purchase Action */}
                    <button
                      onClick={() => handleNavClick('spare_parts_purchase')}
                      id="flyout_spare_parts_purchase_btn"
                      className="col-span-2 flex items-center justify-between px-2.5 py-2 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] transition cursor-pointer border border-[rgba(112,185,245,0.25)]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Wrench className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
                        <span className="text-[11px] font-medium truncate">Spare Parts Purchase</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1 rounded">
                        Spares
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TRANSACTION FLYOUT */}
            {openSection === 'transaction' && (
              <div className="space-y-2.5">
                {/* SALE DROPDOWN */}
                <div className="rounded-xl border border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.42)] backdrop-blur-xl overflow-hidden">
                  <button
                    onClick={() => setIsSaleOpen((prev) => !prev)}
                    id="flyout_sale_dropdown_toggle"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-[rgba(57,167,255,0.2)] text-[#2588E8]">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold tracking-wide uppercase text-[11px] text-[#2588E8]">Sale</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(37, 136, 232, 0.12)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)] font-bold">
                        F8
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[#7F98AE] transition-transform duration-200 ${
                          isSaleOpen ? 'rotate-180 text-[#2588E8]' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isSaleOpen && (
                    <div className="px-2 pb-2 pt-0.5 space-y-1 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.28)] animate-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => handleNavClick('sales_quotation')}
                        id="flyout_sales_quotation_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'sales_quotation'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className={`w-3.5 h-3.5 ${activeTab === 'sales_quotation' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Sales Quotation</span>
                        </div>
                        <span className={`text-[9px] ${activeTab === 'sales_quotation' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Rate / Sqft</span>
                      </button>

                      <button
                        onClick={() => handleNavClick('sales_invoice')}
                        id="flyout_sales_invoice_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'sales_invoice' || activeTab === 'sales'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className={`w-3.5 h-3.5 ${activeTab === 'sales_invoice' || activeTab === 'sales' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Sales Invoice Form</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                          GST / Slabs
                        </span>
                      </button>

                      <button
                        onClick={() => handleNavClick('sales_challan')}
                        id="flyout_sales_challan_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'sales_challan'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className={`w-3.5 h-3.5 ${activeTab === 'sales_challan' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Delivery Challan</span>
                        </div>
                        <span className={`text-[9px] ${activeTab === 'sales_challan' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Dispatch</span>
                      </button>

                      <button
                        onClick={() => handleNavClick('sales_sundry')}
                        id="flyout_sales_sundry_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'sales_sundry'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className={`w-3.5 h-3.5 ${activeTab === 'sales_sundry' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Bill Sundry &amp; Series</span>
                        </div>
                        <span className={`text-[9px] ${activeTab === 'sales_sundry' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Config</span>
                      </button>

                      <button
                        onClick={() => handleNavClick('sales_register')}
                        id="flyout_sales_register_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'sales_register'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className={`w-3.5 h-3.5 ${activeTab === 'sales_register' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Sales Register</span>
                        </div>
                        <span className={`text-[9px] ${activeTab === 'sales_register' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Bills List</span>
                      </button>

                      <button
                        onClick={() => handleVoucherClick('SALES_RETURN')}
                        id="flyout_sales_return_btn"
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)] transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-[#55D68A] group-hover:scale-110 transition-transform" />
                          <span>Sales Return (Credit Note)</span>
                        </div>
                        <span className="text-[9px] font-mono text-[#7F98AE] bg-[rgba(18,48,76,0.48)] px-1 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">CR Note</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* PURCHASE DROPDOWN */}
                <div className="rounded-xl border border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.42)] backdrop-blur-xl overflow-hidden">
                  <button
                    onClick={() => setIsPurchaseOpen((prev) => !prev)}
                    id="flyout_purchase_dropdown_toggle"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-[rgba(57,167,255,0.2)] text-[#2588E8]">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold tracking-wide uppercase text-[11px] text-[#2588E8]">Purchase</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(37, 136, 232, 0.12)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)] font-bold">
                        F9
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[#7F98AE] transition-transform duration-200 ${
                          isPurchaseOpen ? 'rotate-180 text-[#2588E8]' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isPurchaseOpen && (
                    <div className="px-2 pb-2 pt-0.5 space-y-1 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.28)] animate-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => handleNavClick('purchase_invoice')}
                        id="flyout_purchase_invoice_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'purchase_invoice' || activeTab === 'purchase'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className={`w-3.5 h-3.5 ${activeTab === 'purchase_invoice' || activeTab === 'purchase' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Purchase Invoice Form</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                          GST / Slabs
                        </span>
                      </button>

                      <button
                        onClick={() => handleVoucherClick('PURCHASE')}
                        id="flyout_new_purchase_invoice_btn"
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)] transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5 text-[#2588E8] group-hover:scale-110 transition-transform" />
                          <span>Purchase Bill (Entry)</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                          F9
                        </span>
                      </button>

                      <button
                        onClick={() => handleNavClick('purchase_register')}
                        id="flyout_purchase_register_btn"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer group ${
                          activeTab === 'purchase_register'
                            ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                            : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className={`w-3.5 h-3.5 ${activeTab === 'purchase_register' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                          <span>Purchase Register</span>
                        </div>
                        <span className={`text-[9px] ${activeTab === 'purchase_register' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Bills List</span>
                      </button>

                      <button
                        onClick={() => handleVoucherClick('PURCHASE_RETURN')}
                        id="flyout_purchase_return_btn"
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)] transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-[#FF647C] group-hover:scale-110 transition-transform" />
                          <span>Purchase Return (Debit Note)</span>
                        </div>
                        <span className="text-[9px] font-mono text-[#7F98AE] bg-[rgba(18,48,76,0.48)] px-1 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">DR Note</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CASH & BANK FLYOUT */}
            {openSection === 'banking' && (
              <>
                <button
                  onClick={() => handleNavClick('cash_book')}
                  id="flyout_cash_book_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'cash_book'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet className={`w-4 h-4 ${activeTab === 'cash_book' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Cash Book</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'cash_book' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Cash Register</span>
                </button>

                <button
                  onClick={() => handleNavClick('bank_accounts')}
                  id="flyout_bank_accounts_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'bank_accounts'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className={`w-4 h-4 ${activeTab === 'bank_accounts' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Bank Accounts</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'bank_accounts' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Balances</span>
                </button>

                <button
                  onClick={() => handleNavClick('bank_reconciliation')}
                  id="flyout_bank_reconciliation_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'bank_reconciliation'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark className={`w-4 h-4 ${activeTab === 'bank_reconciliation' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Bank Rec. (BRS)</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                    Alt+R
                  </span>
                </button>
              </>
            )}

            {/* INVENTORY FLYOUT */}
            {openSection === 'inventory' && (
              <>
                <button
                  onClick={() => handleNavClick('stock_summary')}
                  id="flyout_stock_summary_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'stock_summary' || activeTab === 'inventory_summary'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className={`w-4 h-4 ${activeTab === 'stock_summary' || activeTab === 'inventory_summary' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Stock Summary</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                    Alt+S
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick('stock_journal')}
                  id="flyout_stock_journal_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'stock_journal' || activeTab === 'stock_journals'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ArrowRightLeft className={`w-4 h-4 ${activeTab === 'stock_journal' || activeTab === 'stock_journals' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Stock Journal</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                    Alt+J
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick('stock_ledger')}
                  id="flyout_stock_ledger_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'stock_ledger'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className={`w-4 h-4 ${activeTab === 'stock_ledger' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Stock Ledger</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'stock_ledger' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Item History</span>
                </button>

                <button
                  onClick={() => handleNavClick('wastage_analysis')}
                  id="flyout_wastage_analysis_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'wastage_analysis' || activeTab === 'wastage'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className={`w-4 h-4 ${activeTab === 'wastage_analysis' || activeTab === 'wastage' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Wastage Analysis</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'wastage_analysis' || activeTab === 'wastage' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Damage</span>
                </button>
              </>
            )}

            {/* REPORTS FLYOUT */}
            {openSection === 'reports' && (
              <>
                <button
                  onClick={() => handleNavClick('ledgers')}
                  id="flyout_ledger_statement_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'ledgers'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className={`w-4 h-4 ${activeTab === 'ledgers' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Ledger Statement</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                    Alt+L
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick('trial_balance')}
                  id="flyout_trial_balance_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'trial_balance'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className={`w-4 h-4 ${activeTab === 'trial_balance' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Trial Balance</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                    Alt+T
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick('profit_loss')}
                  id="flyout_profit_loss_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'profit_loss'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PieChart className={`w-4 h-4 ${activeTab === 'profit_loss' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Profit & Loss</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'profit_loss' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>P&L</span>
                </button>

                <button
                  onClick={() => handleNavClick('balance_sheet')}
                  id="flyout_balance_sheet_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'balance_sheet'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Scale className={`w-4 h-4 ${activeTab === 'balance_sheet' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Balance Sheet</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'balance_sheet' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Assets/Liab.</span>
                </button>

                <button
                  onClick={() => handleNavClick('outstanding')}
                  id="flyout_outstanding_aging_btn"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'outstanding'
                      ? 'bg-[rgba(37,136,232,0.20)] text-[#F1F7FC] border border-[rgba(82,199,255,0.38)] shadow-[0_0_15px_rgba(82,199,255,0.18)] font-semibold'
                      : 'text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(45,120,180,0.16)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className={`w-4 h-4 ${activeTab === 'outstanding' ? 'text-[#FFFFFF]' : 'text-[#2588E8]'}`} />
                    <span>Outstanding Aging</span>
                  </div>
                  <span className={`text-[10px] ${activeTab === 'outstanding' ? 'text-[#FFFFFF]/70' : 'text-[#7F98AE]'}`}>Dues</span>
                </button>
              </>
            )}

            {/* DATA CONFIG FLYOUT */}
            {openSection === 'data_config' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenSection(null);
                    handleBackupClick();
                  }}
                  id="flyout_backup_btn"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-[rgba(245,158,11,0.12)] transition cursor-pointer"
                  title="Backup active dataset to JSON file"
                >
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Backup (.json)</span>
                  </div>
                  {savedFolderNameState && (
                    <span className="text-[10px] font-mono text-emerald-400/90 truncate max-w-[80px]" title={savedFolderNameState}>
                      {savedFolderNameState}
                    </span>
                  )}
                </button>

                <label
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 hover:bg-[rgba(56,189,248,0.12)] transition cursor-pointer"
                  title="Restore dataset from JSON backup file"
                >
                  <div className="flex items-center gap-2.5">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>Restore</span>
                  </div>
                  <span className="text-[10px] text-[#7F98AE]">Import</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      setOpenSection(null);
                      handleRestoreInput(e);
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Backup Storage Location Modal */}
      <BackupLocationModal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        onBackupSuccess={() => {
          setSavedFolderNameState(getSavedFolderName());
        }}
      />

      {/* Exit Confirmation Modal */}
      <ExitConfirmModal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
      />
    </aside>
  );
};

export default Sidebar;
