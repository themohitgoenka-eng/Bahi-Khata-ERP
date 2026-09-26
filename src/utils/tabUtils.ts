import { WorkspaceTab } from '../types';

export const getTabMeta = (
  tabKey: string,
  ledgerName?: string | null
): { title: string; iconName: string } => {
  switch (tabKey) {
    case 'dashboard':
      return { title: 'Dashboard', iconName: 'LayoutDashboard' };
    case 'day_book':
      return { title: 'Day Book', iconName: 'BookOpen' };
    case 'cash_book':
      return { title: 'Cash Book', iconName: 'Coins' };
    case 'vouchers':
      return { title: 'Voucher Register', iconName: 'Receipt' };
    case 'sales_register':
      return { title: 'Sales Register', iconName: 'ShoppingBag' };
    case 'sales':
    case 'sales_invoice':
      return { title: 'Sales Invoices', iconName: 'Receipt' };
    case 'sales_quotation':
      return { title: 'Sales Quotation', iconName: 'FileText' };
    case 'sales_challan':
      return { title: 'Delivery Challan', iconName: 'Truck' };
    case 'sales_sundry':
      return { title: 'Bill Sundry & Series', iconName: 'Layers' };
    case 'purchase_register':
      return { title: 'Purchase Register', iconName: 'ShoppingCart' };
    case 'spare_parts_purchase':
      return { title: 'Spare Parts Purchase', iconName: 'Wrench' };
    case 'ledgers':
      return { title: ledgerName ? `${ledgerName}` : 'Ledger Statement', iconName: 'FileText' };
    case 'trial_balance':
      return { title: 'Trial Balance', iconName: 'Scale' };
    case 'profit_loss':
      return { title: 'Profit & Loss', iconName: 'TrendingUp' };
    case 'balance_sheet':
      return { title: 'Balance Sheet', iconName: 'BarChart3' };
    case 'outstanding':
      return { title: 'Outstandings', iconName: 'Clock' };
    case 'chart_of_accounts':
      return { title: 'Chart of Accounts', iconName: 'FolderTree' };
    case 'item_master':
    case 'item':
    case 'items':
      return { title: 'Item Master', iconName: 'Package' };
    case 'spare_parts':
    case 'spare_parts_master':
      return { title: 'Spare Parts Master', iconName: 'Wrench' };
    case 'location_master':
    case 'locations':
    case 'godowns':
      return { title: 'Godown Master', iconName: 'Warehouse' };
    case 'city_state_master':
    case 'city_master':
    case 'cities':
      return { title: 'Cities Master', iconName: 'MapPin' };
    case 'state_master':
    case 'states':
    case 'state_gst_master':
    case 'state_gst':
    case 'gst_codes':
      return { title: 'State', iconName: 'Globe' };
    case 'bank_accounts':
      return { title: 'Bank Accounts', iconName: 'Landmark' };
    case 'bank_reconciliation':
      return { title: 'Bank BRS', iconName: 'CheckCheck' };
    case 'inventory_summary':
    case 'stock_summary':
      return { title: 'Stock Summary', iconName: 'Boxes' };
    case 'stock_journal':
    case 'stock_journals':
      return { title: 'Stock Journal', iconName: 'ArrowRightLeft' };
    case 'stock_ledger':
      return { title: 'Stock Ledger', iconName: 'Layers' };
    case 'wastage_analysis':
    case 'wastage':
      return { title: 'Wastage Analysis', iconName: 'AlertTriangle' };
    case 'sync':
      return { title: 'Cloud Sync', iconName: 'Cloud' };
    default: {
      const clean = tabKey
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { title: clean, iconName: 'FileText' };
    }
  }
};

export const createDefaultDashboardTab = (): WorkspaceTab => ({
  id: 'dashboard',
  tabKey: 'dashboard',
  title: 'Dashboard',
  iconName: 'LayoutDashboard',
  closable: false,
});
