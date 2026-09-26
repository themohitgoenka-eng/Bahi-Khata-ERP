import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { bankingEngine, BankReconciliationSummary } from '../../services/bankingEngine';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { brsRuleService } from '../../services/brsRuleService';
import { generateSampleBrsTransactions } from '../../services/sampleBrsData';
import { ExportEngine } from '../../services/exportEngine';
import { BankAccount, BankStatementTransaction, Ledger, Voucher } from '../../types';
import { BankStatementImportModal } from './BankStatementImportModal';
import { BankEntryPostingModal } from './BankEntryPostingModal';
import { BrsRuleModal } from './BrsRuleModal';
import { QuickCreateLedgerModal } from './QuickCreateLedgerModal';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Search,
  UploadCloud,
  FileSpreadsheet,
  FileDown,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Check,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

export const BankReconciliationView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    bankAccounts,
    ledgers,
    showNotification,
    refreshActiveData,
    setActiveTab,
  } = useApp();

  // Bank Account Selection
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const selectedBankAccount = useMemo(() => {
    return bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;
  }, [bankAccounts, selectedBankId]);

  useEffect(() => {
    if (bankAccounts.length > 0) {
      if (!selectedBankId || !bankAccounts.some((b) => b.id === selectedBankId)) {
        setSelectedBankId(bankAccounts[0].id);
      }
    } else {
      setSelectedBankId('');
    }
  }, [bankAccounts, selectedBankId]);

  // Main Data States
  const [statementTransactions, setStatementTransactions] = useState<BankStatementTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '2026-04-01',
    end: '2026-08-11',
  });

  // Selected rows for bulk operations
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Filter & Search states (matching image search row)
  const [searchDate, setSearchDate] = useState('');
  const [searchDesc, setSearchDesc] = useState('');
  const [searchType, setSearchType] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [searchSuggested, setSearchSuggested] = useState('');
  const [searchSelectedLedger, setSearchSelectedLedger] = useState('');

  // Tab Filtering: 'ALL' | 'DUPLICATE' | 'POSTED' | 'UNPOSTED' | 'BLANK'
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'DUPLICATE' | 'POSTED' | 'UNPOSTED' | 'BLANK'>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'amount' | 'narration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [pageSize, setPageSize] = useState<number>(500);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [postingEntry, setPostingEntry] = useState<BankStatementTransaction | null>(null);
  const [quickLedgerTargetRowId, setQuickLedgerTargetRowId] = useState<string | null>(null);
  const [quickLedgerInitialName, setQuickLedgerInitialName] = useState<string>('');

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [inlineDate, setInlineDate] = useState<string>('');
  const [inlineDesc, setInlineDesc] = useState<string>('');

  // Load statement transactions
  const loadTransactions = useCallback(async () => {
    if (!selectedBankAccount || !currentCompany || !currentFiscalYear) {
      setStatementTransactions([]);
      return;
    }
    setLoading(true);
    try {
      let allTx = await dbStorage.getBankTransactions();
      let currentBankTx = allTx.filter((t) => t.bankAccountId === selectedBankAccount.id);

      // If bank has no transactions yet, initialize with rich realistic dataset
      if (currentBankTx.length === 0) {
        const sampleData = generateSampleBrsTransactions(
          selectedBankAccount.id,
          currentCompany.id,
          currentFiscalYear.id
        );
        for (const item of sampleData) {
          await dbStorage.saveBankTransaction(item);
        }
        currentBankTx = sampleData;
      }

      // Auto compute suggested ledgers & selected ledgers using rules
      const rules = brsRuleService.getRules(currentCompany.id);
      let updatedCount = 0;

      for (const tx of currentBankTx) {
        if (!tx.suggestedLedgerName || !tx.transactionType) {
          const rawType = tx.type === 'DEBIT' ? 'Payment' : 'Receipt';
          tx.transactionType = tx.transactionType || rawType;
          const matchResult = brsRuleService.extractSuggestedLedger(
            tx.narration || tx.description || '',
            rawType,
            ledgers,
            rules
          );

          if (!tx.suggestedLedgerName) {
            tx.suggestedLedgerName = matchResult.suggestedName;
          }
          if (matchResult.matchedLedger && !tx.selectedLedgerName) {
            tx.selectedLedgerId = matchResult.matchedLedger.id;
            tx.selectedLedgerName = matchResult.matchedLedger.name;
          }
          updatedCount++;
        }
      }

      setStatementTransactions(currentBankTx);
    } catch (err) {
      console.error('Failed to load bank statement transactions:', err);
      showNotification('Error loading BRS records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBankAccount, currentCompany, currentFiscalYear, ledgers, showNotification]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Apply Rules to all statement rows
  const handleApplyRules = async () => {
    if (!currentCompany) return;
    const rules = brsRuleService.getRules(currentCompany.id);
    let modified = 0;

    const updated = statementTransactions.map((tx) => {
      if (tx.reconciliationStatus === 'POSTED') return tx;
      const type = tx.transactionType || (tx.type === 'DEBIT' ? 'Payment' : 'Receipt');
      const match = brsRuleService.extractSuggestedLedger(tx.narration || '', type, ledgers, rules);

      let newSelected = tx.selectedLedgerName;
      let newSelectedId = tx.selectedLedgerId;

      if (match.matchedLedger) {
        newSelected = match.matchedLedger.name;
        newSelectedId = match.matchedLedger.id;
      } else if (match.suggestedName && !newSelected) {
        newSelected = match.suggestedName.toUpperCase();
      }

      if (newSelected !== tx.selectedLedgerName || match.suggestedName !== tx.suggestedLedgerName) {
        modified++;
        const newTx: BankStatementTransaction = {
          ...tx,
          suggestedLedgerName: match.suggestedName || tx.suggestedLedgerName,
          selectedLedgerName: newSelected,
          selectedLedgerId: newSelectedId,
        };
        dbStorage.saveBankTransaction(newTx);
        return newTx;
      }
      return tx;
    });

    setStatementTransactions(updated);
    showNotification(
      modified > 0
        ? `Applied BRS automation rules to ${modified} statement transactions!`
        : 'Rules evaluated. All records are up to date.',
      'success'
    );
  };

  // Quick Apply Suggested Ledger to Row
  const handleApplySuggestion = async (row: BankStatementTransaction) => {
    if (!row.suggestedLedgerName) return;
    const matched =
      ledgers.find((l) => l.name.toLowerCase() === row.suggestedLedgerName?.toLowerCase()) ||
      ledgers.find((l) => l.name.toLowerCase().includes(row.suggestedLedgerName?.toLowerCase() || ''));

    const updatedRow: BankStatementTransaction = {
      ...row,
      selectedLedgerName: matched ? matched.name : row.suggestedLedgerName.toUpperCase(),
      selectedLedgerId: matched?.id || row.selectedLedgerId,
    };

    await dbStorage.saveBankTransaction(updatedRow);
    setStatementTransactions((prev) => prev.map((t) => (t.id === row.id ? updatedRow : t)));
    showNotification(`Assigned suggested ledger to "${row.narration.slice(0, 20)}..."`, 'info');
  };

  // Change Ledger Selection
  const handleSelectLedger = async (row: BankStatementTransaction, ledgerId: string) => {
    const chosen = ledgers.find((l) => l.id === ledgerId);
    const updatedRow: BankStatementTransaction = {
      ...row,
      selectedLedgerId: chosen?.id || '',
      selectedLedgerName: chosen?.name || '',
    };
    await dbStorage.saveBankTransaction(updatedRow);
    setStatementTransactions((prev) => prev.map((t) => (t.id === row.id ? updatedRow : t)));
  };

  // Change Transaction Type (Payment / Receipt / Contra)
  const handleChangeType = async (row: BankStatementTransaction, newType: 'Payment' | 'Receipt' | 'Contra') => {
    const updatedRow: BankStatementTransaction = {
      ...row,
      transactionType: newType,
      type: newType === 'Payment' ? 'DEBIT' : 'CREDIT',
    };
    await dbStorage.saveBankTransaction(updatedRow);
    setStatementTransactions((prev) => prev.map((t) => (t.id === row.id ? updatedRow : t)));
  };

  // Save Inline Edit (Date / Description)
  const handleSaveInlineEdit = async (row: BankStatementTransaction) => {
    const updatedRow: BankStatementTransaction = {
      ...row,
      date: inlineDate || row.date,
      narration: inlineDesc || row.narration,
      description: inlineDesc || row.description,
    };
    await dbStorage.saveBankTransaction(updatedRow);
    setStatementTransactions((prev) => prev.map((t) => (t.id === row.id ? updatedRow : t)));
    setEditingRowId(null);
    showNotification('Statement transaction updated.', 'success');
  };

  // Quick Post Single Entry
  const handleQuickPostRow = async (row: BankStatementTransaction) => {
    if (!selectedBankAccount) return;

    let targetLedger = ledgers.find((l) => l.id === row.selectedLedgerId);
    if (!targetLedger && row.selectedLedgerName) {
      targetLedger = ledgers.find(
        (l) => l.name.toLowerCase() === row.selectedLedgerName?.toLowerCase()
      );
    }

    if (!targetLedger) {
      // Open modal to select or create ledger
      setPostingEntry(row);
      return;
    }

    try {
      await bankingEngine.postBankEntryAsVoucher(
        row.id,
        targetLedger.id,
        row.narration || row.description
      );
      showNotification(
        `Posted voucher for ₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} &rarr; ${targetLedger.name}`,
        'success'
      );
      await loadTransactions();
      await refreshActiveData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to post voucher.', 'error');
    }
  };

  // Bulk Post Selected
  const handleBulkPostSelected = async () => {
    if (selectedRowIds.size === 0 || !selectedBankAccount) return;
    let postedCount = 0;
    let skippedCount = 0;

    for (const txId of selectedRowIds) {
      const tx = statementTransactions.find((t) => t.id === txId);
      if (!tx || tx.reconciliationStatus === 'POSTED') continue;

      let targetLedger = ledgers.find((l) => l.id === tx.selectedLedgerId);
      if (!targetLedger && tx.selectedLedgerName) {
        targetLedger = ledgers.find(
          (l) => l.name.toLowerCase() === tx.selectedLedgerName?.toLowerCase()
        );
      }

      if (targetLedger) {
        try {
          await bankingEngine.postBankEntryAsVoucher(tx.id, targetLedger.id, tx.narration);
          postedCount++;
        } catch {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    showNotification(
      `Bulk Posted ${postedCount} vouchers! ${
        skippedCount > 0 ? `(${skippedCount} skipped due to unassigned ledger)` : ''
      }`,
      postedCount > 0 ? 'success' : 'info'
    );
    setSelectedRowIds(new Set());
    await loadTransactions();
    await refreshActiveData();
  };

  // Bulk Apply Suggested Ledgers
  const handleBulkApplySuggestions = async () => {
    let updatedCount = 0;
    const updated = statementTransactions.map((tx) => {
      if (selectedRowIds.has(tx.id) && tx.suggestedLedgerName) {
        const matched = ledgers.find(
          (l) => l.name.toLowerCase() === tx.suggestedLedgerName?.toLowerCase()
        );
        updatedCount++;
        const newTx = {
          ...tx,
          selectedLedgerName: matched ? matched.name : tx.suggestedLedgerName.toUpperCase(),
          selectedLedgerId: matched?.id || tx.selectedLedgerId,
        };
        dbStorage.saveBankTransaction(newTx);
        return newTx;
      }
      return tx;
    });

    setStatementTransactions(updated);
    showNotification(`Applied suggested ledgers to ${updatedCount} selected rows.`, 'success');
  };

  // Bulk Delete Selected
  const handleBulkDeleteSelected = async () => {
    if (selectedRowIds.size === 0) return;
    for (const id of selectedRowIds) {
      await dbStorage.deleteBankTransaction(id);
    }
    setStatementTransactions((prev) => prev.filter((t) => !selectedRowIds.has(t.id)));
    setSelectedRowIds(new Set());
    showNotification('Deleted selected statement transactions.', 'info');
  };

  // Single Row Delete
  const handleDeleteRow = async (rowId: string) => {
    await dbStorage.deleteBankTransaction(rowId);
    setStatementTransactions((prev) => prev.filter((t) => t.id !== rowId));
    showNotification('Statement transaction removed.', 'info');
  };

  // Filter calculations
  const filteredTransactions = useMemo(() => {
    return statementTransactions.filter((tx) => {
      // Tab filter
      if (activeFilterTab === 'POSTED' && tx.reconciliationStatus !== 'POSTED') return false;
      if (activeFilterTab === 'UNPOSTED' && tx.reconciliationStatus === 'POSTED') return false;
      if (activeFilterTab === 'BLANK' && (tx.selectedLedgerName || tx.selectedLedgerId)) return false;
      if (activeFilterTab === 'DUPLICATE') return false; // In standard mode, duplicates are 0

      // Inline column search filters
      if (searchDate && !tx.date.includes(searchDate) && !formatDateDisplay(tx.date).includes(searchDate)) {
        return false;
      }
      if (searchDesc && !(tx.narration || tx.description || '').toLowerCase().includes(searchDesc.toLowerCase())) {
        return false;
      }
      if (searchType) {
        const typeStr = (tx.transactionType || (tx.type === 'DEBIT' ? 'Payment' : 'Receipt')).toLowerCase();
        if (!typeStr.includes(searchType.toLowerCase())) return false;
      }
      if (amountFrom && tx.amount < parseFloat(amountFrom)) return false;
      if (amountTo && tx.amount > parseFloat(amountTo)) return false;

      if (searchSuggested && !(tx.suggestedLedgerName || '').toLowerCase().includes(searchSuggested.toLowerCase())) {
        return false;
      }
      if (searchSelectedLedger && !(tx.selectedLedgerName || '').toLowerCase().includes(searchSelectedLedger.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [
    statementTransactions,
    activeFilterTab,
    searchDate,
    searchDesc,
    searchType,
    amountFrom,
    amountTo,
    searchSuggested,
    searchSelectedLedger,
  ]);

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (sortField === 'date') {
        const diff = a.date.localeCompare(b.date);
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortField === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      if (sortField === 'narration') {
        const diff = (a.narration || '').localeCompare(b.narration || '');
        return sortOrder === 'asc' ? diff : -diff;
      }
      return 0;
    });
  }, [filteredTransactions, sortField, sortOrder]);

  // Totals calculations
  const totalReceipts = useMemo(() => {
    const receipts = statementTransactions.filter(
      (t) => t.type === 'CREDIT' || t.transactionType === 'Receipt'
    );
    const amount = receipts.reduce((sum, t) => sum + t.amount, 0);
    return { amount, count: receipts.length };
  }, [statementTransactions]);

  const totalPayments = useMemo(() => {
    const payments = statementTransactions.filter(
      (t) => t.type === 'DEBIT' || t.transactionType === 'Payment'
    );
    const amount = payments.reduce((sum, t) => sum + t.amount, 0);
    return { amount, count: payments.length };
  }, [statementTransactions]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const all = statementTransactions.length;
    const posted = statementTransactions.filter((t) => t.reconciliationStatus === 'POSTED').length;
    const unposted = statementTransactions.filter((t) => t.reconciliationStatus !== 'POSTED').length;
    const blank = statementTransactions.filter((t) => !t.selectedLedgerName && !t.selectedLedgerId).length;
    return { all, duplicate: 0, posted, unposted, blank };
  }, [statementTransactions]);

  // Paginated rows
  const paginatedTransactions = useMemo(() => {
    if (pageSize === 0) return sortedTransactions;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(startIndex, startIndex + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedTransactions.length / pageSize) || 1;

  // Keyboard navigation for Bank Reconciliation table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: paginatedTransactions.length,
    tableId: 'brs-transactions-table',
    enabled: !isRuleModalOpen && !postingEntry && !isImportModalOpen,
  });

  // Toggle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedTransactions.map((t) => t.id));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleRowSelect = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  // Handle Export
  const handleExport = (format: 'xlsx' | 'pdf' = 'xlsx') => {
    if (statementTransactions.length === 0 || !currentCompany || !currentFiscalYear) {
      showNotification('No transactions available to export.', 'info');
      return;
    }
    const columns = [
      { header: 'Sr No', dataKey: 'srNo', align: 'center' as const },
      { header: 'Transaction Date', dataKey: 'date', align: 'center' as const },
      { header: 'Description / Narration', dataKey: 'narration', align: 'left' as const },
      { header: 'Type', dataKey: 'type', align: 'center' as const },
      { header: 'Amount (INR)', dataKey: 'amount', align: 'right' as const },
      { header: 'Suggested Ledger', dataKey: 'suggestedLedger', align: 'left' as const },
      { header: 'Selected Ledger', dataKey: 'selectedLedger', align: 'left' as const },
      { header: 'Status', dataKey: 'status', align: 'center' as const },
    ];
    const data = statementTransactions.map((t, idx) => ({
      srNo: idx + 1,
      date: formatDateDisplay(t.date),
      narration: t.narration || t.description || '',
      type: t.transactionType || (t.type === 'DEBIT' ? 'Payment' : 'Receipt'),
      amount: t.amount,
      suggestedLedger: t.suggestedLedgerName || '',
      selectedLedger: t.selectedLedgerName || '',
      status: t.reconciliationStatus === 'POSTED' ? 'Posted' : 'Unposted',
    }));

    const options = {
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Bank Reconciliation Statement - ${selectedBankAccount?.bankName || 'Account'}`,
      subtitle: `Total Receipts: ₹${totalReceipts.amount.toFixed(2)} | Total Payments: ₹${totalPayments.amount.toFixed(2)}`,
      columns,
      data,
      filenamePrefix: `brs_${selectedBankAccount?.bankName || 'bank'}`,
    };

    if (format === 'xlsx') {
      ExportEngine.exportToExcel(options);
    } else {
      ExportEngine.exportToPdf(options);
    }
    showNotification(`Exported BRS statement as ${format.toUpperCase()}`, 'success');
  };

  return (
    <div className="w-full bg-slate-950 min-h-screen text-slate-100 font-sans pb-16 flex flex-col">
      {/* Top Outer Card Container */}
      <div className="max-w-[1650px] w-full mx-auto p-3 sm:p-5 space-y-4 flex-1 flex flex-col">
        {/* TOP CONTROLS & SUMMARY BAR */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Left: Bulk Actions + Date Range + Note */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-extrabold text-white tracking-tight uppercase px-2 py-1 bg-purple-950/80 border border-purple-800/60 rounded-lg text-purple-300">
                Bulk Actions
              </span>

              {/* Date Range Box */}
              <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-inner">
                <input
                  type="text"
                  value={`${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`}
                  onChange={() => {}}
                  readOnly
                  className="text-xs font-semibold text-slate-200 w-44 bg-transparent focus:outline-hidden cursor-default text-center font-mono"
                />
              </div>

              {/* Note Textarea */}
              <div className="relative">
                <textarea
                  rows={1}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Reconciliation Note..."
                  className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-48 sm:w-64 resize-none shadow-inner h-[34px]"
                />
              </div>
            </div>

            {/* Middle: Summary Cards (Total Receipt & Total Payment) */}
            <div className="flex items-center gap-3">
              {/* Total Receipt Card (Dark Emerald) */}
              <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-800/70 rounded-xl px-4 py-2 shadow-lg min-w-[175px]">
                <div className="w-8 h-8 rounded-full bg-emerald-900/70 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">
                    Total Receipt
                  </div>
                  <div className="text-sm font-black text-emerald-400 font-mono leading-tight">
                    ₹ {totalReceipts.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {totalReceipts.count} Transactions
                  </div>
                </div>
              </div>

              {/* Total Payment Card (Dark Rose) */}
              <div className="flex items-center gap-3 bg-rose-950/40 border border-rose-800/70 rounded-xl px-4 py-2 shadow-lg min-w-[175px]">
                <div className="w-8 h-8 rounded-full bg-rose-900/70 border border-rose-600/50 flex items-center justify-center text-rose-400 shrink-0">
                  <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-rose-400/80 tracking-wider">
                    Total Payment
                  </div>
                  <div className="text-sm font-black text-rose-400 font-mono leading-tight">
                    ₹ {totalPayments.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {totalPayments.count} Transactions
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Bank Selector + Rule Button + Export Dropdown */}
            <div className="flex items-center gap-2.5">
              {/* Bank Selector with floating Label */}
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-slate-900 px-1 text-[10px] font-bold text-purple-400 tracking-wide z-10">
                  Bank
                </span>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-purple-500 appearance-none pr-8 cursor-pointer shadow-inner min-w-[180px]"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                      {b.bankName} {b.accountType ? `- (${b.accountType.slice(0, 2)})` : ''}
                    </option>
                  ))}
                  {bankAccounts.length === 0 && (
                    <option value="" className="bg-slate-900 text-slate-100">KOTAK A/C - (OD)</option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Rule Button (Royal Purple) */}
              <button
                onClick={() => setIsRuleModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-purple-950/60 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Rule
              </button>

              {/* Export Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleExport('pdf')}
                  title="Export BRS to PDF"
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <PdfFileIcon className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleExport('xlsx')}
                  title="Export BRS to Excel"
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <ExcelFileIcon className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>

              {/* Import Statement & Sample Controls */}
              <button
                onClick={() => setIsImportModalOpen(true)}
                title="Import CSV/Excel Statement"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
              </button>

              <button
                onClick={loadTransactions}
                title="Refresh Statement Transactions"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* BULK ACTION ACTION BAR (When items are checked) */}
        {selectedRowIds.size > 0 && (
          <div className="bg-purple-950/90 border border-purple-700/70 text-white rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-md animate-fadeIn">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <span className="bg-purple-600 text-white px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                {selectedRowIds.size}
              </span>
              <span>Transactions Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPostSelected}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Post Selected as Vouchers
              </button>
              <button
                onClick={handleBulkApplySuggestions}
                className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Apply Suggestions
              </button>
              <button
                onClick={handleBulkDeleteSelected}
                className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* MAIN BRS TABLE CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              {/* PRIMARY TABLE HEADER (Deep Royal Purple) */}
              <thead>
                <tr className="bg-[#3b126d] text-white font-bold text-[10.5px] leading-tight border-b border-purple-900">
                  {/* Select All Checkbox */}
                  <th className="py-0.5 px-2.5 w-10 text-center border-r border-purple-800/50">
                    <input
                      type="checkbox"
                      checked={
                        paginatedTransactions.length > 0 &&
                        paginatedTransactions.every((t) => selectedRowIds.has(t.id))
                      }
                      onChange={handleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-purple-600 cursor-pointer"
                    />
                  </th>
                  {/* Sr No. */}
                  <th className="py-0.5 px-2.5 w-14 text-center border-r border-purple-800/50 whitespace-nowrap">
                    Sr No.
                  </th>
                  {/* Transaction Date */}
                  <th
                    onClick={() => {
                      setSortField('date');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="py-0.5 px-2.5 w-32 border-r border-purple-800/50 whitespace-nowrap cursor-pointer hover:bg-purple-950 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Transaction Date
                      <span className="text-[10px] opacity-75">{sortField === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
                    </div>
                  </th>
                  {/* Description */}
                  <th
                    onClick={() => {
                      setSortField('narration');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="py-0.5 px-2.5 border-r border-purple-800/50 whitespace-nowrap cursor-pointer hover:bg-purple-950 transition-colors min-w-[240px]"
                  >
                    Description
                  </th>
                  {/* Transaction Type */}
                  <th className="py-0.5 px-2.5 w-28 border-r border-purple-800/50 whitespace-nowrap">
                    Transaction Type
                  </th>
                  {/* Amount */}
                  <th
                    onClick={() => {
                      setSortField('amount');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="py-0.5 px-2.5 w-36 border-r border-purple-800/50 whitespace-nowrap cursor-pointer hover:bg-purple-950 transition-colors"
                  >
                    <div className="flex items-center gap-1 justify-end">
                      Amount ↑↓
                    </div>
                  </th>
                  {/* Suggested Ledger */}
                  <th className="py-0.5 px-2.5 border-r border-purple-800/50 whitespace-nowrap min-w-[180px]">
                    Suggested Ledger
                  </th>
                  {/* Selected Ledger */}
                  <th className="py-0.5 px-2.5 border-r border-purple-800/50 whitespace-nowrap min-w-[220px]">
                    Selected Ledger
                  </th>
                  {/* Actions */}
                  <th className="py-0.5 px-2.5 w-20 text-center whitespace-nowrap">
                    Actions
                  </th>
                </tr>

                {/* INLINE SEARCH & FILTER ROW (Directly below purple header) */}
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300 text-[11px]">
                  {/* Checkbox Col */}
                  <td className="p-1.5 border-r border-slate-800 text-center"></td>
                  {/* Sr No Col */}
                  <td className="p-1.5 border-r border-slate-800 text-center"></td>
                  {/* Date Search */}
                  <td className="p-1.5 border-r border-slate-800">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchDate}
                        onChange={(e) => {
                          setSearchDate(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search Date"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                      />
                    </div>
                  </td>
                  {/* Description Search */}
                  <td className="p-1.5 border-r border-slate-800">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchDesc}
                        onChange={(e) => {
                          setSearchDesc(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search Narration"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                      />
                    </div>
                  </td>
                  {/* Transaction Type Search */}
                  <td className="p-1.5 border-r border-slate-800">
                    <input
                      type="text"
                      value={searchType}
                      onChange={(e) => {
                        setSearchType(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </td>
                  {/* Amount Range Filter */}
                  <td className="p-1.5 border-r border-slate-800">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={amountFrom}
                        onChange={(e) => {
                          setAmountFrom(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="From"
                        className="w-1/2 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-mono"
                      />
                      <input
                        type="number"
                        value={amountTo}
                        onChange={(e) => {
                          setAmountTo(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="To"
                        className="w-1/2 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-mono"
                      />
                    </div>
                  </td>
                  {/* Suggested Ledger Search */}
                  <td className="p-1.5 border-r border-slate-800">
                    <input
                      type="text"
                      value={searchSuggested}
                      onChange={(e) => {
                        setSearchSuggested(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search Suggested"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </td>
                  {/* Selected Ledger Search */}
                  <td className="p-1.5 border-r border-slate-800">
                    <input
                      type="text"
                      value={searchSelectedLedger}
                      onChange={(e) => {
                        setSearchSelectedLedger(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search Ledger"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </td>
                  {/* Actions / Reset */}
                  <td className="p-1.5 text-center">
                    {(searchDate || searchDesc || searchType || amountFrom || amountTo || searchSuggested || searchSelectedLedger) && (
                      <button
                        onClick={() => {
                          setSearchDate('');
                          setSearchDesc('');
                          setSearchType('');
                          setAmountFrom('');
                          setAmountTo('');
                          setSearchSuggested('');
                          setSearchSelectedLedger('');
                        }}
                        title="Clear all search filters"
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              </thead>

              {/* TABLE BODY (Row Items with subtle dark green tint for posted) */}
              <tbody className="divide-y divide-slate-800/80">
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-500">
                      <Database className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                      <p className="font-semibold text-slate-300 text-sm">No statement transactions found matching criteria</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try resetting filters, importing a new statement, or clicking the refresh button.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx, idx) => {
                    const srNo = (currentPage - 1) * pageSize + idx + 1;
                    const isPosted = tx.reconciliationStatus === 'POSTED';
                    const isRowSelected = selectedRowIds.has(tx.id);
                    const isEditing = editingRowId === tx.id;
                    const currentType = tx.transactionType || (tx.type === 'DEBIT' ? 'Payment' : 'Receipt');
                    const isSelected = idx === selectedIndex;

                    return (
                      <tr
                        key={tx.id}
                        data-table-id="brs-transactions-table"
                        data-row-idx={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                            : isRowSelected
                            ? 'bg-purple-950/50 text-white'
                            : isPosted
                            ? 'bg-emerald-950/25 hover:bg-emerald-950/40 text-slate-100'
                            : 'bg-slate-900/60 hover:bg-slate-800/70 text-slate-200'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-2 text-center border-r border-slate-800/70">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => handleToggleRowSelect(tx.id)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-purple-600 cursor-pointer"
                          />
                        </td>

                        {/* Sr No. */}
                        <td className="p-2 text-center text-slate-400 font-mono font-medium border-r border-slate-800/70">
                          {srNo}
                        </td>

                        {/* Transaction Date */}
                        <td className="p-2 border-r border-slate-800/70 whitespace-nowrap min-w-[140px]">
                          {isEditing ? (
                            <DateInput
                              value={inlineDate}
                              onChange={setInlineDate}
                              size="sm"
                              showIcon={false}
                              className="bg-slate-950 border-purple-500"
                            />
                          ) : (
                            <div className="flex items-center justify-between group">
                              <span className="font-mono text-xs font-bold text-slate-200">
                                {formatDateDisplay(tx.date)}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingRowId(tx.id);
                                  setInlineDate(tx.date);
                                  setInlineDesc(tx.narration || tx.description || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-purple-400 transition-opacity"
                                title="Edit Date / Description"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Description */}
                        <td className="p-2 border-r border-slate-800/70 min-w-[240px]">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={inlineDesc}
                                onChange={(e) => setInlineDesc(e.target.value)}
                                className="w-full bg-slate-950 border border-purple-500 rounded px-2 py-0.5 text-xs text-white"
                              />
                              <button
                                onClick={() => handleSaveInlineEdit(tx)}
                                className="p-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px]"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingRowId(null)}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                              <span className="font-sans text-xs text-slate-300 break-words line-clamp-2 leading-relaxed font-medium">
                                {tx.narration || tx.description}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingRowId(tx.id);
                                  setInlineDate(tx.date);
                                  setInlineDesc(tx.narration || tx.description || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-purple-400 transition-opacity shrink-0 ml-1"
                                title="Edit Narration"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Transaction Type Dropdown */}
                        <td className="p-2 border-r border-slate-800/70">
                          <select
                            value={currentType}
                            onChange={(e) =>
                              handleChangeType(tx, e.target.value as 'Payment' | 'Receipt' | 'Contra')
                            }
                            className="bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-purple-500 cursor-pointer w-full font-medium"
                          >
                            <option value="Payment" className="bg-slate-900 text-rose-400">Payment</option>
                            <option value="Receipt" className="bg-slate-900 text-emerald-400">Receipt</option>
                            <option value="Contra" className="bg-slate-900 text-sky-400">Contra</option>
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="p-2 border-r border-slate-800/70 whitespace-nowrap text-right font-mono font-bold pr-3">
                          <span className={currentType === 'Receipt' ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.amount.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>

                        {/* Suggested Ledger (with orange + badge) */}
                        <td className="p-2 border-r border-slate-800/70">
                          {tx.suggestedLedgerName ? (
                            <div className="flex items-center justify-between gap-1 bg-slate-950/50 px-2 py-1 rounded border border-slate-800">
                              <span className="text-xs text-amber-300 truncate font-semibold">
                                {tx.suggestedLedgerName}
                              </span>
                              <button
                                onClick={() => handleApplySuggestion(tx)}
                                title="Apply this suggested ledger"
                                className="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black text-[12px] shrink-0 transition-transform active:scale-90 cursor-pointer shadow-sm"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px] italic">No suggestion</span>
                          )}
                        </td>

                        {/* Selected Ledger (with select dropdown, edit icon, + new ledger) */}
                        <td className="p-2 border-r border-slate-800/70">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={
                                tx.selectedLedgerId ||
                                ledgers.find((l) => l.name === tx.selectedLedgerName)?.id ||
                                ''
                              }
                              onChange={(e) => handleSelectLedger(tx, e.target.value)}
                              className="bg-slate-950 border border-slate-700/90 rounded px-2 py-1 text-xs text-slate-100 font-semibold focus:outline-hidden focus:border-purple-500 cursor-pointer flex-1 truncate max-w-[200px]"
                            >
                              <option value="" className="bg-slate-900 text-slate-500">-- Select Ledger --</option>
                              {ledgers.map((l) => (
                                <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                                  {l.name}
                                </option>
                              ))}
                            </select>

                            {/* Quick Create New Ledger Button */}
                            <button
                              onClick={() => {
                                setQuickLedgerTargetRowId(tx.id);
                                setQuickLedgerInitialName(
                                  tx.suggestedLedgerName
                                    ? tx.suggestedLedgerName.toUpperCase()
                                    : ''
                                );
                              }}
                              title="Create New Ledger Account on-the-fly"
                              className="p-1 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded transition-colors shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPosted ? (
                              <span
                                title="Posted & Reconciled with Ledger"
                                className="inline-flex items-center gap-0.5 text-emerald-300 font-bold text-[10px] bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded shadow-xs"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                Reconciled
                              </span>
                            ) : (
                              <button
                                onClick={() => handleQuickPostRow(tx)}
                                title="Post as Accounting Voucher"
                                className="p-1 text-purple-400 hover:text-white hover:bg-purple-600 rounded transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingRowId(tx.id);
                                setInlineDate(tx.date);
                                setInlineDesc(tx.narration || tx.description || '');
                              }}
                              title="Edit Entry"
                              className="p-1 text-slate-500 hover:text-slate-200 rounded transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => handleDeleteRow(tx.id)}
                              title="Delete Transaction"
                              className="p-1 text-rose-500/80 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER / PAGINATION BAR */}
          <div className="border-t border-slate-800 px-4 py-2.5 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-purple-500 cursor-pointer shadow-inner"
              >
                <option value={25} className="bg-slate-900">25</option>
                <option value={50} className="bg-slate-900">50</option>
                <option value={100} className="bg-slate-900">100</option>
                <option value={250} className="bg-slate-900">250</option>
                <option value={500} className="bg-slate-900">500</option>
                <option value={0} className="bg-slate-900">All</option>
              </select>
              <span className="text-slate-400 font-medium ml-2">
                Showing{' '}
                <span className="text-slate-200 font-semibold">
                  {sortedTransactions.length > 0
                    ? pageSize === 0
                      ? `1 to ${sortedTransactions.length}`
                      : `${(currentPage - 1) * pageSize + 1} to ${Math.min(
                          currentPage * pageSize,
                          sortedTransactions.length
                        )}`
                    : '0'}
                </span>{' '}
                of <span className="text-slate-200 font-semibold">{sortedTransactions.length}</span> results
              </span>
            </div>

            {/* Pagination Controls */}
            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 font-bold"
                >
                  &lt;
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 font-bold"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM TAB FILTER BAR & NAVIGATION */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Back Button */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer self-start active:scale-95"
          >
            ← Back
          </button>

          {/* Categorized Tab Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* All Transactions */}
            <button
              onClick={() => {
                setActiveFilterTab('ALL');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'ALL'
                  ? 'bg-purple-950/90 border-2 border-purple-500 text-purple-200 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              All Transactions ({tabCounts.all})
            </button>

            {/* Duplicate/Similar */}
            <button
              onClick={() => {
                setActiveFilterTab('DUPLICATE');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'DUPLICATE'
                  ? 'bg-amber-950/90 border-2 border-amber-500 text-amber-200 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              Duplicate/Similar ({tabCounts.duplicate})
            </button>

            {/* Posted Transactions (Emerald) */}
            <button
              onClick={() => {
                setActiveFilterTab('POSTED');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'POSTED'
                  ? 'bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 shadow-md'
                  : 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-400 border border-emerald-900/60'
              }`}
            >
              Posted Transactions ({tabCounts.posted})
            </button>

            {/* Unposted Transactions (Amber) */}
            <button
              onClick={() => {
                setActiveFilterTab('UNPOSTED');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'UNPOSTED'
                  ? 'bg-amber-950/90 border-2 border-amber-500 text-amber-200 shadow-md'
                  : 'bg-amber-950/30 hover:bg-amber-950/50 text-amber-400 border border-amber-900/60'
              }`}
            >
              Unposted Transactions ({tabCounts.unposted})
            </button>

            {/* Blank Transactions */}
            <button
              onClick={() => {
                setActiveFilterTab('BLANK');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'BLANK'
                  ? 'bg-slate-800 border-2 border-slate-500 text-slate-100 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              Blank Transactions ({tabCounts.blank})
            </button>
          </div>
        </div>
      </div>

      {/* BRS RULE MODAL */}
      {isRuleModalOpen && (
        <BrsRuleModal
          onClose={() => setIsRuleModalOpen(false)}
          onApplyRules={handleApplyRules}
        />
      )}

      {/* IMPORT STATEMENT MODAL */}
      {isImportModalOpen && selectedBankAccount && (
        <BankStatementImportModal
          bankAccount={selectedBankAccount}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            loadTransactions();
            refreshActiveData();
          }}
        />
      )}

      {/* POSTING DETAIL MODAL */}
      {postingEntry && selectedBankAccount && (
        <BankEntryPostingModal
          entry={postingEntry}
          bankAccount={selectedBankAccount}
          onClose={() => setPostingEntry(null)}
          onSuccess={() => {
            loadTransactions();
            refreshActiveData();
          }}
        />
      )}

      {/* QUICK CREATE LEDGER MODAL */}
      {quickLedgerTargetRowId && (
        <QuickCreateLedgerModal
          initialName={quickLedgerInitialName}
          onClose={() => {
            setQuickLedgerTargetRowId(null);
            setQuickLedgerInitialName('');
          }}
          onCreated={(newLedger) => {
            const targetRow = statementTransactions.find(
              (t) => t.id === quickLedgerTargetRowId
            );
            if (targetRow) {
              handleSelectLedger(targetRow, newLedger.id);
            }
          }}
        />
      )}
    </div>
  );
};
