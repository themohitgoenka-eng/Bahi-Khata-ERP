import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { WorkspaceTaskbar } from './components/layout/WorkspaceTaskbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VoucherRegisterView } from './components/accounting/VoucherRegisterView';
import { DayBookView } from './components/accounting/DayBookView';
import { LedgerView } from './components/accounting/LedgerView';
import { CashBookView } from './components/accounting/CashBookView';
import { ChartOfAccountsView } from './components/accounting/ChartOfAccountsView';
import { ItemMasterView } from './components/master/ItemMasterView';
import { SparePartsMasterView } from './components/master/SparePartsMasterView';
import { LocationMasterView } from './components/master/LocationMasterView';
import { CityStateMasterView } from './components/master/CityStateMasterView';
import { VoucherEntryModal } from './components/accounting/VoucherEntryModal';
import { SalesInvoiceModal } from './components/SalesInvoiceModal';
import { BankAccountsView } from './components/banking/BankAccountsView';
import { BankReconciliationView } from './components/banking/BankReconciliationView';
import { StockSummaryView } from './components/inventory/StockSummaryView';
import { StockJournalView } from './components/inventory/StockJournalView';
import { StockLedgerView } from './components/inventory/StockLedgerView';
import { WastageAnalysisView } from './components/inventory/WastageAnalysisView';
import { TrialBalanceView } from './components/financial/TrialBalanceView';
import { ProfitLossView } from './components/financial/ProfitLossView';
import { BalanceSheetView } from './components/financial/BalanceSheetView';
import { OutstandingView } from './components/financial/OutstandingView';
import { SyncCenterView } from './components/sync/SyncCenterView';
import { CompanyDataView } from './components/company/CompanyDataView';
import { SalesView } from './components/sales/SalesView';
import { TransactionCrudTable } from './components/TransactionCrudTable';
import { Wrench, Receipt } from 'lucide-react';
import { shortcutService } from './services/shortcutService';
import { VoucherType } from './types';

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
              {renderActiveView()}
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
