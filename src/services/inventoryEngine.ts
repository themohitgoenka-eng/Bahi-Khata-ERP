import {
  InventoryItem,
  StockTransaction,
  StockJournalEntry,
  StockJournalItem,
  StockJournalType,
  WastageEntry,
  SyncQueueItem,
} from '../types';
import { dbStorage } from './storage/indexedDbStorage';
import { v4 as uuidv4 } from 'uuid';

export interface ItemStockSummary {
  item: InventoryItem;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  inQty: number;
  inwardQty: number;
  outQty: number;
  outwardQty: number;
  wastageQty: number;
  closingQty: number;
  valuationRate: number;
  closingValue: number;
  alternateClosingQty?: number;
  closingAltQty?: number;
  status: 'OPTIMAL' | 'LOW_STOCK' | 'OVER_STOCK' | 'OUT_OF_STOCK' | 'NORMAL';
}

export interface StockLedgerRow {
  id: string;
  date: string;
  voucherNo: string;
  voucherType: string;
  particulars: string;
  transactionType: 'IN' | 'OUT' | 'WASTAGE';
  movementType?: 'INWARD' | 'OUTWARD' | 'WASTAGE' | string;
  inQty: number;
  inwardQty: number;
  outQty: number;
  outwardQty: number;
  wastageQty: number;
  rate: number;
  value: number;
  runningQty: number;
  runningBalance: number;
  godown?: string;
  locationId?: string;
  remarks?: string;
}

export type ItemStockMovement = StockLedgerRow;

export interface WastageAnalysisItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  totalProductionOrIn: number;
  totalWastageQty: number;
  totalWastageValue: number;
  wastagePercentage: number;
  breakageCount: number;
  edgeCrackCount: number;
  cuttingLossCount: number;
  defectCount: number;
}

export class InventoryEngine {
  // 1. Multi-unit conversion
  public convertUnits(
    quantity: number,
    fromUnit: 'PRIMARY' | 'ALTERNATE',
    conversionFactor: number,
    conversionDirection?: 'PRIMARY_TO_ALT' | 'ALT_TO_PRIMARY'
  ): number {
    if (!conversionFactor || conversionFactor <= 0) return quantity;
    const isPrimaryToAlt = conversionDirection
      ? conversionDirection === 'PRIMARY_TO_ALT'
      : conversionFactor < 1;

    if (fromUnit === 'PRIMARY') {
      // Primary to Alternate:
      // If 1 Primary = factor Alt (e.g. 1 SQFT = 0.25 PCS): Alt = Primary * factor
      // If 1 Alt = factor Primary (e.g. 1 PCS = 4 SQFT): Alt = Primary / factor
      return isPrimaryToAlt
        ? Math.round((quantity * conversionFactor) * 100) / 100
        : Math.round((quantity / conversionFactor) * 100) / 100;
    } else {
      // Alternate to Primary:
      // If 1 Primary = factor Alt (e.g. 1 SQFT = 0.25 PCS): Primary = Alt / factor (e.g. 100 PCS / 0.25 = 400 SQFT)
      // If 1 Alt = factor Primary (e.g. 1 PCS = 4 SQFT): Primary = Alt * factor (e.g. 100 PCS * 4 = 400 SQFT)
      return isPrimaryToAlt
        ? Math.round((quantity / conversionFactor) * 100) / 100
        : Math.round((quantity * conversionFactor) * 100) / 100;
    }
  }

  // 2. Get Stock Summary for all items
  public async getStockSummary(asOfDate?: string): Promise<ItemStockSummary[]> {
    const items = await dbStorage.getInventoryItems();
    const transactions = await dbStorage.getStockTransactions();
    const wastageEntries = await dbStorage.getWastageEntries();

    const summaries: ItemStockSummary[] = [];

    for (const item of items) {
      const activeTxs = transactions.filter(
        (t) => t.itemId === item.id && (!asOfDate || t.date <= asOfDate)
      );
      const activeWastage = wastageEntries.filter(
        (w) => w.itemId === item.id && (!asOfDate || w.date <= asOfDate)
      );

      const inQty = activeTxs.filter((t) => t.transactionType === 'IN').reduce((s, t) => s + t.quantity, 0);
      const outQty = activeTxs.filter((t) => t.transactionType === 'OUT').reduce((s, t) => s + t.quantity, 0);
      const wastageQty = activeWastage.reduce((s, w) => s + w.quantity, 0);

      const closingQty = (item.openingQty || 0) + inQty - outQty - wastageQty;
      const rate = item.openingRate || 0;
      const closingValue = Math.round(closingQty * rate * 100) / 100;

      let status: ItemStockSummary['status'] = 'OPTIMAL';
      if (closingQty <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (item.minStock && closingQty <= item.minStock) {
        status = 'LOW_STOCK';
      } else if (item.maxStock && closingQty > item.maxStock) {
        status = 'OVER_STOCK';
      }

      let alternateClosingQty: number | undefined;
      if (item.conversionFactor && item.conversionFactor > 0) {
        alternateClosingQty = this.convertUnits(closingQty, 'PRIMARY', item.conversionFactor, item.conversionDirection);
      }

      summaries.push({
        item,
        openingQty: item.openingQty || 0,
        openingRate: item.openingRate || 0,
        openingValue: item.openingValue || 0,
        inQty,
        inwardQty: inQty,
        outQty,
        outwardQty: outQty,
        wastageQty,
        closingQty,
        valuationRate: rate,
        closingValue,
        alternateClosingQty,
        closingAltQty: alternateClosingQty,
        status: status === 'OPTIMAL' ? 'NORMAL' : status,
      });
    }

    return summaries.sort((a, b) => (a.item.category || '').localeCompare(b.item.category || '') || a.item.name.localeCompare(b.item.name));
  }

  // 3. Get Stock Ledger for a specific item
  public async getStockLedger(itemId: string, fromDate?: string, toDate?: string): Promise<StockLedgerRow[]> {
    const items = await dbStorage.getInventoryItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) return [];

    const allTxs = await dbStorage.getStockTransactions();
    const allWastage = await dbStorage.getWastageEntries();

    const itemTxs = allTxs.filter((t) => t.itemId === itemId);
    const itemWastage = allWastage.filter((w) => w.itemId === itemId);

    // Combine transactions and wastage chronologically
    type UnifiedEvent = {
      id: string;
      date: string;
      voucherNo: string;
      voucherType: string;
      particulars: string;
      type: 'IN' | 'OUT' | 'WASTAGE';
      qty: number;
      rate: number;
      value: number;
      godown?: string;
      locationId?: string;
      remarks?: string;
    };

    const events: UnifiedEvent[] = [];

    itemTxs.forEach((t) => {
      let particulars = t.transactionType === 'IN' ? `Purchase / Inward Stock` : `Sales / Outward Dispatch`;
      if (t.voucherType === 'CONVERSION' || t.voucherType === 'STOCK_JOURNAL') {
        particulars = t.transactionType === 'IN' ? `Stock Journal (Production / Inward)` : `Stock Journal (Consumption / Outward)`;
      } else if (t.voucherType === 'MANUFACTURING_CONSUMPTION') {
        particulars = `Manufacturing Issue (Raw Material)`;
      } else if (t.voucherType === 'MANUFACTURING_OUTPUT') {
        particulars = `Manufacturing Output (Finished Goods)`;
      } else if (t.voucherType === 'STOCK_ADJUSTMENT') {
        particulars = `Physical Stock Adjustment`;
      }

      events.push({
        id: t.id,
        date: t.date,
        voucherNo: t.voucherNo,
        voucherType: t.voucherType,
        particulars,
        type: t.transactionType,
        qty: t.quantity,
        rate: t.rate,
        value: t.value,
        godown: t.godown,
        locationId: t.locationId,
        remarks: t.remarks,
      });
    });

    itemWastage.forEach((w) => {
      events.push({
        id: w.id,
        date: w.date,
        voucherNo: w.referenceNo || 'WASTE-REC',
        voucherType: 'WASTAGE',
        particulars: `Wastage (${w.reason || w.wastageType || 'Loss'})`,
        type: 'WASTAGE',
        qty: w.quantity,
        rate: w.rate || 0,
        value: w.totalValue || 0,
        godown: w.godown,
        locationId: w.locationId,
        remarks: w.remarks,
      });
    });

    events.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo));

    let runningQty = item.openingQty || 0;
    const rows: StockLedgerRow[] = [];

    for (const e of events) {
      const isBeforeFrom = fromDate ? e.date < fromDate : false;
      const isAfterTo = toDate ? e.date > toDate : false;

      let inQty = 0;
      let outQty = 0;
      let wastageQty = 0;

      if (e.type === 'IN') {
        inQty = e.qty;
        runningQty += e.qty;
      } else if (e.type === 'OUT') {
        outQty = e.qty;
        runningQty -= e.qty;
      } else if (e.type === 'WASTAGE') {
        wastageQty = e.qty;
        runningQty -= e.qty;
      }

      if (!isBeforeFrom && !isAfterTo) {
        rows.push({
          id: e.id,
          date: e.date,
          voucherNo: e.voucherNo,
          voucherType: e.voucherType,
          movementType: e.type === 'IN' ? 'INWARD' : e.type === 'OUT' ? 'OUTWARD' : 'WASTAGE',
          particulars: e.particulars,
          transactionType: e.type,
          inQty,
          inwardQty: inQty,
          outQty,
          outwardQty: outQty,
          wastageQty,
          rate: e.rate,
          value: e.value,
          runningQty,
          runningBalance: runningQty,
          godown: e.godown,
          locationId: e.locationId,
          remarks: e.remarks,
        });
      }
    }

    return rows;
  }

  // 4. Record Wastage Entry
  public async recordWastage(entryData: any): Promise<WastageEntry> {
    const now = new Date().toISOString();
    const id = `waste-${Date.now()}`;
    const uuid = uuidv4();

    const items = await dbStorage.getInventoryItems();
    const itm = items.find((i) => i.id === entryData.itemId);
    const rate = entryData.rate || itm?.openingRate || 0;

    const entry: WastageEntry = {
      ...entryData,
      id,
      uuid,
      itemName: entryData.itemName || itm?.name || 'Inventory Item',
      itemCode: entryData.itemCode || itm?.code || 'ITEM',
      unit: entryData.unit || itm?.primaryUnit || 'SQFT',
      rate,
      reason: entryData.reason || entryData.wastageType || 'BREAKAGE',
      wastageType: entryData.wastageType || entryData.reason || 'BREAKAGE',
      totalValue: Math.round(entryData.quantity * rate * 100) / 100,
      createdAt: now,
    };

    await dbStorage.saveWastageEntry(entry);

    // Queue for sync
    const syncItem: SyncQueueItem = {
      id: uuidv4(),
      transactionUuid: entry.uuid,
      companyId: entry.companyId,
      fiscalYearId: entry.fiscalYearId,
      deviceId: 'BROWSER-LOCAL-01',
      entityType: 'WASTAGE',
      operation: 'CREATE',
      payload: entry,
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await dbStorage.addToSyncQueue(syncItem);

    // Audit log
    await dbStorage.logAudit(
      'CREATE',
      'WASTAGE',
      entry.id,
      `Recorded wastage of ${entry.quantity} ${entry.unit} for ${entry.itemName} (${entry.reason}). Value: ₹${entry.totalValue}`
    );

    return entry;
  }

  // 5. Wastage Percentage & Analytics
  public async getWastageAnalysis(fromDate?: string, toDate?: string): Promise<WastageAnalysisItem[]> {
    const items = await dbStorage.getInventoryItems();
    const transactions = await dbStorage.getStockTransactions();
    const wastageEntries = await dbStorage.getWastageEntries();

    const results: WastageAnalysisItem[] = [];

    for (const item of items) {
      const itmTxs = transactions.filter((t) => t.itemId === item.id && (!toDate || t.date <= toDate) && (!fromDate || t.date >= fromDate));
      const itmWaste = wastageEntries.filter((w) => w.itemId === item.id && (!toDate || w.date <= toDate) && (!fromDate || w.date >= fromDate));

      const totalIn = (item.openingQty || 0) + itmTxs.filter((t) => t.transactionType === 'IN').reduce((s, t) => s + t.quantity, 0);
      const totalWastageQty = itmWaste.reduce((s, w) => s + w.quantity, 0);
      const totalWastageValue = itmWaste.reduce((s, w) => s + w.totalValue, 0);

      const wastagePercentage = totalIn > 0 ? Math.round((totalWastageQty / totalIn) * 10000) / 100 : 0;

      const breakageCount = itmWaste.filter((w) => w.reason === 'BREAKAGE').reduce((s, w) => s + w.quantity, 0);
      const edgeCrackCount = itmWaste.filter((w) => w.reason === 'EDGE_CRACK').reduce((s, w) => s + w.quantity, 0);
      const cuttingLossCount = itmWaste.filter((w) => w.reason === 'CUTTING_LOSS').reduce((s, w) => s + w.quantity, 0);
      const defectCount = itmWaste.filter((w) => w.reason === 'DEFECT').reduce((s, w) => s + w.quantity, 0);

      results.push({
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        category: item.category,
        unit: item.primaryUnit,
        totalProductionOrIn: totalIn,
        totalWastageQty,
        totalWastageValue,
        wastagePercentage,
        breakageCount,
        edgeCrackCount,
        cuttingLossCount,
        defectCount,
      });
    }

    return results;
  }

  // 6. Stock Physical Adjustment
  public async recordStockAdjustment(
    itemId: string,
    physicalQty: number,
    rate: number,
    remarks: string,
    companyId: string,
    fiscalYearId: string
  ): Promise<void> {
    const items = await dbStorage.getInventoryItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found.');

    const summary = await this.getStockSummary();
    const itemSum = summary.find((s) => s.item.id === itemId);
    const bookQty = itemSum ? itemSum.closingQty : 0;

    const diff = physicalQty - bookQty;
    if (diff === 0) return;

    const now = new Date().toISOString();
    const dateStr = now.split('T')[0];

    const stockTx: StockTransaction = {
      id: uuidv4(),
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      date: dateStr,
      itemId,
      voucherId: `ADJ-${Date.now()}`,
      voucherNo: `STK-ADJ-${Date.now().toString().slice(-4)}`,
      voucherType: 'STOCK_ADJUSTMENT',
      transactionType: diff > 0 ? 'IN' : 'OUT',
      quantity: Math.abs(diff),
      unit: item.primaryUnit,
      rate: rate || item.openingRate,
      value: Math.abs(diff) * (rate || item.openingRate),
      remarks: `Physical stock count adjustment. Book: ${bookQty}, Physical: ${physicalQty}. Remarks: ${remarks}`,
      createdAt: now,
    };

    await dbStorage.saveStockTransaction(stockTx);

    await dbStorage.logAudit(
      'CREATE',
      'STOCK_ADJUSTMENT',
      stockTx.id,
      `Stock adjustment for ${item.name}: ${diff > 0 ? '+' : ''}${diff} ${item.primaryUnit} (Physical: ${physicalQty})`
    );
  }

  // 7. Stock Journal Operations (Manufacturing, Transfer, Repacking & Conversion)
  public async getStockJournals(
    fromDate?: string,
    toDate?: string,
    journalType?: StockJournalType | 'ALL'
  ): Promise<StockJournalEntry[]> {
    const all = await dbStorage.getStockJournals();
    return all
      .filter((j) => {
        if (fromDate && j.date < fromDate) return false;
        if (toDate && j.date > toDate) return false;
        if (journalType && journalType !== 'ALL' && j.journalType !== journalType) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.voucherNo.localeCompare(a.voucherNo));
  }

  public async getStockJournalById(id: string): Promise<StockJournalEntry | null> {
    const all = await dbStorage.getStockJournals();
    return all.find((j) => j.id === id || j.uuid === id) || null;
  }

  public async getNextStockJournalVoucherNumber(): Promise<string> {
    const all = await dbStorage.getStockJournals();
    const count = all.length + 1;
    const padded = count.toString().padStart(3, '0');
    return `STKJ/26-27/${padded}`;
  }

  public async recordStockJournal(
    journalData: Partial<StockJournalEntry> & {
      sourceItems: StockJournalItem[];
      destinationItems: StockJournalItem[];
      companyId: string;
      fiscalYearId: string;
    }
  ): Promise<StockJournalEntry> {
    const now = new Date().toISOString();
    const isEdit = Boolean(journalData.id);
    const id = journalData.id || `stkj-${Date.now()}`;
    const uuid = journalData.uuid || uuidv4();
    const voucherNo = journalData.voucherNo || (await this.getNextStockJournalVoucherNumber());
    const date = journalData.date || now.split('T')[0];
    const journalType = journalData.journalType || 'MANUFACTURING';
    const narration = journalData.narration || '';
    const referenceNo = journalData.referenceNo || '';
    const additionalCost = Number(journalData.additionalCost || 0);

    const validSource = (journalData.sourceItems || []).filter(
      (item) => item.itemId && Number(item.quantity) > 0
    );
    const validDestination = (journalData.destinationItems || []).filter(
      (item) => item.itemId && Number(item.quantity) > 0
    );

    if (validSource.length === 0 && validDestination.length === 0) {
      throw new Error('Stock journal must have at least one source (issue) or destination (production) item.');
    }

    const totalSourceQty = validSource.reduce((s, itm) => s + Number(itm.quantity || 0), 0);
    const totalSourceAmount = validSource.reduce(
      (s, itm) => s + Number(itm.amount || Number(itm.quantity) * Number(itm.rate || 0)),
      0
    );

    const totalDestinationQty = validDestination.reduce((s, itm) => s + Number(itm.quantity || 0), 0);
    const totalDestinationAmount = validDestination.reduce(
      (s, itm) => s + Number(itm.amount || Number(itm.quantity) * Number(itm.rate || 0)),
      0
    );

    const entry: StockJournalEntry = {
      id,
      uuid,
      voucherNo,
      date,
      companyId: journalData.companyId,
      fiscalYearId: journalData.fiscalYearId,
      journalType,
      narration,
      referenceNo,
      sourceItems: validSource,
      destinationItems: validDestination,
      additionalCost,
      totalSourceQty,
      totalSourceAmount,
      totalDestinationQty,
      totalDestinationAmount,
      status: 'POSTED',
      createdAt: journalData.createdAt || now,
      updatedAt: now,
    };

    // 1. Delete previous stock transactions for this voucher id if editing
    await dbStorage.deleteStockTransactionsForVoucher(id);

    // 2. Create Outward Stock Transactions for Source items (Consumption/Issue)
    for (const src of validSource) {
      const srcQty = Number(src.quantity);
      const srcRate = Number(src.rate || 0);
      const srcVal = Number(src.amount || srcQty * srcRate);

      const outTx: StockTransaction = {
        id: uuidv4(),
        uuid: uuidv4(),
        companyId: journalData.companyId,
        fiscalYearId: journalData.fiscalYearId,
        date,
        itemId: src.itemId,
        voucherId: id,
        voucherNo,
        voucherType: 'CONVERSION',
        transactionType: 'OUT',
        quantity: srcQty,
        unit: src.unit || 'SQFT',
        rate: srcRate,
        value: srcVal,
        locationId: src.locationId,
        godown: src.godown,
        remarks: narration
          ? `${narration} (Issue - ${src.godown || 'Factory Yard'})`
          : `Stock Journal Issue: ${journalType} [${src.godown || 'Main Godown'}]`,
        createdAt: now,
      };
      await dbStorage.saveStockTransaction(outTx);
    }

    // 3. Create Inward Stock Transactions for Destination items (Production/Inward)
    for (const dest of validDestination) {
      const destQty = Number(dest.quantity);
      const destRate = Number(dest.rate || 0);
      const destVal = Number(dest.amount || destQty * destRate);

      const inTx: StockTransaction = {
        id: uuidv4(),
        uuid: uuidv4(),
        companyId: journalData.companyId,
        fiscalYearId: journalData.fiscalYearId,
        date,
        itemId: dest.itemId,
        voucherId: id,
        voucherNo,
        voucherType: 'CONVERSION',
        transactionType: 'IN',
        quantity: destQty,
        unit: dest.unit || 'SQFT',
        rate: destRate,
        value: destVal,
        locationId: dest.locationId,
        godown: dest.godown,
        remarks: narration
          ? `${narration} (Receipt - ${dest.godown || 'Finished Store'})`
          : `Stock Journal Receipt: ${journalType} [${dest.godown || 'Finished Goods'}]`,
        createdAt: now,
      };
      await dbStorage.saveStockTransaction(inTx);
    }

    // 4. Save the Stock Journal Record
    await dbStorage.saveStockJournal(entry);

    // 5. Add to Sync Queue
    const syncItem: SyncQueueItem = {
      id: uuidv4(),
      transactionUuid: entry.uuid,
      companyId: entry.companyId,
      fiscalYearId: entry.fiscalYearId,
      deviceId: 'BROWSER-LOCAL-01',
      entityType: 'STOCK',
      operation: isEdit ? 'UPDATE' : 'CREATE',
      payload: entry,
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await dbStorage.addToSyncQueue(syncItem);

    // 6. Audit Log
    await dbStorage.logAudit(
      isEdit ? 'EDIT' : 'CREATE',
      'STOCK_JOURNAL',
      entry.id,
      `${isEdit ? 'Updated' : 'Created'} Stock Journal ${entry.voucherNo} (${entry.journalType}): Consumed ${entry.totalSourceQty} items (₹${entry.totalSourceAmount}), Produced ${entry.totalDestinationQty} items (₹${entry.totalDestinationAmount})`
    );

    return entry;
  }

  public async deleteStockJournal(id: string): Promise<void> {
    const existing = await this.getStockJournalById(id);
    if (!existing) return;

    // Remove stock transactions
    await dbStorage.deleteStockTransactionsForVoucher(id);

    // Remove journal entry
    await dbStorage.deleteStockJournal(id);

    // Audit log
    await dbStorage.logAudit(
      'DELETE' as any,
      'STOCK_JOURNAL',
      id,
      `Deleted Stock Journal ${existing.voucherNo} (${existing.journalType})`
    );
  }
}

export const inventoryEngine = new InventoryEngine();
