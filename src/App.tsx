import React, { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { WorkspaceTaskbar } from './components/layout/WorkspaceTaskbar';
import { VoucherEntryModal } from './components/accounting/VoucherEntryModal';
import { SalesInvoiceModal } from './components/SalesInvoiceModal';
import { Wrench, Receipt, Loader2 } from 'lucide-react';
import { shortcutService } from './services/shortcutService';
import { VoucherType } from './types';

// --- Route-level code splitting: heavy views are lazily loaded on demand ---
// This keeps the initial bundle small (dashboard + shell only); reports,
// inventory, banking & PDF/Excel-export views load their JS only when opened.
const named = <T extends Record<string, any>>(p: Promise<T>, key: keyof T) =>
  p.then((m) => ({ default: m[key] as React.ComponentType<any> }));

const DashboardView = lazy(() => named(import('./components/dashboard/DashboardView'), 'DashboardView'));
const VoucherRegisterView = lazy(() => named(import('./components/accounting/VoucherRegisterView'), 'VoucherRegisterView'));
const DayBookView = lazy(() => named(import('./components/accounting/DayBookView'), 'DayBookView'));
const LedgerView = lazy(() => named(import('./components/accounting/LedgerView'), 'LedgerView'));
const CashBookView = lazy(() => named(import('./components/accounting/CashBookView'), 'CashBookView'));
const ChartOfAccountsView = lazy(() => named(import('./components/accounting/ChartOfAccountsView'), 'ChartOfAccountsView'));
const ItemMasterView = lazy(() => named(import('./components/master/ItemMasterView'), 'ItemMasterView'));
const SparePartsMasterView = lazy(() => named(import('./components/master/SparePartsMasterView'), 'SparePartsMasterView'));
const LocationMasterView = lazy(() => named(import('./components/master/LocationMasterView'), 'LocationMasterView'));
const CityStateMasterView = lazy(() => named(import('./components/master/CityStateMasterView'), 'CityStateMasterView'));
const BankAccountsView = lazy(() => named(import('./components/banking/BankAccountsView'), 'BankAccountsView'));
const BankReconciliationView = lazy(() => named(import('./components/banking/BankReconciliationView'), 'BankReconciliationView'));
const StockSummaryView = lazy(() => named(import('./components/inventory/StockSummaryView'), 'StockSummaryView'));
const StockJournalView = lazy(() => named(import('./components/inventory/StockJournalView'), 'StockJournalView'));
const StockLedgerView = lazy(() => named(import('./components/inventory/StockLedgerView'), 'StockLedgerView'));
const WastageAnalysisView = lazy(() => named(import('./components/inventory/WastageAnalysisView'), 'WastageAnalysisView'));
const TrialBalanceView = lazy(() => named(import('./components/financial/TrialBalanceView'), 'TrialBalanceView'));
const ProfitLossView = lazy(() => named(import('./components/financial/ProfitLossView'), 'ProfitLossView'));
const BalanceSheetView = lazy(() => named(import('./components/financial/BalanceSheetView'), 'BalanceSheetView'));
const OutstandingView = lazy(() => named(import('./components/financial/OutstandingView'), 'OutstandingView'));
const SyncCenterView = lazy(() => named(import('./components/sync/SyncCenterView'), 'SyncCenterView'));
const CompanyDataView = lazy(() => named(import('./components/company/CompanyDataView'), 'CompanyDataView'));
const SalesView = lazy(() => named(import('./components/sales/SalesView'), 'SalesView'));
const TransactionCrudTable = lazy(() => named(import('./components/TransactionCrudTable'), 'TransactionCrudTable'));

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isVoucherModalOpen,
    voucherModalOpen,
    voucherModalType,
    editingVoucher,
    voucherModalPrefillLedgerId,
    notifyVouchersUpdated,
    openVoucherModal,
    closeVoucherModal,
    refreshActiveData,
    setGlobalSearchOpen,
    shortcuts,
    triggerSync,
    minimizedInvoice,
  } = useApp();

  // Auto slide-down/open dropdown menu whenever focus moves into any <select> element
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (target instanceof HTMLSelectElement && !target.disabled) {
        try {
          (target as any).showPicker?.();
        } catch {
          // Ignore if browser restricts or doesn't support
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    // Global Auto-Focus on first field when ANY modal/form opens anywhere across the entire app
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              const isModal =
                (node.classList.contains('fixed') &&
                  (node.classList.contains('inset-0') ||
                    node.className.includes('z-[') ||
                    node.classList.contains('z-50'))) ||
                node.getAttribute('role') === 'dialog';

              const modalContainer = isModal
                ? node
                : (node.querySelector('.fixed.inset-0, [role="dialog"]') as HTMLElement | null);

              if (modalContainer) {
                setTimeout(() => {
                  if (!modalContainer.contains(document.activeElement)) {
                    const firstField = modalContainer.querySelector<HTMLElement>(
                      'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
                    );
                    if (firstField) {
                      firstField.focus();
                    }
                  }
                }, 80);
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      observer.disconnect();
    };
  }, []);

  // Dynamic Keyboard Shortcuts based on user configuration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Handle Escape for modal
      if (e.key === 'Escape') {
        if (isVoucherModalOpen || voucherModalOpen) {
          e.preventDefault();
          closeVoucherModal();
          return;
        }
      }

      // Check all active configured shortcuts
      for (const sc of shortcuts) {
        if (!sc.enabled) continue;

        if (shortcutService.matchesEvent(e, sc)) {
          // If in an input field, only intercept function keys or explicit Ctrl/Alt combinations
          if (isInput && !sc.key.startsWith('F') && !sc.ctrlKey && !sc.altKey) {
            continue;
          }

          e.preventDefault();

          switch (sc.actionType) {
            case 'OPEN_VOUCHER':
              openVoucherModal((sc.targetPayload as VoucherType) || 'PAYMENT');
              break;
            case 'NAVIGATE_TAB':
              if (sc.targetPayload) {
                setActiveTab(sc.targetPayload);
              }
              break;
            case 'GLOBAL_SEARCH':
              setGlobalSearchOpen(true);
              break;
            case 'SYNC_CLOUD':
              triggerSync();
              break;
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, isVoucherModalOpen, voucherModalOpen, openVoucherModal, closeVoucherModal, setActiveTab, setGlobalSearchOpen, triggerSync]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'vouchers':
        return <VoucherRegisterView />;
      case 'sales':
        return <SalesView initialSubTab="sales_invoice" />;
      case 'sales_quotation':
        return <SalesView initialSubTab="sales_quotation" />;
      case 'sales_invoice':
        return <SalesView initialSubTab="sales_invoice" />;
      case 'sales_challan':
        return <SalesView initialSubTab="sales_challan" />;
      case 'sales_sundry':
        return <SalesView initialSubTab="sales_sundry" />;
      case 'sales_register':
        return <VoucherRegisterView initialFilterType="SALES" title="Sales Register" />;
      case 'purchase_invoice':
      case 'purchase':
        return (
          <TransactionCrudTable
            formType="purchase_invoice"
            title="Purchase Invoices & Billing Register"
            subtitle="Full GST Purchase Invoices with Series, Godowns, Vehicle Logistics, Sundry Taxes, and Pakka/Kacha Split"
            icon={<Receipt className="w-5 h-5 text-amber-400" />}
          />
        );
      case 'purchase_register':
        return <VoucherRegisterView initialFilterType="PURCHASE" title="Purchase Register" />;
      case 'day_book':
        return <DayBookView />;
      case 'cash_book':
        return <CashBookView />;
      case 'ledgers':
        return <LedgerView />;
      case 'chart_of_accounts':
        return <ChartOfAccountsView />;
      case 'item_master':
      case 'item':
      case 'items':
        return <ItemMasterView />;
      case 'spare_parts':
      case 'spare_parts_master':
        return <SparePartsMasterView />;
      case 'spare_parts_purchase':
        return (
          <TransactionCrudTable
            formType="spare_parts_purchase"
            title="Spare Parts Purchase Register & Billing"
            subtitle="Record and track machine spares, gangsaw blade segments, lubricants & maintenance purchases"
            icon={<Wrench className="w-5 h-5 text-amber-400" />}
          />
        );
      case 'location_master':
      case 'locations':
      case 'godowns':
        return <LocationMasterView />;
      case 'city_state_master':
      case 'city_master':
      case 'cities':
        return <CityStateMasterView initialTab="cities" />;
      case 'state_master':
      case 'states':
      case 'state_gst_master':
      case 'state_gst':
      case 'gst_codes':
        return <CityStateMasterView initialTab="states" />;
      case 'bank_accounts':
        return <BankAccountsView />;
      case 'bank_reconciliation':
        return <BankReconciliationView />;
      case 'inventory_summary':
      case 'stock_summary':
        return <StockSummaryView />;
      case 'stock_journal':
      case 'stock_journals':
        return <StockJournalView />;
      case 'stock_ledger':
        return <StockLedgerView />;
      case 'wastage_analysis':
      case 'wastage':
        return <WastageAnalysisView />;
      case 'trial_balance':
        return <TrialBalanceView />;
      case 'profit_loss':
        return <ProfitLossView />;
      case 'balance_sheet':
        return <BalanceSheetView />;
      case 'outstanding':
        return <OutstandingView />;
      case 'sync':
        return <SyncCenterView />;
      case 'comp_data':
      case 'company_data':
        return <CompanyDataView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen max-h-screen bg-transparent text-[#FFFFFF] flex flex-col font-sans selection:bg-[#2588E8] selection:text-[#FFFFFF] overflow-hidden">
      {/* Top Main Navigation Header */}
      <Header />

      {/* Main Container with Sidebar + Active Content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          {/* Workspace Taskbar */}
          <WorkspaceTaskbar />
          
          <main className="flex-1 overflow-y-auto min-h-0 bg-transparent px-2.5 sm:px-3.5 pt-2 pb-3.5">
            <div className="w-full">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-24 text-app-text-muted gap-2 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-app-primary" />
                    <span>Loading module…</span>
                  </div>
                }
              >
                {renderActiveView()}
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {/* Global Voucher Entry Modal */}
      {(isVoucherModalOpen || voucherModalOpen || (minimizedInvoice && (minimizedInvoice.formType === 'sales_invoice' || minimizedInvoice.formType === 'purchase_invoice'))) && (
        (voucherModalType === 'SALES' || voucherModalType === 'PURCHASE' || minimizedInvoice?.formType === 'sales_invoice' || minimizedInvoice?.formType === 'purchase_invoice') ? (
          <SalesInvoiceModal
            initialData={editingVoucher}
            formType={voucherModalType === 'PURCHASE' ? 'purchase_invoice' : 'sales_invoice'}
            onClose={closeVoucherModal}
            onSaveSuccess={() => {
              closeVoucherModal();
              refreshActiveData();
              notifyVouchersUpdated();
            }}
          />
        ) : (
          <VoucherEntryModal
            initialType={voucherModalType}
            voucherToEdit={editingVoucher}
            prefillLedgerId={voucherModalPrefillLedgerId || undefined}
            onClose={closeVoucherModal}
            onSuccess={() => {
              refreshActiveData();
              notifyVouchersUpdated();
            }}
          />
        )
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
