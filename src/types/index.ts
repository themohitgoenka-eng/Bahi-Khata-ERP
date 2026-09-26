// Core Application Types

export interface Company {
  id: string;
  uuid: string;
  name: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  booksBeginningDate?: string; // YYYY-MM-DD
  financialYearStartDate?: string; // YYYY-MM-DD
  baseCurrency?: string; // 'INR' (₹)
  currencySymbol?: string;
  currencyCode?: string;
  decimalPlaces?: number;
  accountingEnabled?: boolean;
  inventoryEnabled?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalYear {
  id: string;
  uuid: string;
  companyId: string;
  name: string; // e.g. "FY 2026-27"
  startDate: string; // 2026-04-01
  endDate: string; // 2027-03-31
  isClosed?: boolean;
  isLocked: boolean;
  isTransferred?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'CAPITAL'
  | 'DIRECT_EXPENSE'
  | 'INDIRECT_EXPENSE'
  | 'DIRECT_INCOME'
  | 'INDIRECT_INCOME'
  | 'BANK'
  | 'CASH'
  | 'SUNDRY_DEBTOR'
  | 'SUNDRY_CREDITOR';

export interface AccountGroup {
  id: string;
  uuid: string;
  companyId: string;
  name: string;
  parentGroupId?: string | null;
  accountType: AccountType;
  isPrimary: boolean;
  nature: 'DEBIT' | 'CREDIT';
}

export interface Ledger {
  id: string;
  uuid: string;
  companyId: string;
  groupId: string;
  name: string;
  accountType: AccountType;
  openingBalance: number;
  openingBalanceType: 'DR' | 'CR';
  openingBalancePakka?: number;
  openingBalancePakkaType?: 'DR' | 'CR';
  openingBalanceKacha?: number;
  openingBalanceKachaType?: 'DR' | 'CR';
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  isActive: boolean;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
  };
  gstin?: string;
  pan?: string;
  tin?: string;
  createdAt: string;
  updatedAt: string;
}

export type VoucherType =
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'SALES'
  | 'PURCHASE'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'STOCK_ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'BANK_ENTRY';

export interface VoucherLine {
  id: string;
  uuid: string;
  ledgerId: string;
  ledgerName?: string;
  type: 'DR' | 'CR';
  amount: number;
  narration?: string;
}

export interface InventoryItemLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  alternateQty?: number;
  alternateUnit?: string;
  discount?: number;
  godown?: string;
  locationId?: string;
}

export interface Voucher {
  id: string;
  uuid: string;
  voucherNumber: string;
  voucherType: VoucherType;
  date: string; // YYYY-MM-DD
  companyId: string;
  fiscalYearId: string;
  narration: string;
  referenceNo?: string;
  referenceDate?: string;
  series?: string;
  lines: VoucherLine[];
  inventoryLines?: InventoryItemLine[];
  totalDebit: number;
  totalCredit: number;
  status: 'POSTED' | 'CANCELLED' | 'REVERSED';
  isReversed?: boolean;
  reversedVoucherId?: string;
  bankTransactionId?: string;
  deviceId: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface SeriesBillSundryConfig {
  name: string;
  amount: number | string;
  type: 'ADD' | 'SUBTRACT' | 'ADD_LESS';
  isPercentage?: boolean;
}

export interface VoucherSeriesConfig {
  id: string;
  voucherType: VoucherType | 'ALL';
  seriesName: string;
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberPadding?: number;
  useDefaultPattern?: boolean; // When true (or default), series uses shared numbering pattern. When false, independent custom pattern!
  defaultSundries?: SeriesBillSundryConfig[]; // Default bill sundries for this series
  defaultDrLedgerId?: string;
  defaultCrLedgerId?: string;
  defaultDrLedgerIds?: string[];
  defaultCrLedgerIds?: string[];
  isDefault?: boolean;
}

export interface ItemUnit {
  id: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface UnitConversion {
  id: string;
  primaryUnit: string;
  alternateUnit: string;
  conversionFactor: number; // e.g., 4 SQFT = 1 PCS -> factor is 4 (4 SQFT per 1 PCS)
}

export interface SparePartItem {
  id: string;
  uuid: string;
  companyId: string;
  partNumber: string;
  name: string;
  itemCategory: string;
  machineCategory: string;
  machineModel?: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  reorderLevel: number;
  unitCost: number;
  locationBin?: string;
  supplierBrand?: string;
  criticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  specifications?: string;
  notes?: string;
  lastReplacedDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemLocationBalance {
  id: string;
  locationId: string;
  locationName?: string;
  qty: number | string;
  rate: number | string;
  amount: number | string;
}

export interface InventoryItem {
  id: string;
  uuid: string;
  companyId: string;
  code: string;
  name: string;
  taxPercent?: number | string; // Tax percentage (e.g. 0, 5, 12, 18, 28)
  category?: string;
  salesAc?: string;
  purchaseAc?: string;
  salesAccountId?: string;
  purchaseAccountId?: string;
  primaryUnit: string; // e.g. "SQFT"
  alternateUnit?: string; // e.g. "PCS"
  conversionFactor?: number; // e.g. 4 (4 SQFT = 1 PCS) or 0.25 (1 SQFT = 0.25 PCS)
  conversionDirection?: 'PRIMARY_TO_ALT' | 'ALT_TO_PRIMARY';
  decimalPlaces?: number; // e.g. 2, 3, 0
  openingQty?: number;
  openingQuantity?: number;
  openingStock?: number;
  openingRate?: number;
  openingValue?: number;
  closingStock?: number;
  closingRate?: number;
  closingValue?: number;
  locationBalances?: ItemLocationBalance[];
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  valuationMethod?: 'FIFO' | 'WEIGHTED_AVG' | 'MOVING_AVG';
  defaultGodown?: string;
  defaultLocationId?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LocationType =
  | 'GODOWN'
  | 'WAREHOUSE'
  | 'YARD'
  | 'FACTORY_FLOOR'
  | 'SHOWROOM'
  | 'BRANCH'
  | 'TRANSIT'
  | 'OTHER';

export interface Location {
  id: string;
  uuid: string;
  companyId: string;
  code: string;
  name: string;
  type: LocationType | string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  inchargePerson?: string;
  phone?: string;
  email?: string;
  capacity?: string;
  isDefault?: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type Godown = Location;

export interface StateMasterItem {
  code: string; // 2-digit GST state code: '08', '23', etc.
  name: string; // 'Rajasthan', 'Madhya Pradesh', etc.
  shortCode?: string; // 'RJ', 'MP', etc.
  capital?: string;
  isUnionTerritory?: boolean;
}

export interface CityMasterItem {
  id: string;
  cityName: string;
  stateName: string;
  stateCode?: string;
  district?: string;
  pincode?: string;
  isDefault?: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  uuid: string;
  companyId: string;
  fiscalYearId: string;
  date: string;
  itemId: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherType | 'WASTAGE' | 'CONVERSION' | 'MANUFACTURING_CONSUMPTION' | 'MANUFACTURING_OUTPUT' | 'STOCK_JOURNAL';
  transactionType: 'IN' | 'OUT' | 'WASTAGE';
  quantity: number;
  unit: string;
  rate: number;
  value: number;
  godown?: string;
  locationId?: string;
  remarks?: string;
  createdAt: string;
}

export type StockJournalType =
  | 'MANUFACTURING'
  | 'INTER_LOCATION'
  | 'CONSUMPTION_PRODUCTION'
  | 'GENERAL_TRANSFER'
  | 'STOCK_ADJUSTMENT';

export interface StockJournalItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  godown?: string;
  locationId?: string;
  alternateQty?: number;
  alternateUnit?: string;
  notes?: string;
}

export interface StockJournalEntry {
  id: string;
  uuid: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  companyId: string;
  fiscalYearId: string;
  journalType: StockJournalType;
  narration: string;
  referenceNo?: string;
  sourceItems: StockJournalItem[]; // Consumption / Transferred Out / Issue
  destinationItems: StockJournalItem[]; // Production / Transferred In / Output
  sourceLocationId?: string;
  sourceLocationName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
  additionalCost?: number; // Overheads (Labor, Processing, Electricity, Freight, etc.)
  totalSourceQty: number;
  totalSourceAmount: number;
  totalDestinationQty: number;
  totalDestinationAmount: number;
  status: 'POSTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface WastageEntry {
  id: string;
  uuid?: string;
  companyId: string;
  fiscalYearId: string;
  date: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  unit?: string;
  rate?: number;
  totalValue?: number;
  reason?: string;
  wastageType?: string;
  godown?: string;
  locationId?: string;
  referenceNo?: string;
  remarks?: string;
  accountingVoucherId?: string;
  createdAt: string;
}

export type WastageRecord = WastageEntry;

export interface BankAccount {
  id: string;
  uuid?: string;
  companyId: string;
  ledgerId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch?: string;
  ifsc?: string;
  ifscCode?: string;
  accountType?: 'CURRENT' | 'SAVINGS' | 'OVERDRAFT' | 'CASH_CREDIT' | string;
  openingBalance: number;
  openingDate?: string;
  currentBalance?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankStatementTransaction {
  id: string;
  uuid?: string;
  companyId: string;
  fiscalYearId: string;
  bankAccountId: string;
  date: string; // YYYY-MM-DD
  narration: string;
  description?: string;
  referenceNo?: string;
  chequeNo?: string;
  type: 'DEBIT' | 'CREDIT'; // DEBIT = Withdrawal, CREDIT = Deposit
  amount: number;
  debit?: number;
  credit?: number;
  balance?: number;
  suggestedLedgerName?: string;
  suggestedLedgerId?: string;
  selectedLedgerId?: string;
  selectedLedgerName?: string;
  transactionType?: 'Payment' | 'Receipt' | 'Contra';
  reconciliationStatus: 'UNMATCHED' | 'MATCHED' | 'MANUALLY_MATCHED' | 'POSTED' | 'IGNORED';
  matchedVoucherId?: string;
  postedVoucherId?: string;
  matchedDate?: string;
  matchScore?: number;
  createdAt?: string;
}

export interface BrsRule {
  id: string;
  name: string;
  keywords: string[]; // e.g. ['GANPATI', 'NEFT/GANPATI']
  targetLedgerId: string;
  targetLedgerName: string;
  transactionType: 'Payment' | 'Receipt' | 'ANY';
  autoPost?: boolean;
  priority?: number;
  isActive: boolean;
}

export type BankStatementEntry = BankStatementTransaction;

export interface SyncQueueItem {
  id: string;
  transactionUuid: string;
  companyId: string;
  fiscalYearId: string;
  deviceId: string;
  entityType: 'VOUCHER' | 'LEDGER' | 'ITEM' | 'STOCK' | 'WASTAGE' | 'BANK_TRANSACTION' | 'RECONCILIATION';
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST';
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
  retryCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  uuid: string;
  companyId: string;
  fiscalYearId: string;
  date: string;
  action: 'CREATE' | 'EDIT' | 'CANCEL' | 'REVERSE' | 'IMPORT' | 'POST' | 'RECONCILE' | 'SYNC' | 'BACKUP' | 'RESTORE' | 'YEAR_CLOSE';
  entity: string;
  entityId: string;
  summary: string;
  oldValue?: string;
  newValue?: string;
  deviceId: string;
  createdAt: string;
}

export type ShortcutActionType =
  | 'OPEN_VOUCHER'
  | 'NAVIGATE_TAB'
  | 'GLOBAL_SEARCH'
  | 'SYNC_CLOUD';

export interface ShortcutKeyConfig {
  id: string;
  label: string;
  category: 'Voucher Entry' | 'Navigation' | 'Actions';
  actionType: ShortcutActionType;
  targetPayload?: string; // e.g. 'CONTRA', 'PAYMENT', 'dashboard', 'ledgers'
  key: string; // e.g. 'F4', 'D', 'N'
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  enabled: boolean;
  isSystemDefault?: boolean;
  description?: string;
}

export interface WorkspaceTab {
  id: string;
  tabKey: string;
  title: string;
  subtitle?: string;
  iconName?: string;
  closable: boolean;
  ledgerId?: string | null;
  ledgerName?: string | null;
}

