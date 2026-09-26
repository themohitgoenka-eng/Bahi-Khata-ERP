import {
  Voucher,
  Ledger,
  AccountGroup,
  VoucherLine,
  StockTransaction,
  SyncQueueItem,
  VoucherType,
} from '../types';
import { dbStorage } from './storage/indexedDbStorage';
import { v4 as uuidv4 } from 'uuid';
import { parseDisplayToISO, getTodayISO } from '../utils/dateUtils';

export interface LedgerStatementRow {
  id: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherType;
  date: string;
  particulars: string;
  opposingLedgerNames: string;
  referenceNo?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'DR' | 'CR';
  narration?: string;
}

export interface LedgerSummary {
  ledger: Ledger;
  group?: AccountGroup;
  openingBalance: number;
  openingBalanceType: 'DR' | 'CR';
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingBalanceType: 'DR' | 'CR';
  rows: LedgerStatementRow[];
}

export interface TrialBalanceItem {
  ledgerId: string;
  ledgerName: string;
  groupId: string;
  groupName: string;
  accountType: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
  isStockInHandProvision?: boolean;
  isProfitLossProvision?: boolean;
  stockInHandDebit?: number;
  profitLossCredit?: number;
  profitLossDebit?: number;
  adjustedDebit?: number;
  adjustedCredit?: number;
}

export interface TrialBalanceResult {
  items: TrialBalanceItem[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  isBalanced: boolean;
  difference: number;
}

export interface ProfitLossResult {
  // Income
  salesGross: number;
  salesReturns: number;
  netSales: number;
  directIncome: number;
  closingStockValue: number;
  totalTradingCredit: number;

  // Direct Expenses / Cost
  openingStockValue: number;
  purchasesGross: number;
  purchaseReturns: number;
  netPurchases: number;
  directExpenses: { ledgerId: string; ledgerName: string; amount: number }[];
  totalDirectExpenses: number;
  totalTradingDebit: number;

  // Gross Profit
  grossProfit: number;
  isGrossLoss: boolean;

  // Indirect
  indirectIncomes: { ledgerId: string; ledgerName: string; amount: number }[];
  totalIndirectIncome: number;
  indirectExpenses: { ledgerId: string; ledgerName: string; amount: number }[];
  totalIndirectExpenses: number;

  // Net Profit
  netProfit: number;
  isNetLoss: boolean;
}

export interface BalanceSheetResult {
  liabilities: {
    capitalAccounts: { ledgerName: string; amount: number }[];
    totalCapital: number;
    currentPeriodNetProfit: number;
    currentLiabilities: {
      sundryCreditors: { ledgerName: string; amount: number }[];
      otherLiabilities: { ledgerName: string; amount: number }[];
      total: number;
    };
    totalLiabilities: number;
  };
  assets: {
    fixedAssets: { ledgerName: string; amount: number }[];
    totalFixedAssets: number;
    currentAssets: {
      sundryDebtors: { ledgerName: string; amount: number }[];
      cashInHand: { ledgerName: string; amount: number }[];
      bankAccounts: { ledgerName: string; amount: number }[];
      stockInHandValue: number;
      otherCurrentAssets: { ledgerName: string; amount: number }[];
      total: number;
    };
    totalAssets: number;
  };
  isBalanced: boolean;
  difference: number;
}

export class AccountingEngine {
  // 1. Double-entry validation
  public validateVoucher(voucher: Partial<Voucher>): { isValid: boolean; error?: string } {
    if (!voucher.date) return { isValid: false, error: 'Voucher date is required.' };
    if (!voucher.voucherType) return { isValid: false, error: 'Voucher type is required.' };
    if (!voucher.lines || voucher.lines.length < 2) {
      return { isValid: false, error: 'A valid voucher requires at least two transaction lines.' };
    }

    let totalDr = 0;
    let totalCr = 0;

    for (const line of voucher.lines) {
      if (!line.ledgerId) return { isValid: false, error: 'Every transaction line must specify an account ledger.' };
      if (!line.amount || line.amount <= 0) {
        return { isValid: false, error: 'Transaction amounts must be positive numbers.' };
      }
      if (line.type === 'DR') totalDr += Number(line.amount);
      if (line.type === 'CR') totalCr += Number(line.amount);
    }

    const roundedDr = Math.round(totalDr * 100) / 100;
    const roundedCr = Math.round(totalCr * 100) / 100;

    if (Math.abs(roundedDr - roundedCr) > 0.01) {
      return {
        isValid: false,
        error: `Total Debit (₹${roundedDr.toFixed(2)}) must equal Total Credit (₹${roundedCr.toFixed(2)}). Difference: ₹${Math.abs(roundedDr - roundedCr).toFixed(2)}`,
      };
    }

    return { isValid: true };
  }

  // 2. Post Voucher with Atomic Ledger & Inventory update
  public async postVoucher(voucherData: Omit<Voucher, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<Voucher> {
    const validation = this.validateVoucher(voucherData);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const id = existingId || `vch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const uuid = voucherData.uuid || uuidv4();

    const finalDate = voucherData.date
      ? parseDisplayToISO(voucherData.date).slice(0, 10)
      : getTodayISO();

    const voucher: Voucher = {
      ...voucherData,
      id,
      uuid,
      date: finalDate,
      totalDebit: Math.round(voucherData.lines.reduce((s, l) => (l.type === 'DR' ? s + Number(l.amount) : s), 0) * 100) / 100,
      totalCredit: Math.round(voucherData.lines.reduce((s, l) => (l.type === 'CR' ? s + Number(l.amount) : s), 0) * 100) / 100,
      status: voucherData.status || 'POSTED',
      createdAt: now,
      updatedAt: now,
    };

    // Save Voucher in isolated storage
    await dbStorage.saveVoucher(voucher);

    // Clean any prior stock transactions if updating
    if (existingId) {
      await dbStorage.deleteStockTransactionsForVoucher(existingId);
    }

    // Handle Inventory stock transactions if inventory lines present
    if (voucher.inventoryLines && voucher.inventoryLines.length > 0) {
      for (const line of voucher.inventoryLines) {
        let txType: 'IN' | 'OUT' = 'OUT';
        if (voucher.voucherType === 'PURCHASE' || voucher.voucherType === 'SALES_RETURN') {
          txType = 'IN';
        } else if (voucher.voucherType === 'SALES' || voucher.voucherType === 'PURCHASE_RETURN') {
          txType = 'OUT';
        }

        const stockTx: StockTransaction = {
          id: uuidv4(),
          uuid: uuidv4(),
          companyId: voucher.companyId,
          fiscalYearId: voucher.fiscalYearId,
          date: voucher.date,
          itemId: line.itemId,
          voucherId: voucher.id,
          voucherNo: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          transactionType: txType,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
          value: line.amount,
          locationId: line.locationId,
          godown: line.godown,
          remarks: voucher.narration,
          createdAt: now,
        };

        await dbStorage.saveStockTransaction(stockTx);
      }
    }

    // Add to Sync Queue
    const syncItem: SyncQueueItem = {
      id: uuidv4(),
      transactionUuid: voucher.uuid,
      companyId: voucher.companyId,
      fiscalYearId: voucher.fiscalYearId,
      deviceId: voucher.deviceId || 'BROWSER-LOCAL-01',
      entityType: 'VOUCHER',
      operation: existingId ? 'UPDATE' : 'CREATE',
      payload: voucher,
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await dbStorage.addToSyncQueue(syncItem);

    // Audit log
    await dbStorage.logAudit(
      existingId ? 'EDIT' : 'CREATE',
      'VOUCHER',
      voucher.id,
      `Voucher ${voucher.voucherNumber} (${voucher.voucherType}) posted for ₹${voucher.totalDebit}`
    );

    return voucher;
  }

  // 3. Cancel / Reverse Voucher
  public async reverseVoucher(voucherId: string, reason: string): Promise<Voucher> {
    const vouchers = await dbStorage.getVouchers();
    const original = vouchers.find((v) => v.id === voucherId);
    if (!original) throw new Error('Voucher not found.');
    if (original.status === 'REVERSED') throw new Error('Voucher is already reversed.');

    const now = new Date().toISOString();
    const reversedVoucherNumber = `REV-${original.voucherNumber}`;

    // Swap lines for reversal: DR becomes CR, CR becomes DR
    const reversedLines: VoucherLine[] = original.lines.map((l) => ({
      ...l,
      id: uuidv4(),
      uuid: uuidv4(),
      type: l.type === 'DR' ? 'CR' : 'DR',
      narration: `Reversal of ${original.voucherNumber}`,
    }));

    const reversalVoucher: Voucher = {
      id: `vch-${Date.now()}`,
      uuid: uuidv4(),
      voucherNumber: reversedVoucherNumber,
      voucherType: 'JOURNAL',
      date: new Date().toISOString().split('T')[0],
      companyId: original.companyId,
      fiscalYearId: original.fiscalYearId,
      narration: `Reversal entry for ${original.voucherNumber}. Reason: ${reason}`,
      referenceNo: original.voucherNumber,
      lines: reversedLines,
      totalDebit: original.totalDebit,
      totalCredit: original.totalCredit,
      status: 'POSTED',
      deviceId: 'BROWSER-LOCAL-01',
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    // Mark original as reversed
    original.status = 'REVERSED';
    original.isReversed = true;
    original.reversedVoucherId = reversalVoucher.id;
    original.updatedAt = now;

    await dbStorage.saveVoucher(original);
    await dbStorage.saveVoucher(reversalVoucher);

    // Reverse inventory if present
    if (original.inventoryLines && original.inventoryLines.length > 0) {
      for (const line of original.inventoryLines) {
        let revType: 'IN' | 'OUT' = 'IN';
        if (original.voucherType === 'PURCHASE') revType = 'OUT';
        if (original.voucherType === 'SALES') revType = 'IN';

        const stockTx: StockTransaction = {
          id: uuidv4(),
          uuid: uuidv4(),
          companyId: original.companyId,
          fiscalYearId: original.fiscalYearId,
          date: reversalVoucher.date,
          itemId: line.itemId,
          voucherId: reversalVoucher.id,
          voucherNo: reversalVoucher.voucherNumber,
          voucherType: 'JOURNAL',
          transactionType: revType,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
          value: line.amount,
          locationId: line.locationId,
          godown: line.godown,
          remarks: `Reversal of ${original.voucherNumber}`,
          createdAt: now,
        };
        await dbStorage.saveStockTransaction(stockTx);
      }
    }

    await dbStorage.logAudit('REVERSE', 'VOUCHER', original.id, `Reversed voucher ${original.voucherNumber}. Reason: ${reason}`);

    return reversalVoucher;
  }

  // 4. Calculate Ledger Statement with running balance
  public async getLedgerSummary(ledgerId: string, fromDate?: string, toDate?: string): Promise<LedgerSummary | null> {
    const ledgers = await dbStorage.getLedgers();
    const groups = await dbStorage.getAccountGroups();
    const allVouchers = await dbStorage.getVouchers();

    const isAllCash = ledgerId === 'ALL' || ledgerId === 'ALL_CASH';
    const cashLedgers = ledgers.filter(
      (l) => l.groupId === 'grp-cash-in-hand' || l.name.toLowerCase().includes('cash')
    );

    let ledger: Ledger | undefined;
    let group: AccountGroup | undefined;

    if (isAllCash) {
      const netCashOpening = cashLedgers.reduce(
        (sum, cl) => sum + (cl.openingBalanceType === 'DR' ? cl.openingBalance : -cl.openingBalance),
        0
      );
      ledger = {
        id: 'ALL_CASH',
        uuid: 'all-cash-uuid',
        companyId: ledgers[0]?.companyId || '',
        groupId: 'grp-cash-in-hand',
        name: 'All Cash Accounts (Combined)',
        accountType: 'ASSET',
        openingBalance: Math.abs(netCashOpening),
        openingBalanceType: netCashOpening >= 0 ? 'DR' : 'CR',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      group = groups.find((g) => g.id === 'grp-cash-in-hand');
    } else {
      ledger =
        ledgers.find((l) => l.id === ledgerId) ||
        ledgers.find((l) => l.name.trim().toLowerCase() === ledgerId.trim().toLowerCase()) ||
        ledgers[0];
      if (!ledger) return null;
      group = groups.find((g) => g.id === ledger.groupId);
    }

    const targetLedgerIds = new Set(isAllCash ? cashLedgers.map((l) => l.id) : [ledger.id]);

    const normalizeDateStr = (d?: string | null) => {
      if (!d) return '';
      const iso = parseDisplayToISO(d);
      return iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
    };

    const normFrom = normalizeDateStr(fromDate);
    const normTo = normalizeDateStr(toDate);

    // Filter valid posted vouchers sorted by date
    const activeVouchers = allVouchers
      .filter((v) => !v.status || v.status === 'POSTED')
      .sort((a, b) => {
        const ad = normalizeDateStr(a.date);
        const bd = normalizeDateStr(b.date);
        return ad.localeCompare(bd) || (a.voucherNumber || '').localeCompare(b.voucherNumber || '');
      });

    // Calculate opening balance before fromDate
    let currentBalance = ledger.openingBalanceType === 'DR' ? ledger.openingBalance : -ledger.openingBalance;
    let periodDebit = 0;
    let periodCredit = 0;
    const rows: LedgerStatementRow[] = [];

    // Evaluate all vouchers
    for (const v of activeVouchers) {
      const vDate = normalizeDateStr(v.date);
      const isBeforeFrom = normFrom ? vDate < normFrom : false;
      const isAfterTo = normTo ? vDate > normTo : false;

      const ledgerLines = v.lines.filter((l) => targetLedgerIds.has(l.ledgerId));
      if (ledgerLines.length === 0) continue;

      const opposingLines = v.lines.filter((l) => !targetLedgerIds.has(l.ledgerId));
      const opposingNames = opposingLines
        .map((l) => l.ledgerName || ledgers.find((x) => x.id === l.ledgerId)?.name || 'Account')
        .join(', ');

      for (const line of ledgerLines) {
        const lineDr = line.type === 'DR' ? Number(line.amount) : 0;
        const lineCr = line.type === 'CR' ? Number(line.amount) : 0;

        if (isBeforeFrom) {
          // Adjust starting balance for this period
          currentBalance += lineDr - lineCr;
        } else if (!isAfterTo) {
          currentBalance += lineDr - lineCr;
          periodDebit += lineDr;
          periodCredit += lineCr;

          rows.push({
            id: line.id || uuidv4(),
            voucherId: v.id,
            voucherNo: v.voucherNumber,
            voucherType: v.voucherType,
            date: vDate,
            particulars: opposingNames || (line.type === 'DR' ? 'To By Account' : 'By Account'),
            opposingLedgerNames: opposingNames,
            referenceNo: v.referenceNo,
            debit: lineDr,
            credit: lineCr,
            runningBalance: Math.abs(currentBalance),
            balanceType: currentBalance >= 0 ? 'DR' : 'CR',
            narration: line.narration || v.narration,
          });
        }
      }
    }

    const effectiveOpeningBalance = normFrom
      ? (rows.length > 0 ? rows[0].runningBalance - (rows[0].debit - rows[0].credit) : currentBalance)
      : (ledger.openingBalanceType === 'DR' ? ledger.openingBalance : -ledger.openingBalance);

    return {
      ledger,
      group,
      openingBalance: Math.abs(effectiveOpeningBalance),
      openingBalanceType: effectiveOpeningBalance >= 0 ? 'DR' : 'CR',
      totalDebit: periodDebit,
      totalCredit: periodCredit,
      closingBalance: Math.abs(currentBalance),
      closingBalanceType: currentBalance >= 0 ? 'DR' : 'CR',
      rows,
    };
  }

  // 5. Generate Complete Trial Balance
  public async getTrialBalance(asOfDate?: string, includeZeroBalance: boolean = true, fromDate?: string): Promise<TrialBalanceResult> {
    const ledgers = await dbStorage.getLedgers();
    const groups = await dbStorage.getAccountGroups();
    const vouchers = await dbStorage.getVouchers();

    const normalizeDate = (d?: string) => {
      if (!d) return '';
      return d.includes('T') ? d.split('T')[0] : d.slice(0, 10);
    };

    const normTo = normalizeDate(asOfDate);
    const normFrom = normalizeDate(fromDate);

    const items: TrialBalanceItem[] = [];
    let totalOpeningDr = 0;
    let totalOpeningCr = 0;
    let totalPeriodDr = 0;
    let totalPeriodCr = 0;
    let totalClosingDr = 0;
    let totalClosingCr = 0;

    for (const ledger of ledgers) {
      const group = groups.find((g) => g.id === ledger.groupId);
      let initialNet = ledger.openingBalanceType === 'DR' ? ledger.openingBalance : -ledger.openingBalance;

      let periodDr = 0;
      let periodCr = 0;

      for (const v of vouchers) {
        if (v.status !== 'POSTED') continue;
        const vDate = normalizeDate(v.date);

        for (const line of v.lines) {
          if (line.ledgerId === ledger.id) {
            const dr = line.type === 'DR' ? Number(line.amount) : 0;
            const cr = line.type === 'CR' ? Number(line.amount) : 0;

            if (normFrom && vDate < normFrom) {
              initialNet += dr - cr;
            } else if ((!normFrom || vDate >= normFrom) && (!normTo || vDate <= normTo)) {
              periodDr += dr;
              periodCr += cr;
            }
          }
        }
      }

      const openingDr = initialNet > 0 ? initialNet : 0;
      const openingCr = initialNet < 0 ? Math.abs(initialNet) : 0;

      const netBalance = (openingDr - openingCr) + (periodDr - periodCr);
      const closingDr = netBalance > 0 ? netBalance : 0;
      const closingCr = netBalance < 0 ? Math.abs(netBalance) : 0;

      // Add to grand totals
      totalOpeningDr += openingDr;
      totalOpeningCr += openingCr;
      totalPeriodDr += periodDr;
      totalPeriodCr += periodCr;
      totalClosingDr += closingDr;
      totalClosingCr += closingCr;

      // Include all ledgers if includeZeroBalance, or if they have opening, period, or closing balance
      if (includeZeroBalance || openingDr > 0 || openingCr > 0 || periodDr > 0 || periodCr > 0 || closingDr > 0 || closingCr > 0) {
        items.push({
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          groupId: ledger.groupId,
          groupName: group?.name || 'General',
          accountType: ledger.accountType,
          openingDebit: openingDr,
          openingCredit: openingCr,
          periodDebit: periodDr,
          periodCredit: periodCr,
          closingDebit: closingDr,
          closingCredit: closingCr,
        });
      }
    }

    const diff = Math.abs(totalClosingDr - totalClosingCr);

    return {
      items: items.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.ledgerName.localeCompare(b.ledgerName)),
      totalOpeningDebit: Math.round(totalOpeningDr * 100) / 100,
      totalOpeningCredit: Math.round(totalOpeningCr * 100) / 100,
      totalPeriodDebit: Math.round(totalPeriodDr * 100) / 100,
      totalPeriodCredit: Math.round(totalPeriodCr * 100) / 100,
      totalClosingDebit: Math.round(totalClosingDr * 100) / 100,
      totalClosingCredit: Math.round(totalClosingCr * 100) / 100,
      isBalanced: diff < 0.02,
      difference: Math.round(diff * 100) / 100,
    };
  }

  // 6. Generate Profit & Loss Statement
  public async getProfitAndLoss(fromDate?: string, toDate?: string): Promise<ProfitLossResult> {
    const trialBalance = await this.getTrialBalance(toDate);
    const items = await dbStorage.getInventoryItems();
    const stockTxs = await dbStorage.getStockTransactions();
    const wastageEntries = await dbStorage.getWastageEntries();

    // Calculate closing stock valuation
    let closingStockValue = 0;
    let openingStockValue = 0;

    for (const itm of items) {
      openingStockValue += (itm.openingQty || 0) * (itm.openingRate || 0);

      // Total in / out / wastage for item
      const itmTxs = stockTxs.filter((t) => t.itemId === itm.id && (!toDate || t.date <= toDate));
      const inQty = itmTxs.filter((t) => t.transactionType === 'IN').reduce((s, t) => s + t.quantity, 0);
      const outQty = itmTxs.filter((t) => t.transactionType === 'OUT').reduce((s, t) => s + t.quantity, 0);
      const itmWastage = wastageEntries.filter((w) => w.itemId === itm.id && (!toDate || w.date <= toDate)).reduce((s, w) => s + w.quantity, 0);

      const currentQty = (itm.openingQty || 0) + inQty - outQty - itmWastage;
      const rate = itm.openingRate || 0; // weighted avg rate
      if (currentQty > 0) {
        closingStockValue += currentQty * rate;
      }
    }

    let salesGross = 0;
    let salesReturns = 0;
    let purchasesGross = 0;
    let purchaseReturns = 0;
    let directIncome = 0;
    const directExpenses: { ledgerId: string; ledgerName: string; amount: number }[] = [];
    const indirectExpenses: { ledgerId: string; ledgerName: string; amount: number }[] = [];
    const indirectIncomes: { ledgerId: string; ledgerName: string; amount: number }[] = [];

    for (const item of trialBalance.items) {
      const netCr = item.closingCredit - item.closingDebit;
      const netDr = item.closingDebit - item.closingCredit;

      if (item.accountType === 'DIRECT_INCOME') {
        if (item.ledgerName.toLowerCase().includes('return')) {
          salesReturns += netDr > 0 ? netDr : 0;
        } else if (item.ledgerName.toLowerCase().includes('sales')) {
          salesGross += netCr > 0 ? netCr : 0;
        } else {
          directIncome += netCr > 0 ? netCr : 0;
        }
      } else if (item.accountType === 'DIRECT_EXPENSE') {
        if (item.ledgerName.toLowerCase().includes('return')) {
          purchaseReturns += netCr > 0 ? netCr : 0;
        } else if (item.ledgerName.toLowerCase().includes('purchase')) {
          purchasesGross += netDr > 0 ? netDr : 0;
        } else {
          if (netDr > 0) {
            directExpenses.push({ ledgerId: item.ledgerId, ledgerName: item.ledgerName, amount: netDr });
          }
        }
      } else if (item.accountType === 'INDIRECT_EXPENSE') {
        if (netDr > 0) {
          indirectExpenses.push({ ledgerId: item.ledgerId, ledgerName: item.ledgerName, amount: netDr });
        }
      } else if (item.accountType === 'INDIRECT_INCOME') {
        if (netCr > 0) {
          indirectIncomes.push({ ledgerId: item.ledgerId, ledgerName: item.ledgerName, amount: netCr });
        }
      }
    }

    const netSales = salesGross - salesReturns;
    const netPurchases = purchasesGross - purchaseReturns;
    const totalDirectExpenses = directExpenses.reduce((s, e) => s + e.amount, 0);

    const totalTradingCredit = netSales + directIncome + closingStockValue;
    const totalTradingDebit = openingStockValue + netPurchases + totalDirectExpenses;
    const grossProfit = totalTradingCredit - totalTradingDebit;

    const totalIndirectIncome = indirectIncomes.reduce((s, i) => s + i.amount, 0);
    const totalIndirectExpenses = indirectExpenses.reduce((s, e) => s + e.amount, 0);

    const netProfit = grossProfit + totalIndirectIncome - totalIndirectExpenses;

    return {
      salesGross,
      salesReturns,
      netSales,
      directIncome,
      closingStockValue,
      totalTradingCredit,
      openingStockValue,
      purchasesGross,
      purchaseReturns,
      netPurchases,
      directExpenses,
      totalDirectExpenses,
      totalTradingDebit,
      grossProfit,
      isGrossLoss: grossProfit < 0,
      indirectIncomes,
      totalIndirectIncome,
      indirectExpenses,
      totalIndirectExpenses,
      netProfit,
      isNetLoss: netProfit < 0,
    };
  }

  // 7. Generate Balance Sheet
  public async getBalanceSheet(asOfDate?: string): Promise<BalanceSheetResult> {
    const trialBalance = await this.getTrialBalance(asOfDate);
    const profitLoss = await this.getProfitAndLoss(undefined, asOfDate);

    const capitalAccounts: { ledgerName: string; amount: number }[] = [];
    const sundryCreditors: { ledgerName: string; amount: number }[] = [];
    const otherLiabilities: { ledgerName: string; amount: number }[] = [];

    const fixedAssets: { ledgerName: string; amount: number }[] = [];
    const sundryDebtors: { ledgerName: string; amount: number }[] = [];
    const cashInHand: { ledgerName: string; amount: number }[] = [];
    const bankAccounts: { ledgerName: string; amount: number }[] = [];
    const otherCurrentAssets: { ledgerName: string; amount: number }[] = [];

    for (const item of trialBalance.items) {
      const netCr = item.closingCredit - item.closingDebit;
      const netDr = item.closingDebit - item.closingCredit;

      if (item.accountType === 'CAPITAL') {
        if (netCr > 0) {
          capitalAccounts.push({ ledgerName: item.ledgerName, amount: netCr });
        } else if (netDr > 0) {
          // Drawings / Debit capital
          capitalAccounts.push({ ledgerName: item.ledgerName, amount: -netDr });
        }
      } else if (item.accountType === 'LIABILITY') {
        if (item.groupName.toLowerCase().includes('creditor')) {
          if (netCr > 0) sundryCreditors.push({ ledgerName: item.ledgerName, amount: netCr });
        } else {
          if (netCr > 0) otherLiabilities.push({ ledgerName: item.ledgerName, amount: netCr });
        }
      } else if (item.accountType === 'ASSET') {
        if (item.groupName.toLowerCase().includes('fixed')) {
          if (netDr > 0) fixedAssets.push({ ledgerName: item.ledgerName, amount: netDr });
        } else if (item.groupName.toLowerCase().includes('debtor') || item.groupName.toLowerCase().includes('customer')) {
          if (netDr > 0) sundryDebtors.push({ ledgerName: item.ledgerName, amount: netDr });
        } else if (item.groupName.toLowerCase().includes('cash')) {
          if (netDr > 0) cashInHand.push({ ledgerName: item.ledgerName, amount: netDr });
        } else if (item.groupName.toLowerCase().includes('bank')) {
          if (netDr > 0) bankAccounts.push({ ledgerName: item.ledgerName, amount: netDr });
        } else {
          if (netDr > 0) otherCurrentAssets.push({ ledgerName: item.ledgerName, amount: netDr });
        }
      }
    }

    const totalCapital = capitalAccounts.reduce((s, c) => s + c.amount, 0);
    const totalCreditors = sundryCreditors.reduce((s, c) => s + c.amount, 0);
    const totalOtherLiab = otherLiabilities.reduce((s, c) => s + c.amount, 0);
    const totalCurrentLiabilities = totalCreditors + totalOtherLiab;
    const totalLiabilities = totalCapital + profitLoss.netProfit + totalCurrentLiabilities;

    const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.amount, 0);
    const totalDebtors = sundryDebtors.reduce((s, a) => s + a.amount, 0);
    const totalCash = cashInHand.reduce((s, a) => s + a.amount, 0);
    const totalBank = bankAccounts.reduce((s, a) => s + a.amount, 0);
    const totalOtherAssets = otherCurrentAssets.reduce((s, a) => s + a.amount, 0);
    const stockInHandValue = profitLoss.closingStockValue;

    const totalCurrentAssets = totalDebtors + totalCash + totalBank + stockInHandValue + totalOtherAssets;
    const totalAssets = totalFixedAssets + totalCurrentAssets;

    const diff = Math.abs(totalLiabilities - totalAssets);

    return {
      liabilities: {
        capitalAccounts,
        totalCapital,
        currentPeriodNetProfit: profitLoss.netProfit,
        currentLiabilities: {
          sundryCreditors,
          otherLiabilities,
          total: totalCurrentLiabilities,
        },
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      },
      assets: {
        fixedAssets,
        totalFixedAssets,
        currentAssets: {
          sundryDebtors,
          cashInHand,
          bankAccounts,
          stockInHandValue,
          otherCurrentAssets,
          total: totalCurrentAssets,
        },
        totalAssets: Math.round(totalAssets * 100) / 100,
      },
      isBalanced: diff < 0.05,
      difference: Math.round(diff * 100) / 100,
    };
  }
}

export const accountingEngine = new AccountingEngine();
