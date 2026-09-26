import {
  Company,
  FiscalYear,
  AccountGroup,
  Ledger,
  Voucher,
  InventoryItem,
  StockTransaction,
  StockJournalEntry,
  WastageEntry,
  BankAccount,
  BankStatementTransaction,
  SyncQueueItem,
  AuditLog,
  ItemUnit,
  UnitConversion,
  Location,
} from '../../types';
import {
  createDefaultCompanyAndFiscalYear,
  getDefaultAccountGroups,
  getDefaultLedgers,
  getDefaultInventoryItems,
  getDefaultLocations,
  DEFAULT_UNITS,
} from './defaultData';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_DB_NAME = 'BahiKhata_Global_Master';
const LEGACY_GLOBAL_DB_NAME = 'LekhaVeda_Global_Master';
const GLOBAL_DB_VERSION = 1;

export interface CompanyDataset {
  company: Company;
  fiscalYear: FiscalYear;
  accountGroups: AccountGroup[];
  ledgers: Ledger[];
  vouchers: Voucher[];
  items: InventoryItem[];
  units: ItemUnit[];
  conversions: UnitConversion[];
  locations?: Location[];
  stockTransactions: StockTransaction[];
  stockJournals?: StockJournalEntry[];
  wastageEntries: WastageEntry[];
  bankAccounts: BankAccount[];
  bankTransactions: BankStatementTransaction[];
  syncQueue: SyncQueueItem[];
  auditLogs: AuditLog[];
}

export class IsolatedStorageService {
  private activeCompanyId: string = '';
  private activeFiscalYearId: string = '';

  // Get Database name strictly isolated per Company + Fiscal Year
  private getDatasetDbName(companyId: string, fiscalYearId: string): string {
    return `BahiKhata-ERP_Dataset_${companyId}_${fiscalYearId}`;
  }

  private getLegacyDatasetDbName(companyId: string, fiscalYearId: string): string {
    return `LekhaVeda_Dataset_${companyId}_${fiscalYearId}`;
  }

  // Open Global Master DB for Companies and Fiscal Years
  private async openGlobalDb(): Promise<IDBDatabase> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(GLOBAL_DB_NAME, GLOBAL_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const d = (event.target as IDBOpenDBRequest).result;
        if (!d.objectStoreNames.contains('companies')) {
          d.createObjectStore('companies', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('fiscal_years')) {
          const fyStore = d.createObjectStore('fiscal_years', { keyPath: 'id' });
          fyStore.createIndex('companyId', 'companyId', { unique: false });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const d = request.result;
        d.onversionchange = () => {
          try {
            d.close();
          } catch (e) {
            // ignore
          }
        };
        resolve(d);
      };
      request.onerror = () => reject(request.error);
    });

    await this.migrateLegacyGlobalDbIfNeeded(db);
    return db;
  }

  private async migrateLegacyGlobalDbIfNeeded(newDb: IDBDatabase): Promise<void> {
    try {
      const hasCompanies = await new Promise<boolean>((resolve) => {
        try {
          const tx = newDb.transaction('companies', 'readonly');
          const countReq = tx.objectStore('companies').count();
          countReq.onsuccess = () => resolve(countReq.result > 0);
          countReq.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });

      if (hasCompanies) return;

      const legacyDb = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(LEGACY_GLOBAL_DB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (!legacyDb) return;

      for (const storeName of ['companies', 'fiscal_years', 'settings']) {
        if (legacyDb.objectStoreNames.contains(storeName)) {
          const items = await new Promise<any[]>((resolve) => {
            try {
              const tx = legacyDb.transaction(storeName, 'readonly');
              const req = tx.objectStore(storeName).getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            } catch {
              resolve([]);
            }
          });

          if (items.length > 0) {
            const tx = newDb.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const item of items) {
              store.put(item);
            }
            await new Promise<void>((resolve) => {
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            });
          }
        }
      }
      legacyDb.close();
    } catch (err) {
      console.warn('Legacy global DB migration skipped:', err);
    }
  }

  // Open isolated DB for specific Company + Fiscal Year
  private async openDatasetDb(companyId: string, fiscalYearId: string): Promise<IDBDatabase> {
    const dbName = this.getDatasetDbName(companyId, fiscalYearId);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 2);

      request.onupgradeneeded = (event) => {
        const d = (event.target as IDBOpenDBRequest).result;

        const stores = [
          { name: 'account_groups', keyPath: 'id' },
          { name: 'ledgers', keyPath: 'id' },
          { name: 'vouchers', keyPath: 'id' },
          { name: 'inventory_items', keyPath: 'id' },
          { name: 'units', keyPath: 'id' },
          { name: 'unit_conversions', keyPath: 'id' },
          { name: 'stock_transactions', keyPath: 'id' },
          { name: 'stock_journals', keyPath: 'id' },
          { name: 'wastage_entries', keyPath: 'id' },
          { name: 'bank_accounts', keyPath: 'id' },
          { name: 'bank_transactions', keyPath: 'id' },
          { name: 'sync_queue', keyPath: 'id' },
          { name: 'audit_logs', keyPath: 'id' },
        ];

        stores.forEach(({ name, keyPath }) => {
          if (!d.objectStoreNames.contains(name)) {
            const store = d.createObjectStore(name, { keyPath });
            if (name === 'vouchers') {
              store.createIndex('uuid', 'uuid', { unique: true });
              store.createIndex('voucherNumber', 'voucherNumber', { unique: false });
              store.createIndex('date', 'date', { unique: false });
              store.createIndex('voucherType', 'voucherType', { unique: false });
            }
            if (name === 'stock_journals') {
              store.createIndex('uuid', 'uuid', { unique: true });
              store.createIndex('voucherNo', 'voucherNo', { unique: false });
              store.createIndex('date', 'date', { unique: false });
              store.createIndex('journalType', 'journalType', { unique: false });
            }
            if (name === 'bank_transactions') {
              store.createIndex('bankAccountId', 'bankAccountId', { unique: false });
              store.createIndex('reconciliationStatus', 'reconciliationStatus', { unique: false });
            }
            if (name === 'stock_transactions') {
              store.createIndex('itemId', 'itemId', { unique: false });
              store.createIndex('voucherId', 'voucherId', { unique: false });
            }
          }
        });
      };

      request.onsuccess = () => {
        const d = request.result;
        d.onversionchange = () => {
          try {
            d.close();
          } catch (e) {
            // ignore
          }
        };
        resolve(d);
      };
      request.onerror = () => reject(request.error);
    });

    await this.migrateLegacyDatasetDbIfNeeded(db, companyId, fiscalYearId);
    return db;
  }

  private async migrateLegacyDatasetDbIfNeeded(
    newDb: IDBDatabase,
    companyId: string,
    fiscalYearId: string
  ): Promise<void> {
    try {
      const hasVouchers = await new Promise<boolean>((resolve) => {
        try {
          const tx = newDb.transaction('vouchers', 'readonly');
          const countReq = tx.objectStore('vouchers').count();
          countReq.onsuccess = () => resolve(countReq.result > 0);
          countReq.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });

      if (hasVouchers) return;

      const legacyDbName = this.getLegacyDatasetDbName(companyId, fiscalYearId);
      const legacyDb = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(legacyDbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (!legacyDb) return;

      const storeNames = Array.from(legacyDb.objectStoreNames);
      for (const storeName of storeNames) {
        if (newDb.objectStoreNames.contains(storeName)) {
          const items = await new Promise<any[]>((resolve) => {
            try {
              const tx = legacyDb.transaction(storeName, 'readonly');
              const req = tx.objectStore(storeName).getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            } catch {
              resolve([]);
            }
          });

          if (items.length > 0) {
            const tx = newDb.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const item of items) {
              store.put(item);
            }
            await new Promise<void>((resolve) => {
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            });
          }
        }
      }
      legacyDb.close();
    } catch (err) {
      console.warn('Legacy dataset DB migration skipped:', err);
    }
  }

  // Helper to normalize and ensure FY XXXX-YYYY format
  public static formatFiscalYearName(startDate: string, endDate?: string, providedName?: string): string {
    const startYear = parseInt(startDate.split('-')[0], 10) || new Date().getFullYear();
    const endYear = endDate ? parseInt(endDate.split('-')[0], 10) : startYear + 1;
    
    // Check if provided name already matches FY XXXX-YYYY
    if (providedName && /^FY \d{4}-\d{4}$/.test(providedName.trim())) {
      return providedName.trim();
    }
    
    return `FY ${startYear}-${endYear}`;
  }

  // Initialize System with Defaults if empty
  public async initializeSystem(): Promise<{ currentCompany: Company; currentFiscalYear: FiscalYear | null }> {
    const globalDb = await this.openGlobalDb();
    const companies = await this.getAllFromStore<Company>(globalDb, 'companies');

    let company: Company;
    let fiscalYear: FiscalYear | null = null;

    if (companies.length === 0) {
      const defaults = createDefaultCompanyAndFiscalYear();
      company = defaults.company;
      fiscalYear = defaults.fiscalYear;

      await this.saveToStore(globalDb, 'companies', company);
      await this.saveToStore(globalDb, 'fiscal_years', fiscalYear);

      // Seed the isolated dataset for this initial company + FY
      await this.seedInitialDataset(company.id, fiscalYear.id);
    } else {
      company = companies[0];
      const sortedFYs = await this.getFiscalYears(company.id);
      fiscalYear = sortedFYs.length > 0 ? sortedFYs[0] : null;
    }

    this.activeCompanyId = company.id;
    this.activeFiscalYearId = fiscalYear ? fiscalYear.id : '';

    return { currentCompany: company, currentFiscalYear: fiscalYear };
  }

  private async seedInitialDataset(companyId: string, fiscalYearId: string) {
    const datasetDb = await this.openDatasetDb(companyId, fiscalYearId);

    const groups = getDefaultAccountGroups(companyId);
    const ledgers = getDefaultLedgers(companyId);
    const items = getDefaultInventoryItems(companyId);
    const units = DEFAULT_UNITS;

    const bankAccount: BankAccount = {
      id: 'bank-sbi-acc-01',
      companyId,
      ledgerId: 'led-sbi-bank',
      accountName: 'SBI Industrial Current A/C',
      accountNumber: '389201948201',
      bankName: 'State Bank of India',
      branch: 'Main Industrial Area',
      ifsc: 'SBIN0001234',
      openingBalance: 250000,
      openingDate: '2026-04-01',
    };

    const initialAudit: AuditLog = {
      id: 'audit-init-01',
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      date: new Date().toISOString(),
      action: 'CREATE',
      entity: 'COMPANY_INIT',
      entityId: companyId,
      summary: 'Company and Fiscal Year Initialized with Standard Chart of Accounts',
      deviceId: 'BROWSER-LOCAL-01',
      createdAt: new Date().toISOString(),
    };

    // Save defaults
    for (const g of groups) await this.saveToStore(datasetDb, 'account_groups', g);
    for (const l of ledgers) await this.saveToStore(datasetDb, 'ledgers', l);
    for (const itm of items) await this.saveToStore(datasetDb, 'inventory_items', itm);
    for (const u of units) await this.saveToStore(datasetDb, 'units', u);
    await this.saveToStore(datasetDb, 'bank_accounts', bankAccount);
    await this.saveToStore(datasetDb, 'audit_logs', initialAudit);

    // Create a realistic initial sales voucher and purchase voucher to show double-entry live
    const now = '2026-04-10';
    const salesVoucher: Voucher = {
      id: 'vch-sales-001',
      uuid: uuidv4(),
      voucherNumber: 'SAL/26-27/001',
      voucherType: 'SALES',
      date: now,
      companyId,
      fiscalYearId,
      narration: 'Sold 500 SQFT Kota Stone Blue 22x22 to Rajasthan Marble',
      referenceNo: 'INV-001',
      lines: [
        {
          id: uuidv4(),
          uuid: uuidv4(),
          ledgerId: 'led-cust-rajasthan',
          ledgerName: 'Rajasthan Marble & Builders',
          type: 'DR',
          amount: 14000,
          narration: 'Customer Debited',
        },
        {
          id: uuidv4(),
          uuid: uuidv4(),
          ledgerId: 'led-sales',
          ledgerName: 'General Sales Account',
          type: 'CR',
          amount: 14000,
          narration: 'Sales Credited',
        },
      ],
      inventoryLines: [
        {
          id: uuidv4(),
          itemId: 'item-kota-stone-blue',
          itemName: 'Kota Stone Blue 22x22 (Hand Cut)',
          itemCode: 'KS-BLU-22',
          quantity: 500,
          unit: 'SQFT',
          rate: 28,
          amount: 14000,
          alternateQty: 148.8,
          alternateUnit: 'PCS',
        },
      ],
      totalDebit: 14000,
      totalCredit: 14000,
      status: 'POSTED',
      deviceId: 'BROWSER-LOCAL-01',
      syncStatus: 'SYNCED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const receiptVoucher: Voucher = {
      id: 'vch-rcpt-001',
      uuid: uuidv4(),
      voucherNumber: 'RCT/26-27/001',
      voucherType: 'RECEIPT',
      date: '2026-04-15',
      companyId,
      fiscalYearId,
      narration: 'Received part payment by NEFT from Rajasthan Marble & Builders',
      referenceNo: 'NEFT-928174',
      lines: [
        {
          id: uuidv4(),
          uuid: uuidv4(),
          ledgerId: 'led-sbi-bank',
          ledgerName: 'State Bank of India (Current A/C)',
          type: 'DR',
          amount: 10000,
        },
        {
          id: uuidv4(),
          uuid: uuidv4(),
          ledgerId: 'led-cust-rajasthan',
          ledgerName: 'Rajasthan Marble & Builders',
          type: 'CR',
          amount: 10000,
        },
      ],
      totalDebit: 10000,
      totalCredit: 10000,
      status: 'POSTED',
      deviceId: 'BROWSER-LOCAL-01',
      syncStatus: 'SYNCED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const stockTx: StockTransaction = {
      id: uuidv4(),
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      date: now,
      itemId: 'item-kota-stone-blue',
      voucherId: salesVoucher.id,
      voucherNo: salesVoucher.voucherNumber,
      voucherType: 'SALES',
      transactionType: 'OUT',
      quantity: 500,
      unit: 'SQFT',
      rate: 24, // cost rate
      value: 12000,
      remarks: 'Sold to Rajasthan Marble & Builders',
      createdAt: new Date().toISOString(),
    };

    await this.saveToStore(datasetDb, 'vouchers', salesVoucher);
    await this.saveToStore(datasetDb, 'vouchers', receiptVoucher);
    await this.saveToStore(datasetDb, 'stock_transactions', stockTx);

    // Initial Demo Stock Journal Entry (Manufacturing / Conversion)
    const seedStockJournal: StockJournalEntry = {
      id: 'stkj-init-001',
      uuid: uuidv4(),
      voucherNo: 'STKJ/26-27/001',
      date: '2026-04-18',
      companyId,
      fiscalYearId,
      journalType: 'MANUFACTURING',
      narration: 'Batch Cutting & Polishing from Blue Rough Slabs to Finished Polish Slabs',
      referenceNo: 'BATCH-26-01',
      sourceItems: [
        {
          id: uuidv4(),
          itemId: 'item-kota-stone-blue',
          itemCode: 'KS-BLU-22',
          itemName: 'Kota Stone Blue 22x22 (Hand Cut)',
          quantity: 300,
          unit: 'SQFT',
          rate: 24,
          amount: 7200,
          godown: 'Raw Material Yard',
        },
      ],
      destinationItems: [
        {
          id: uuidv4(),
          itemId: 'item-kota-stone-brown',
          itemCode: 'KS-BRN-24',
          itemName: 'Kota Stone Brown Polish 2x2',
          quantity: 280,
          unit: 'SQFT',
          rate: 28.57,
          amount: 8000,
          godown: 'Finished Store',
        },
      ],
      additionalCost: 800,
      totalSourceQty: 300,
      totalSourceAmount: 7200,
      totalDestinationQty: 280,
      totalDestinationAmount: 8000,
      status: 'POSTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sjSourceTx: StockTransaction = {
      id: uuidv4(),
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      date: '2026-04-18',
      itemId: 'item-kota-stone-blue',
      voucherId: seedStockJournal.id,
      voucherNo: seedStockJournal.voucherNo,
      voucherType: 'CONVERSION',
      transactionType: 'OUT',
      quantity: 300,
      unit: 'SQFT',
      rate: 24,
      value: 7200,
      remarks: 'Batch Cutting & Polishing (Issue - Raw Material Yard)',
      createdAt: new Date().toISOString(),
    };

    const sjDestTx: StockTransaction = {
      id: uuidv4(),
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      date: '2026-04-18',
      itemId: 'item-kota-stone-brown',
      voucherId: seedStockJournal.id,
      voucherNo: seedStockJournal.voucherNo,
      voucherType: 'CONVERSION',
      transactionType: 'IN',
      quantity: 280,
      unit: 'SQFT',
      rate: 28.57,
      value: 8000,
      remarks: 'Batch Cutting & Polishing (Receipt - Finished Store)',
      createdAt: new Date().toISOString(),
    };

    await this.saveToStore(datasetDb, 'stock_journals', seedStockJournal);
    await this.saveToStore(datasetDb, 'stock_transactions', sjSourceTx);
    await this.saveToStore(datasetDb, 'stock_transactions', sjDestTx);

    // Initial bank statement sample transactions
    const bankTx1: BankStatementTransaction = {
      id: 'bnk-tx-001',
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId: bankAccount.id,
      date: '2026-04-15',
      narration: 'NEFT CR-RAJASTHAN MARBLE-NEFT928174',
      referenceNo: 'NEFT-928174',
      type: 'CREDIT',
      amount: 10000,
      balance: 260000,
      reconciliationStatus: 'MATCHED',
      matchedVoucherId: receiptVoucher.id,
      matchedDate: '2026-04-15',
      matchScore: 100,
      createdAt: new Date().toISOString(),
    };

    const bankTx2: BankStatementTransaction = {
      id: 'bnk-tx-002',
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId: bankAccount.id,
      date: '2026-04-20',
      narration: 'CHQ WDL - DINESH AGARWAL SUPPLIER',
      referenceNo: 'CHQ-819201',
      type: 'DEBIT',
      amount: 25000,
      balance: 235000,
      reconciliationStatus: 'UNMATCHED',
      createdAt: new Date().toISOString(),
    };

    const bankTx3: BankStatementTransaction = {
      id: 'bnk-tx-003',
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId: bankAccount.id,
      date: '2026-04-22',
      narration: 'ELEC BILL AUTO DEBIT DISCOM KOTA',
      referenceNo: 'EB-202604',
      type: 'DEBIT',
      amount: 4850,
      balance: 230150,
      reconciliationStatus: 'UNMATCHED',
      createdAt: new Date().toISOString(),
    };

    await this.saveToStore(datasetDb, 'bank_transactions', bankTx1);
    await this.saveToStore(datasetDb, 'bank_transactions', bankTx2);
    await this.saveToStore(datasetDb, 'bank_transactions', bankTx3);
  }

  // Set Active Workspace Context
  public setActiveContext(companyId: string, fiscalYearId: string) {
    this.activeCompanyId = companyId;
    this.activeFiscalYearId = fiscalYearId;
  }

  public getActiveContext() {
    return { companyId: this.activeCompanyId, fiscalYearId: this.activeFiscalYearId };
  }

  public async switchDataset(companyId: string, fiscalYearId: string): Promise<void> {
    this.activeCompanyId = companyId;
    this.activeFiscalYearId = fiscalYearId;
  }

  // --- CRUD for Global Entities ---
  public async getCompanies(): Promise<Company[]> {
    const db = await this.openGlobalDb();
    return this.getAllFromStore<Company>(db, 'companies');
  }

  public async saveCompany(company: Company): Promise<void> {
    const db = await this.openGlobalDb();
    await this.saveToStore(db, 'companies', company);
  }

  public async deleteCompany(companyId: string): Promise<void> {
    const db = await this.openGlobalDb();
    const companies = await this.getAllFromStore<Company>(db, 'companies');
    if (companies.length <= 1) {
      throw new Error('Cannot delete the only remaining company in the system.');
    }

    // Delete associated fiscal years and their databases
    const allFys = await this.getAllFromStore<FiscalYear>(db, 'fiscal_years');
    const compFys = allFys.filter((f) => f.companyId === companyId);
    for (const fy of compFys) {
      try {
        await this.deleteFromStore(db, 'fiscal_years', fy.id);
        const dbName = this.getDatasetDbName(companyId, fy.id);
        indexedDB.deleteDatabase(dbName);
      } catch (err) {
        console.warn('Error deleting FY/DB for company:', err);
      }
    }

    // Delete company record from global store
    await this.deleteFromStore(db, 'companies', companyId);
  }

  public async deduplicateFiscalYears(companyId: string): Promise<FiscalYear[]> {
    const db = await this.openGlobalDb();
    const all = await this.getAllFromStore<FiscalYear>(db, 'fiscal_years');
    const companyFYs = all.filter((fy) => fy.companyId === companyId || !fy.companyId);

    const seenNames = new Set<string>();
    const seenDates = new Set<string>();
    const uniqueFYs: FiscalYear[] = [];
    const idsToDelete: string[] = [];

    for (const fy of companyFYs) {
      // Normalize name
      const formatted = IsolatedStorageService.formatFiscalYearName(fy.startDate, fy.endDate, fy.name);
      const nameKey = formatted.trim().toUpperCase();
      const dateKey = `${fy.startDate}_${fy.endDate}`;

      if (seenNames.has(nameKey) || seenDates.has(dateKey)) {
        // This is a duplicate! Mark for removal from database
        idsToDelete.push(fy.id);
      } else {
        seenNames.add(nameKey);
        seenDates.add(dateKey);
        if (fy.name !== formatted || !fy.companyId) {
          fy.name = formatted;
          fy.companyId = companyId;
          await this.saveToStore(db, 'fiscal_years', fy);
        }
        uniqueFYs.push(fy);
      }
    }

    // Clean up duplicate records from IndexedDB
    for (const id of idsToDelete) {
      try {
        await this.deleteFromStore(db, 'fiscal_years', id);
        console.info(`[Auto-Deduplicate] Removed duplicate fiscal year ID: ${id}`);
      } catch (err) {
        console.warn('Failed to delete duplicate FY record:', err);
      }
    }

    // Sort in Descending order (latest Financial Year first, e.g. FY 2026-2027 before FY 2025-2026)
    uniqueFYs.sort((a, b) => {
      const dateDiff = (b.startDate || '').localeCompare(a.startDate || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.name || '').localeCompare(a.name || '');
    });

    return uniqueFYs;
  }

  public async getFiscalYears(companyId: string): Promise<FiscalYear[]> {
    return this.deduplicateFiscalYears(companyId);
  }

  public async createFiscalYear(fy: FiscalYear): Promise<void> {
    return this.saveFiscalYear(fy);
  }

  public async saveFiscalYear(fy: FiscalYear): Promise<void> {
    // Format name strictly to FY XXXX-YYYY
    fy.name = IsolatedStorageService.formatFiscalYearName(fy.startDate, fy.endDate, fy.name);

    // Duplicate check for the company
    const existingFYs = await this.getFiscalYears(fy.companyId);
    const duplicate = existingFYs.find(
      (e) => e.id !== fy.id && (e.name.trim().toUpperCase() === fy.name.trim().toUpperCase() || (e.startDate === fy.startDate && e.endDate === fy.endDate))
    );

    if (duplicate) {
      throw new Error(`DUPLICATE FINANCIAL YEAR: "${fy.name}" already exists for this company. Duplicate financial years are strictly blocked.`);
    }

    const db = await this.openGlobalDb();
    await this.saveToStore(db, 'fiscal_years', fy);

    // If new dataset, initialize seed
    const datasetDb = await this.openDatasetDb(fy.companyId, fy.id);
    const existingGroups = await this.getAllFromStore<AccountGroup>(datasetDb, 'account_groups');
    if (existingGroups.length === 0) {
      const groups = getDefaultAccountGroups(fy.companyId);
      const ledgers = getDefaultLedgers(fy.companyId);
      const items = getDefaultInventoryItems(fy.companyId);
      for (const g of groups) await this.saveToStore(datasetDb, 'account_groups', g);
      for (const l of ledgers) await this.saveToStore(datasetDb, 'ledgers', l);
      for (const itm of items) await this.saveToStore(datasetDb, 'inventory_items', itm);
      for (const u of DEFAULT_UNITS) await this.saveToStore(datasetDb, 'units', u);
    }
  }

  public async updateFiscalYear(fy: FiscalYear): Promise<void> {
    fy.name = IsolatedStorageService.formatFiscalYearName(fy.startDate, fy.endDate, fy.name);
    const existingFYs = await this.getFiscalYears(fy.companyId);
    const duplicate = existingFYs.find(
      (e) => e.id !== fy.id && (e.name.trim().toUpperCase() === fy.name.trim().toUpperCase() || (e.startDate === fy.startDate && e.endDate === fy.endDate))
    );
    if (duplicate) {
      throw new Error(`Another financial year already exists with the name "${fy.name}" or the same period.`);
    }
    const db = await this.openGlobalDb();
    await this.saveToStore(db, 'fiscal_years', fy);
  }

  public async deleteFiscalYear(
    id: string,
    companyId: string,
    name?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const db = await this.openGlobalDb();
    if (!db.objectStoreNames.contains('fiscal_years')) {
      return;
    }

    const matchedKeys = new Set<string>();
    if (id) {
      matchedKeys.add(id);
    }

    const normTargetName = (name || '').trim().toUpperCase();

    // 1. First scan all records using readonly access to locate all primary keys matching id, uuid, name, or dates
    try {
      const allRecords = await this.getAllFromStore<FiscalYear>(db, 'fiscal_years');
      for (const record of allRecords) {
        const recordId = String(record?.id || '');
        const recordUuid = String(record?.uuid || '');
        const recordName = (record?.name || '').trim().toUpperCase();
        const recordCompId = String(record?.companyId || '');

        const isIdMatch = Boolean(id && (recordId === id || recordUuid === id));
        const isNameMatch =
          Boolean(normTargetName) &&
          recordName === normTargetName &&
          (recordCompId === companyId || !recordCompId || !companyId);
        const isDateMatch =
          Boolean(startDate && endDate) &&
          record?.startDate === startDate &&
          record?.endDate === endDate &&
          (recordCompId === companyId || !recordCompId || !companyId);

        if (isIdMatch || isNameMatch || isDateMatch) {
          if (recordId) matchedKeys.add(recordId);
          if (recordUuid) matchedKeys.add(recordUuid);
        }
      }
    } catch (scanErr) {
      console.warn('[Storage] Scan fiscal_years notice:', scanErr);
    }

    // 2. Perform deletion in readwrite transaction using store.delete(key)
    // store.delete(key) does not conflict with cursors and will NOT trigger transaction aborts
    if (matchedKeys.size > 0) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(['fiscal_years'], 'readwrite');
          const store = tx.objectStore('fiscal_years');

          for (const key of matchedKeys) {
            try {
              store.delete(key);
            } catch (delErr) {
              console.warn('[Storage] store.delete warning:', key, delErr);
            }
          }

          tx.oncomplete = () => {
            console.info('[Storage] Successfully deleted fiscal year keys from IndexedDB:', Array.from(matchedKeys));
            resolve();
          };
          tx.onerror = () => reject(tx.error || new Error('Transaction failed to delete fiscal year'));
          tx.onabort = () => reject(tx.error || new Error('Delete fiscal year transaction aborted'));
        } catch (err) {
          reject(err);
        }
      });
    }

    // 3. Clean up dataset DBs asynchronously without blocking execution
    const allIdsToClean = Array.from(matchedKeys);
    for (const fyId of allIdsToClean) {
      if (!fyId) continue;
      try {
        const dbName = this.getDatasetDbName(companyId, fyId);
        setTimeout(() => {
          try {
            const delReq = indexedDB.deleteDatabase(dbName);
            delReq.onerror = () => console.warn('Could not delete dataset DB:', dbName);
          } catch (e) {
            console.warn('Dataset DB async delete notice:', e);
          }
        }, 50);
      } catch (e) {
        console.warn('Dataset DB deletion notice:', e);
      }
    }
  }

  // --- CRUD for Dataset-Isolated Entities ---
  private async getDatasetStore<T>(storeName: string): Promise<T[]> {
    if (!this.activeCompanyId || !this.activeFiscalYearId) {
      return [];
    }
    const db = await this.openDatasetDb(this.activeCompanyId, this.activeFiscalYearId);
    return this.getAllFromStore<T>(db, storeName);
  }

  private async saveDatasetRecord<T extends { id: string }>(storeName: string, record: T): Promise<void> {
    if (!this.activeCompanyId || !this.activeFiscalYearId) {
      throw new Error('No active company and fiscal year context.');
    }
    const db = await this.openDatasetDb(this.activeCompanyId, this.activeFiscalYearId);
    await this.saveToStore(db, storeName, record);
  }

  private async deleteDatasetRecord(storeName: string, id: string): Promise<void> {
    if (!this.activeCompanyId || !this.activeFiscalYearId) {
      throw new Error('No active company and fiscal year context.');
    }
    const db = await this.openDatasetDb(this.activeCompanyId, this.activeFiscalYearId);
    await this.deleteFromStore(db, storeName, id);
  }

  // Account Groups
  public async getAccountGroups(): Promise<AccountGroup[]> {
    return this.getDatasetStore<AccountGroup>('account_groups');
  }

  public async saveAccountGroup(group: AccountGroup): Promise<void> {
    await this.saveDatasetRecord('account_groups', group);
  }

  public async deleteAccountGroup(id: string): Promise<void> {
    await this.deleteDatasetRecord('account_groups', id);
  }

  // Ledgers
  public async getLedgers(): Promise<Ledger[]> {
    return this.getDatasetStore<Ledger>('ledgers');
  }

  public async saveLedger(ledger: Ledger): Promise<void> {
    await this.saveDatasetRecord('ledgers', ledger);
  }

  public async deleteLedger(id: string): Promise<void> {
    await this.deleteDatasetRecord('ledgers', id);
  }

  // Vouchers
  public async getVouchers(): Promise<Voucher[]> {
    return this.getDatasetStore<Voucher>('vouchers');
  }

  public async saveVoucher(voucher: Voucher): Promise<void> {
    await this.saveDatasetRecord('vouchers', voucher);
  }

  public async deleteVoucher(id: string): Promise<void> {
    await this.deleteDatasetRecord('vouchers', id);
  }

  // Inventory Items
  public async getInventoryItems(): Promise<InventoryItem[]> {
    return this.getDatasetStore<InventoryItem>('inventory_items');
  }

  public async saveInventoryItem(item: InventoryItem): Promise<void> {
    await this.saveDatasetRecord('inventory_items', item);
  }

  public async deleteInventoryItem(id: string): Promise<void> {
    await this.deleteDatasetRecord('inventory_items', id);
  }

  // Item Units
  public async getItemUnits(): Promise<ItemUnit[]> {
    const units = await this.getDatasetStore<ItemUnit>('units');
    return units.length > 0 ? units : DEFAULT_UNITS;
  }

  public async saveItemUnit(unit: ItemUnit): Promise<void> {
    await this.saveDatasetRecord('units', unit);
  }

  // Stock Transactions
  public async getStockTransactions(): Promise<StockTransaction[]> {
    return this.getDatasetStore<StockTransaction>('stock_transactions');
  }

  public async saveStockTransaction(tx: StockTransaction): Promise<void> {
    await this.saveDatasetRecord('stock_transactions', tx);
  }

  public async deleteStockTransactionsForVoucher(voucherId: string): Promise<void> {
    const txs = await this.getStockTransactions();
    const toDelete = txs.filter((t) => t.voucherId === voucherId);
    for (const t of toDelete) {
      await this.deleteDatasetRecord('stock_transactions', t.id);
    }
  }

  // Stock Journals (Manufacturing, Conversion & Inter-Location Transfers)
  public async getStockJournals(): Promise<StockJournalEntry[]> {
    return this.getDatasetStore<StockJournalEntry>('stock_journals');
  }

  public async saveStockJournal(journal: StockJournalEntry): Promise<void> {
    await this.saveDatasetRecord('stock_journals', journal);
  }

  public async deleteStockJournal(id: string): Promise<void> {
    await this.deleteDatasetRecord('stock_journals', id);
  }

  // Wastage Entries
  public async getWastageEntries(): Promise<WastageEntry[]> {
    return this.getDatasetStore<WastageEntry>('wastage_entries');
  }

  public async saveWastageEntry(entry: WastageEntry): Promise<void> {
    await this.saveDatasetRecord('wastage_entries', entry);
  }

  public async deleteWastageEntry(id: string): Promise<void> {
    await this.deleteDatasetRecord('wastage_entries', id);
  }

  // Bank Accounts
  public async getBankAccounts(): Promise<BankAccount[]> {
    return this.getDatasetStore<BankAccount>('bank_accounts');
  }

  public async saveBankAccount(acc: BankAccount): Promise<void> {
    await this.saveDatasetRecord('bank_accounts', acc);
  }

  public async deleteBankAccount(id: string): Promise<void> {
    await this.deleteDatasetRecord('bank_accounts', id);
  }

  // Bank Transactions (Statement Imported Lines)
  public async getBankTransactions(): Promise<BankStatementTransaction[]> {
    return this.getDatasetStore<BankStatementTransaction>('bank_transactions');
  }

  public async getBankStatements(bankAccountId?: string): Promise<BankStatementTransaction[]> {
    const all = await this.getBankTransactions();
    return bankAccountId ? all.filter((t) => t.bankAccountId === bankAccountId) : all;
  }

  public async saveBankTransaction(tx: BankStatementTransaction): Promise<void> {
    await this.saveDatasetRecord('bank_transactions', tx);
  }

  public async deleteBankTransaction(id: string): Promise<void> {
    await this.deleteDatasetRecord('bank_transactions', id);
  }

  // Wastage Records
  public async getWastageRecords(): Promise<WastageEntry[]> {
    return this.getWastageEntries();
  }

  // Locations / Godowns (Location Master)
  public async getLocations(targetCompanyId?: string): Promise<Location[]> {
    const compId = targetCompanyId || this.activeCompanyId;
    if (!compId) return [];

    const localKey = `bahi_khata_locations_${compId}`;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clean any legacy Hindi characters in location names or notes
          const cleaned = parsed.map((loc: Location) => ({
            ...loc,
            name: loc.name
              ? loc.name.replace(/\s*\([\u0900-\u097F\s/]+\)/g, '').replace(/[\u0900-\u097F]+/g, '').trim()
              : loc.name,
          }));
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Error reading locations from storage:', e);
    }

    const defaults = getDefaultLocations(compId);
    try {
      localStorage.setItem(localKey, JSON.stringify(defaults));
    } catch (e) {}

    return defaults;
  }

  public async saveLocation(loc: Location): Promise<void> {
    const compId = loc.companyId || this.activeCompanyId;
    if (!compId) return;

    const locations = await this.getLocations(compId);

    let updated: Location[];
    if (loc.isDefault) {
      updated = locations.map((item) => (item.id === loc.id ? loc : { ...item, isDefault: false }));
      if (!updated.some((item) => item.id === loc.id)) {
        updated.push(loc);
      }
    } else {
      const idx = locations.findIndex((item) => item.id === loc.id);
      if (idx >= 0) {
        updated = [...locations];
        updated[idx] = loc;
      } else {
        updated = [...locations, loc];
      }
      if (!updated.some((item) => item.isDefault) && updated.length > 0) {
        updated[0].isDefault = true;
      }
    }

    const localKey = `bahi_khata_locations_${compId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    await this.logAudit(
      'EDIT',
      'LOCATION',
      loc.id,
      `Location "${loc.name}" (${loc.code}) updated/created`
    );
  }

  public async deleteLocation(id: string, compId?: string): Promise<void> {
    const targetCompId = compId || this.activeCompanyId;
    if (!targetCompId) return;

    const locations = await this.getLocations(targetCompId);
    const target = locations.find((l) => l.id === id);
    if (target?.isDefault && locations.length > 1) {
      throw new Error('Cannot delete default primary godown. Please set another location as default first.');
    }

    const filtered = locations.filter((l) => l.id !== id);
    if (filtered.length > 0 && !filtered.some((l) => l.isDefault)) {
      filtered[0].isDefault = true;
    }

    const localKey = `bahi_khata_locations_${targetCompId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(filtered));
    } catch (e) {}

    await this.logAudit('CANCEL', 'LOCATION', id, `Location deleted: ${target?.name || id}`);
  }

  public async getDefaultLocation(compId?: string): Promise<Location | null> {
    const locs = await this.getLocations(compId);
    const active = locs.filter((l) => l.isActive);
    return active.find((l) => l.isDefault) || active[0] || locs[0] || null;
  }

  public async createCompany(company: Company): Promise<void> {
    await this.saveCompany(company);
  }

  // Sync Queue
  public async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.getDatasetStore<SyncQueueItem>('sync_queue');
  }

  public async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    await this.saveDatasetRecord('sync_queue', item);
  }

  public async removeSyncQueueItem(id: string): Promise<void> {
    await this.deleteDatasetRecord('sync_queue', id);
  }

  public async clearSyncedQueueItems(): Promise<void> {
    const items = await this.getSyncQueue();
    const synced = items.filter((i) => i.status === 'SYNCED');
    for (const item of synced) {
      await this.removeSyncQueueItem(item.id);
    }
  }

  // Audit Logs
  public async getAuditLogs(): Promise<AuditLog[]> {
    return this.getDatasetStore<AuditLog>('audit_logs');
  }

  public async logAudit(
    action: AuditLog['action'],
    entity: string,
    entityId: string,
    summary: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    if (!this.activeCompanyId || !this.activeFiscalYearId) {
      return;
    }
    try {
      const entry: AuditLog = {
        id: uuidv4(),
        uuid: uuidv4(),
        companyId: this.activeCompanyId,
        fiscalYearId: this.activeFiscalYearId,
        date: new Date().toISOString(),
        action,
        entity,
        entityId,
        summary,
        oldValue,
        newValue,
        deviceId: 'BROWSER-LOCAL-01',
        createdAt: new Date().toISOString(),
      };
      await this.saveDatasetRecord('audit_logs', entry);
    } catch (e) {
      console.warn('Failed to save audit log entry:', e);
    }
  }

  // --- Complete Dataset Export for Offline Backup & Cloud Sync ---
  public async exportCurrentDataset(): Promise<CompanyDataset | null> {
    if (!this.activeCompanyId || !this.activeFiscalYearId) return null;

    const companies = await this.getCompanies();
    const currentComp = companies.find((c) => c.id === this.activeCompanyId);
    const fys = await this.getFiscalYears(this.activeCompanyId);
    const currentFY = fys.find((f) => f.id === this.activeFiscalYearId);

    if (!currentComp || !currentFY) return null;

    const [
      accountGroups,
      ledgers,
      vouchers,
      items,
      units,
      stockTransactions,
      stockJournals,
      wastageEntries,
      bankAccounts,
      bankTransactions,
      syncQueue,
      auditLogs,
    ] = await Promise.all([
      this.getAccountGroups(),
      this.getLedgers(),
      this.getVouchers(),
      this.getInventoryItems(),
      this.getItemUnits(),
      this.getStockTransactions(),
      this.getStockJournals(),
      this.getWastageEntries(),
      this.getBankAccounts(),
      this.getBankTransactions(),
      this.getSyncQueue(),
      this.getAuditLogs(),
    ]);

    return {
      company: currentComp,
      fiscalYear: currentFY,
      accountGroups,
      ledgers,
      vouchers,
      items,
      units,
      conversions: [],
      stockTransactions,
      stockJournals,
      wastageEntries,
      bankAccounts,
      bankTransactions,
      syncQueue,
      auditLogs,
    };
  }

  // Restore dataset
  public async importDataset(dataset: CompanyDataset): Promise<void> {
    // Save company and FY in global
    await this.saveCompany(dataset.company);
    await this.saveFiscalYear(dataset.fiscalYear);

    const db = await this.openDatasetDb(dataset.company.id, dataset.fiscalYear.id);

    // Populate all entities
    for (const g of dataset.accountGroups) await this.saveToStore(db, 'account_groups', g);
    for (const l of dataset.ledgers) await this.saveToStore(db, 'ledgers', l);
    for (const v of dataset.vouchers) await this.saveToStore(db, 'vouchers', v);
    for (const i of dataset.items) await this.saveToStore(db, 'inventory_items', i);
    for (const u of dataset.units) await this.saveToStore(db, 'units', u);
    for (const st of dataset.stockTransactions) await this.saveToStore(db, 'stock_transactions', st);
    if (dataset.stockJournals) {
      for (const sj of dataset.stockJournals) await this.saveToStore(db, 'stock_journals', sj);
    }
    for (const w of dataset.wastageEntries) await this.saveToStore(db, 'wastage_entries', w);
    for (const b of dataset.bankAccounts) await this.saveToStore(db, 'bank_accounts', b);
    for (const bt of dataset.bankTransactions) await this.saveToStore(db, 'bank_transactions', bt);
    for (const a of dataset.auditLogs) await this.saveToStore(db, 'audit_logs', a);
  }

  // Helper IDB operations
  private async getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    if (!db.objectStoreNames.contains(storeName)) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => {
          console.warn(`[Storage] Failed to read store ${storeName}:`, e);
          resolve([]);
        };
      } catch (err) {
        console.warn(`[Storage] Store ${storeName} read exception:`, err);
        resolve([]);
      }
    });
  }

  private async saveToStore<T>(db: IDBDatabase, storeName: string, item: T): Promise<void> {
    if (!db.objectStoreNames.contains(storeName)) {
      console.warn(`[Storage] Object store ${storeName} not found in DB`);
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(item);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      } catch (err) {
        reject(err);
      }
    });
  }

  private async deleteFromStore(db: IDBDatabase, storeName: string, key: string): Promise<void> {
    if (!db.objectStoreNames.contains(storeName)) {
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const dbStorage = new IsolatedStorageService();
