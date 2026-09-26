import {
  BankAccount,
  BankStatementTransaction,
  Voucher,
  Ledger,
  SyncQueueItem,
} from '../types';
import { dbStorage } from './storage/indexedDbStorage';
import { accountingEngine } from './accountingEngine';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

export interface BankReconciliationSummary {
  bankAccount: BankAccount;
  bankLedger?: Ledger;
  bankBookBalance: number;
  bankStatementBalance: number;
  matchedCount: number;
  matchedAmount: number;
  unmatchedStatementCount: number;
  unmatchedStatementAmount: number;
  unmatchedBookCount: number;
  unmatchedBookAmount: number;
  chequesIssuedNotPresented: number;
  chequesDepositedNotCleared: number;
  difference: number;
  isReconciled: boolean;
}

export interface BankStatementParsedRow {
  date: string;
  narration: string;
  referenceNo?: string;
  chequeNo?: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance?: number;
}

export class BankingEngine {
  // 1. Parse CSV or Excel Bank Statement
  public parseStatementFile(fileData: ArrayBuffer | string, fileName: string): BankStatementParsedRow[] {
    let workbook: XLSX.WorkBook;

    if (typeof fileData === 'string') {
      workbook = XLSX.read(fileData, { type: 'string' });
    } else {
      workbook = XLSX.read(new Uint8Array(fileData), { type: 'array' });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rawRows.length < 2) return [];

    // Find header row by searching for date / description / amount keywords
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      const rowStr = rawRows[i].map((c: any) => String(c).toLowerCase()).join(' ');
      if (rowStr.includes('date') && (rowStr.includes('narration') || rowStr.includes('particular') || rowStr.includes('description') || rowStr.includes('amount') || rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('withdrawal') || rowStr.includes('deposit'))) {
        headerIdx = i;
        break;
      }
    }

    const headers: string[] = rawRows[headerIdx].map((h: any) => String(h).trim().toLowerCase());

    // Map column indices
    let dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('txndate') || h.includes('value date'));
    let narrIdx = headers.findIndex((h) => h.includes('narration') || h.includes('particular') || h.includes('description') || h.includes('details') || h.includes('remarks'));
    let refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('utr') || h.includes('trans id'));
    let debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('dr'));
    let creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || h.includes('cr'));
    let amountIdx = headers.findIndex((h) => h === 'amount' || h.includes('txn amount'));
    let typeIdx = headers.findIndex((h) => h.includes('type') || h === 'dr/cr');
    let balIdx = headers.findIndex((h) => h.includes('balance') || h.includes('closing'));

    // Fallbacks if not found
    if (dateIdx === -1) dateIdx = 0;
    if (narrIdx === -1) narrIdx = 1;
    if (debitIdx === -1 && amountIdx === -1) debitIdx = 2;
    if (creditIdx === -1 && amountIdx === -1) creditIdx = 3;

    const parsed: BankStatementParsedRow[] = [];

    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0 || !row[dateIdx]) continue;

      let dateVal = String(row[dateIdx]).trim();
      if (!dateVal) continue;

      // Normalize date to YYYY-MM-DD
      const normalizedDate = this.normalizeDate(dateVal);
      const narration = narrIdx !== -1 && row[narrIdx] ? String(row[narrIdx]).trim() : 'Bank Transaction';
      const referenceNo = refIdx !== -1 && row[refIdx] ? String(row[refIdx]).trim() : undefined;

      let type: 'DEBIT' | 'CREDIT' = 'DEBIT';
      let amount = 0;

      if (debitIdx !== -1 && creditIdx !== -1 && debitIdx !== creditIdx) {
        const drVal = this.parseNumeric(row[debitIdx]);
        const crVal = this.parseNumeric(row[creditIdx]);
        if (crVal > 0) {
          type = 'CREDIT';
          amount = crVal;
        } else if (drVal > 0) {
          type = 'DEBIT';
          amount = drVal;
        }
      } else if (amountIdx !== -1) {
        const amt = this.parseNumeric(row[amountIdx]);
        amount = Math.abs(amt);
        if (typeIdx !== -1 && row[typeIdx]) {
          const t = String(row[typeIdx]).toLowerCase();
          type = t.includes('cr') || t.includes('dep') ? 'CREDIT' : 'DEBIT';
        } else {
          type = amt >= 0 ? 'CREDIT' : 'DEBIT';
        }
      }

      const balance = balIdx !== -1 ? this.parseNumeric(row[balIdx]) : undefined;

      if (amount > 0) {
        parsed.push({
          date: normalizedDate,
          narration,
          referenceNo,
          type,
          amount,
          balance,
        });
      }
    }

    return parsed;
  }

  private parseNumeric(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/\s/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  private normalizeDate(str: string): string {
    // Check if Excel serial date number
    if (/^\d{5}$/.test(str)) {
      const serial = parseInt(str, 10);
      const date = new Date((serial - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Try DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // Try YYYY-MM-DD
    const yyyymmdd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  }

  // 2. Save Imported Statement Transactions
  public async saveImportedStatement(
    bankAccountId: string,
    parsedRows: BankStatementParsedRow[],
    companyId: string,
    fiscalYearId: string
  ): Promise<number> {
    let savedCount = 0;
    const now = new Date().toISOString();

    for (const row of parsedRows) {
      const tx: BankStatementTransaction = {
        id: `bnk-stmt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        uuid: uuidv4(),
        companyId,
        fiscalYearId,
        bankAccountId,
        date: row.date,
        narration: row.narration,
        referenceNo: row.referenceNo,
        chequeNo: row.chequeNo,
        type: row.type,
        amount: row.amount,
        balance: row.balance,
        reconciliationStatus: 'UNMATCHED',
        createdAt: now,
      };

      await dbStorage.saveBankTransaction(tx);
      savedCount++;
    }

    await dbStorage.logAudit(
      'IMPORT',
      'BANK_STATEMENT',
      bankAccountId,
      `Imported ${savedCount} transactions for bank account ID: ${bankAccountId}`
    );

    // Auto trigger reconciliation matching
    await this.autoReconcile(bankAccountId);

    return savedCount;
  }

  // 3. Auto Reconcile Engine
  public async autoReconcile(bankAccountId: string): Promise<{ matchedCount: number }> {
    const bankAccounts = await dbStorage.getBankAccounts();
    const bankAcc = bankAccounts.find((b) => b.id === bankAccountId);
    if (!bankAcc) return { matchedCount: 0 };

    const bankTransactions = await dbStorage.getBankTransactions();
    const allVouchers = await dbStorage.getVouchers();

    const unmatchedBankTxs = bankTransactions.filter(
      (t) => t.bankAccountId === bankAccountId && t.reconciliationStatus === 'UNMATCHED'
    );

    // Get vouchers that touch this bank account's ledger
    const postedVouchers = allVouchers.filter((v) => v.status === 'POSTED');
    let newlyMatched = 0;

    for (const bTx of unmatchedBankTxs) {
      // Find candidate vouchers
      // Statement DEBIT = Book CREDIT (Payment / withdrawal)
      // Statement CREDIT = Book DEBIT (Receipt / deposit)
      const expectedBookType = bTx.type === 'DEBIT' ? 'CR' : 'DR';

      const candidate = postedVouchers.find((v) => {
        // Must not already be matched
        const isAlreadyMatched = bankTransactions.some((bt) => bt.matchedVoucherId === v.id);
        if (isAlreadyMatched) return false;

        const bankLine = v.lines.find((l) => l.ledgerId === bankAcc.ledgerId);
        if (!bankLine) return false;

        if (bankLine.type !== expectedBookType) return false;
        if (Math.abs(Number(bankLine.amount) - bTx.amount) > 0.01) return false;

        // Check date proximity (within 7 days)
        const d1 = new Date(v.date).getTime();
        const d2 = new Date(bTx.date).getTime();
        const daysDiff = Math.abs(d1 - d2) / (1000 * 3600 * 24);
        return daysDiff <= 7;
      });

      if (candidate) {
        bTx.reconciliationStatus = 'MATCHED';
        bTx.matchedVoucherId = candidate.id;
        bTx.matchedDate = bTx.date;
        bTx.matchScore = 95;
        await dbStorage.saveBankTransaction(bTx);
        newlyMatched++;
      }
    }

    if (newlyMatched > 0) {
      await dbStorage.logAudit(
        'RECONCILE',
        'BANK_RECONCILIATION',
        bankAccountId,
        `Auto-reconciled ${newlyMatched} bank transactions`
      );
    }

    return { matchedCount: newlyMatched };
  }

  // Convenience Aliases for UI Components
  public parseCsvBankStatement(
    csvText: string,
    bankAccountId: string = '',
    companyId: string = '',
    fiscalYearId: string = ''
  ): BankStatementTransaction[] {
    const rows = this.parseStatementFile(csvText, 'statement.csv');
    const now = new Date().toISOString();
    return rows.map((r, idx) => ({
      id: `stmt-${Date.now()}-${idx}`,
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId,
      date: r.date,
      narration: r.narration,
      description: r.narration,
      referenceNo: r.referenceNo,
      chequeNo: r.chequeNo,
      type: r.type,
      amount: r.amount,
      debit: r.type === 'DEBIT' ? r.amount : undefined,
      credit: r.type === 'CREDIT' ? r.amount : undefined,
      balance: r.balance,
      reconciliationStatus: 'UNMATCHED',
      createdAt: now,
    }));
  }

  public parseXlsxBankStatement(
    buffer: ArrayBuffer,
    bankAccountId: string = '',
    companyId: string = '',
    fiscalYearId: string = ''
  ): BankStatementTransaction[] {
    const rows = this.parseStatementFile(buffer, 'statement.xlsx');
    const now = new Date().toISOString();
    return rows.map((r, idx) => ({
      id: `stmt-${Date.now()}-${idx}`,
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId,
      date: r.date,
      narration: r.narration,
      description: r.narration,
      referenceNo: r.referenceNo,
      chequeNo: r.chequeNo,
      type: r.type,
      amount: r.amount,
      debit: r.type === 'DEBIT' ? r.amount : undefined,
      credit: r.type === 'CREDIT' ? r.amount : undefined,
      balance: r.balance,
      reconciliationStatus: 'UNMATCHED',
      createdAt: now,
    }));
  }

  public async importBankStatement(
    entriesOrBankId: any,
    parsedRows?: any[],
    companyId?: string,
    fiscalYearId?: string
  ): Promise<any> {
    if (Array.isArray(entriesOrBankId)) {
      for (const entry of entriesOrBankId) {
        await dbStorage.saveBankTransaction(entry);
      }
      if (entriesOrBankId.length > 0 && entriesOrBankId[0].bankAccountId) {
        await this.autoReconcile(entriesOrBankId[0].bankAccountId);
      }
      return entriesOrBankId;
    } else {
      return this.saveImportedStatement(entriesOrBankId, parsedRows || [], companyId || '', fiscalYearId || '');
    }
  }

  public async autoMatchEntries(bankAccountId: string): Promise<any> {
    const res = await this.autoReconcile(bankAccountId);
    return {
      matchedCount: res.matchedCount,
      length: res.matchedCount,
    };
  }

  public async unmatchEntry(bankTransactionId: string): Promise<void> {
    return this.unmatch(bankTransactionId);
  }

  public async postVoucherFromStatement(
    entryOrId: string | BankStatementTransaction,
    opposingOrBankAccount: string | BankAccount,
    opposingLedgerIdOrNarration?: string,
    narrationOverride?: string
  ): Promise<Voucher> {
    const txId = typeof entryOrId === 'string' ? entryOrId : entryOrId.id;
    const opposingLedgerId = typeof opposingOrBankAccount === 'string'
      ? opposingOrBankAccount
      : (opposingLedgerIdOrNarration || '');
    const finalNarration = typeof opposingOrBankAccount === 'string'
      ? opposingLedgerIdOrNarration
      : narrationOverride;

    return this.postBankEntryAsVoucher(txId, opposingLedgerId, finalNarration);
  }

  // 4. Manual Match / Unmatch
  public async manualMatch(bankTransactionId: string, voucherId: string): Promise<void> {
    const bankTxs = await dbStorage.getBankTransactions();
    const tx = bankTxs.find((t) => t.id === bankTransactionId);
    if (!tx) throw new Error('Bank transaction not found.');

    tx.reconciliationStatus = 'MANUALLY_MATCHED';
    tx.matchedVoucherId = voucherId;
    tx.matchedDate = new Date().toISOString().split('T')[0];
    tx.matchScore = 100;

    await dbStorage.saveBankTransaction(tx);
    await dbStorage.logAudit('RECONCILE', 'BANK_TRANSACTION', tx.id, `Manually matched bank transaction ${tx.narration} with voucher ${voucherId}`);
  }

  public async unmatch(bankTransactionId: string): Promise<void> {
    const bankTxs = await dbStorage.getBankTransactions();
    const tx = bankTxs.find((t) => t.id === bankTransactionId);
    if (!tx) throw new Error('Bank transaction not found.');

    tx.reconciliationStatus = 'UNMATCHED';
    tx.matchedVoucherId = undefined;
    tx.matchedDate = undefined;
    tx.matchScore = undefined;

    await dbStorage.saveBankTransaction(tx);
    await dbStorage.logAudit('RECONCILE', 'BANK_TRANSACTION', tx.id, `Unmatched bank transaction ${tx.narration}`);
  }

  // 5. Post Unmatched Bank Entry Directly as Voucher
  public async postBankEntryAsVoucher(
    bankTransactionId: string,
    opposingLedgerId: string,
    narrationOverride?: string
  ): Promise<Voucher> {
    const bankTxs = await dbStorage.getBankTransactions();
    const tx = bankTxs.find((t) => t.id === bankTransactionId);
    if (!tx) throw new Error('Bank transaction not found.');
    if (tx.reconciliationStatus === 'POSTED') throw new Error('This bank transaction is already posted.');

    const bankAccounts = await dbStorage.getBankAccounts();
    const bankAcc = bankAccounts.find((b) => b.id === tx.bankAccountId);
    if (!bankAcc) throw new Error('Bank account not found.');

    const ledgers = await dbStorage.getLedgers();
    const opposingLedger = ledgers.find((l) => l.id === opposingLedgerId);
    if (!opposingLedger) throw new Error('Selected opposing ledger not found.');

    const bankLedger = ledgers.find((l) => l.id === bankAcc.ledgerId);
    if (!bankLedger) throw new Error('Bank ledger not found.');

    // If Bank Statement is CREDIT (Deposit) -> Bank Dr, Opposing Cr (Receipt)
    // If Bank Statement is DEBIT (Withdrawal) -> Opposing Dr, Bank Cr (Payment)
    const isCreditDeposit = tx.type === 'CREDIT';
    const voucherType = isCreditDeposit ? 'RECEIPT' : 'PAYMENT';
    const voucherNo = `${isCreditDeposit ? 'BNK-RCT' : 'BNK-PYM'}/${tx.date.replace(/-/g, '')}/${Math.floor(Math.random() * 1000)}`;

    const lines = isCreditDeposit
      ? [
          {
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: bankLedger.id,
            ledgerName: bankLedger.name,
            type: 'DR' as const,
            amount: tx.amount,
            narration: tx.narration,
          },
          {
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: opposingLedger.id,
            ledgerName: opposingLedger.name,
            type: 'CR' as const,
            amount: tx.amount,
            narration: narrationOverride || tx.narration,
          },
        ]
      : [
          {
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: opposingLedger.id,
            ledgerName: opposingLedger.name,
            type: 'DR' as const,
            amount: tx.amount,
            narration: narrationOverride || tx.narration,
          },
          {
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: bankLedger.id,
            ledgerName: bankLedger.name,
            type: 'CR' as const,
            amount: tx.amount,
            narration: tx.narration,
          },
        ];

    const voucher = await accountingEngine.postVoucher({
      uuid: uuidv4(),
      voucherNumber: voucherNo,
      voucherType,
      date: tx.date,
      companyId: tx.companyId,
      fiscalYearId: tx.fiscalYearId,
      narration: narrationOverride || `Posted from Bank Statement: ${tx.narration}`,
      referenceNo: tx.referenceNo || tx.chequeNo,
      lines,
      totalDebit: tx.amount,
      totalCredit: tx.amount,
      status: 'POSTED',
      bankTransactionId: tx.id,
      deviceId: 'BROWSER-LOCAL-01',
      syncStatus: 'PENDING',
    });

    // Mark statement line as POSTED and MATCHED
    tx.reconciliationStatus = 'POSTED';
    tx.postedVoucherId = voucher.id;
    tx.matchedVoucherId = voucher.id;
    tx.matchedDate = tx.date;
    await dbStorage.saveBankTransaction(tx);

    await dbStorage.logAudit(
      'POST',
      'BANK_TRANSACTION',
      tx.id,
      `Posted bank entry ${tx.narration} (₹${tx.amount}) to voucher ${voucher.voucherNumber}`
    );

    return voucher;
  }

  // 6. Get Comprehensive Reconciliation Summary
  public async getReconciliationSummary(bankAccountId: string, asOfDate?: string): Promise<BankReconciliationSummary | null> {
    const bankAccounts = await dbStorage.getBankAccounts();
    const bankAcc = bankAccounts.find((b) => b.id === bankAccountId);
    if (!bankAcc) return null;

    const ledgers = await dbStorage.getLedgers();
    const bankLedger = ledgers.find((l) => l.id === bankAcc.ledgerId);

    const ledgerSummary = bankLedger ? await accountingEngine.getLedgerSummary(bankLedger.id, undefined, asOfDate) : null;
    const bankBookBalance = ledgerSummary ? (ledgerSummary.closingBalanceType === 'DR' ? ledgerSummary.closingBalance : -ledgerSummary.closingBalance) : 0;

    const allBankTxs = await dbStorage.getBankTransactions();
    const bankTxs = allBankTxs.filter((t) => t.bankAccountId === bankAccountId && (!asOfDate || t.date <= asOfDate));

    const matchedTxs = bankTxs.filter((t) => t.reconciliationStatus === 'MATCHED' || t.reconciliationStatus === 'MANUALLY_MATCHED' || t.reconciliationStatus === 'POSTED');
    const unmatchedStatementTxs = bankTxs.filter((t) => t.reconciliationStatus === 'UNMATCHED');

    const matchedAmount = matchedTxs.reduce((s, t) => s + t.amount, 0);
    const unmatchedStatementAmount = unmatchedStatementTxs.reduce((s, t) => (t.type === 'CREDIT' ? s + t.amount : s - t.amount), 0);

    // Latest statement balance from imported rows
    const latestTxWithBalance = [...bankTxs].reverse().find((t) => t.balance !== undefined && t.balance !== null);
    const bankStatementBalance = latestTxWithBalance?.balance ?? bankBookBalance;

    // Check unmatched book vouchers
    const allVouchers = await dbStorage.getVouchers();
    const postedBookVouchers = allVouchers.filter((v) => v.status === 'POSTED' && (!asOfDate || v.date <= asOfDate));
    const unmatchedBookVouchers = postedBookVouchers.filter((v) => {
      const touchesBank = v.lines.some((l) => l.ledgerId === bankAcc.ledgerId);
      if (!touchesBank) return false;
      const isMatchedInStmt = matchedTxs.some((mt) => mt.matchedVoucherId === v.id);
      return !isMatchedInStmt;
    });

    let chequesIssuedNotPresented = 0;
    let chequesDepositedNotCleared = 0;

    for (const v of unmatchedBookVouchers) {
      const bankLine = v.lines.find((l) => l.ledgerId === bankAcc.ledgerId);
      if (bankLine) {
        if (bankLine.type === 'CR') {
          // Payment made in books, not yet debited in bank
          chequesIssuedNotPresented += Number(bankLine.amount);
        } else if (bankLine.type === 'DR') {
          // Receipt in books, not yet credited in bank
          chequesDepositedNotCleared += Number(bankLine.amount);
        }
      }
    }

    const adjustedBookBalance = bankBookBalance + chequesIssuedNotPresented - chequesDepositedNotCleared;
    const difference = Math.round((adjustedBookBalance - bankStatementBalance) * 100) / 100;

    return {
      bankAccount: bankAcc,
      bankLedger,
      bankBookBalance,
      bankStatementBalance,
      matchedCount: matchedTxs.length,
      matchedAmount,
      unmatchedStatementCount: unmatchedStatementTxs.length,
      unmatchedStatementAmount,
      unmatchedBookCount: unmatchedBookVouchers.length,
      unmatchedBookAmount: chequesIssuedNotPresented + chequesDepositedNotCleared,
      chequesIssuedNotPresented,
      chequesDepositedNotCleared,
      difference,
      isReconciled: Math.abs(difference) < 0.05,
    };
  }
}

export const bankingEngine = new BankingEngine();
