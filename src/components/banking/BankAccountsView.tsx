import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { accountingEngine, LedgerSummary } from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { BankAccount, Ledger } from '../../types';
import { BankStatementImportModal } from './BankStatementImportModal';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  Landmark,
  Plus,
  ArrowRight,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  Save,
  Trash2,
  Edit2,
  X,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Eye,
  Copy,
  Check,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Download,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const BankAccountsView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    bankAccounts,
    ledgers,
    setActiveTab,
    refreshActiveData,
    showNotification,
  } = useApp();

  // View Mode: 'TABLE' (CRUD table) or 'CARDS' (Grid of cards)
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [viewingBank, setViewingBank] = useState<BankAccount | null>(null);
  const [importAccount, setImportAccount] = useState<BankAccount | null>(null);

  // Balances State from Accounting Engine
  const [ledgerSummaries, setLedgerSummaries] = useState<Record<string, LedgerSummary>>({});
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    details?: { label: string; value: string | number }[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form State
  const [accountName, setAccountName] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [accountType, setAccountType] = useState<'CURRENT' | 'SAVINGS' | 'OVERDRAFT' | 'CASH_CREDIT'>('CURRENT');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('DR');
  const [isActiveState, setIsActiveState] = useState<boolean>(true);

  // 1. Auto-sync any bank ledgers in the Chart of Accounts that lack a BankAccount document
  useEffect(() => {
    const syncMissingBankAccounts = async () => {
      if (!currentCompany || ledgers.length === 0) return;
      const bankLedgers = ledgers.filter(
        (l) => l.groupId === 'grp-bank-accounts' || l.accountType === 'BANK'
      );
      const existingLedgerIds = new Set(bankAccounts.map((b) => b.ledgerId));
      let hasNew = false;

      for (const bl of bankLedgers) {
        if (!existingLedgerIds.has(bl.id)) {
          const newBankAcc: BankAccount = {
            id: `bank-${bl.id.replace('led-', '')}`,
            uuid: uuidv4(),
            companyId: currentCompany.id,
            ledgerId: bl.id,
            accountName: bl.name,
            bankName: bl.name.split('(')[0]?.trim() || bl.name,
            accountNumber: bl.bankAccountNumber || '389201948201',
            ifscCode: bl.bankIfsc || 'SBIN0001234',
            ifsc: bl.bankIfsc || 'SBIN0001234',
            branch: bl.bankBranch || bl.city || 'Main Branch',
            accountType: 'CURRENT',
            openingBalance: bl.openingBalance || 0,
            currentBalance: bl.openingBalance || 0,
            isActive: bl.isActive !== false,
            createdAt: bl.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await dbStorage.saveBankAccount(newBankAcc);
          hasNew = true;
        }
      }
      if (hasNew) {
        await refreshActiveData();
      }
    };

    syncMissingBankAccounts();
  }, [ledgers, bankAccounts.length, currentCompany]);

  // 2. Fetch live ledger balances for each bank account
  const loadLedgerBalances = async () => {
    if (bankAccounts.length === 0) return;
    setLoadingBalances(true);
    try {
      const summaries: Record<string, LedgerSummary> = {};
      await Promise.all(
        bankAccounts.map(async (b) => {
          if (b.ledgerId) {
            try {
              const s = await accountingEngine.getLedgerSummary(b.ledgerId);
              summaries[b.id] = s;
            } catch (err) {
              console.error('Error fetching ledger summary for bank:', b.id, err);
            }
          }
        })
      );
      setLedgerSummaries(summaries);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    loadLedgerBalances();
  }, [bankAccounts, currentCompany]);

  // Filtered Bank Accounts based on search and filters
  const filteredBanks = useMemo(() => {
    return bankAccounts.filter((b) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        b.bankName.toLowerCase().includes(q) ||
        b.accountName.toLowerCase().includes(q) ||
        b.accountNumber.toLowerCase().includes(q) ||
        (b.ifscCode && b.ifscCode.toLowerCase().includes(q)) ||
        (b.ifsc && b.ifsc.toLowerCase().includes(q)) ||
        (b.branch && b.branch.toLowerCase().includes(q));

      const matchType = typeFilter === 'ALL' || b.accountType === typeFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && b.isActive !== false) ||
        (statusFilter === 'INACTIVE' && b.isActive === false);

      return matchSearch && matchType && matchStatus;
    });
  }, [bankAccounts, searchTerm, typeFilter, statusFilter]);

  // Keyboard navigation for Bank Accounts table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredBanks.length,
    tableId: 'bank-accounts-table',
    enabled: !addModalOpen && !editingBank && !confirmModal.isOpen && !viewingBank && !importAccount,
    onEnter: (idx) => {
      const b = filteredBanks[idx];
      if (b) {
        openViewModal(b);
      }
    },
  });

  // Key KPI Metrics
  const totalAccounts = bankAccounts.length;
  const activeAccounts = bankAccounts.filter((b) => b.isActive !== false).length;

  const totalOpeningBalance = useMemo(() => {
    return bankAccounts.reduce((sum, b) => {
      const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
      const isDr = (linkedLedger?.openingBalanceType || 'DR') === 'DR';
      return sum + (isDr ? (b.openingBalance || 0) : -(b.openingBalance || 0));
    }, 0);
  }, [bankAccounts, ledgers]);

  const totalBookBalance = useMemo(() => {
    return bankAccounts.reduce((sum, b) => {
      const summary = ledgerSummaries[b.id];
      if (summary) {
        const isDr = summary.closingBalanceType === 'DR';
        return sum + (isDr ? summary.closingBalance : -summary.closingBalance);
      }
      const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
      const isDr = (linkedLedger?.openingBalanceType || 'DR') === 'DR';
      return sum + (isDr ? (b.openingBalance || 0) : -(b.openingBalance || 0));
    }, 0);
  }, [bankAccounts, ledgerSummaries, ledgers]);

  // Handlers for CRUD operations
  const openAddModal = () => {
    setEditingBank(null);
    setAccountName('');
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setBranch('');
    setAccountType('CURRENT');
    setOpeningBalance(0);
    setOpeningBalanceType('DR');
    setIsActiveState(true);
    setAddModalOpen(true);
  };

  const openEditModal = (b: BankAccount) => {
    setEditingBank(b);
    setAccountName(b.accountName);
    setBankName(b.bankName);
    setAccountNumber(b.accountNumber);
    setIfscCode(b.ifscCode || b.ifsc || '');
    setBranch(b.branch || '');
    setAccountType((b.accountType as any) || 'CURRENT');
    setOpeningBalance(b.openingBalance || 0);
    const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
    setOpeningBalanceType(linkedLedger?.openingBalanceType || 'DR');
    setIsActiveState(b.isActive !== false);
    setAddModalOpen(true);
  };

  const openViewModal = (b: BankAccount) => {
    setViewingBank(b);
  };

  const handleCopyText = (text: string, key: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showNotification(`${label} copied to clipboard!`, 'info');
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleSaveBankAccount = () => {
    if (!accountName.trim() || !bankName.trim() || !accountNumber.trim()) {
      showNotification('Please fill in Bank Name, Account Nickname, and Account Number.', 'error');
      return;
    }

    if (!currentCompany) return;

    const isEdit = !!editingBank;

    setConfirmModal({
      isOpen: true,
      type: isEdit ? 'EDIT' : 'ADD',
      title: isEdit ? 'Confirm Update Bank Account' : 'Confirm Add Bank Account',
      message: isEdit
        ? `Are you sure you want to update "${bankName.trim()}" (${accountName.trim()}) and its corresponding ledger?`
        : `Are you sure you want to add "${bankName.trim()}" (${accountName.trim()}) and automatically generate its corresponding ledger?`,
      details: [
        { label: 'Bank Name', value: bankName.trim() },
        { label: 'Account Name', value: accountName.trim() },
        { label: 'A/C Number', value: accountNumber.trim() },
        { label: 'IFSC Code', value: ifscCode.trim().toUpperCase() || 'N/A' },
        { label: 'Opening Balance', value: `₹${Number(openingBalance).toFixed(2)} ${openingBalanceType}` },
        { label: 'Status', value: isActiveState ? 'Active' : 'Inactive' },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const now = new Date().toISOString();
          const ledgerId = editingBank ? editingBank.ledgerId : `led-bank-${Date.now()}`;
          const bankId = editingBank ? editingBank.id : `bank-${Date.now()}`;

          // 1. Create or Update Ledger under Bank Accounts
          const existingLedger = ledgers.find((l) => l.id === ledgerId);
          const ledgerRecord: Ledger = {
            id: ledgerId,
            uuid: existingLedger?.uuid || uuidv4(),
            companyId: currentCompany.id,
            groupId: existingLedger?.groupId || 'grp-bank-accounts',
            name: `${bankName.trim()} (${accountName.trim()})`,
            accountType: 'BANK',
            openingBalance: Number(openingBalance) || 0,
            openingBalanceType,
            city: branch.trim(),
            bankAccountNumber: accountNumber.trim(),
            bankIfsc: ifscCode.trim().toUpperCase(),
            bankBranch: branch.trim(),
            notes: `A/C: ${accountNumber.trim()} IFSC: ${ifscCode.trim().toUpperCase()}`,
            isActive: isActiveState,
            createdAt: existingLedger?.createdAt || now,
            updatedAt: now,
          };
          await dbStorage.saveLedger(ledgerRecord);

          // 2. Create or Update Bank Account record
          const bankRecord: BankAccount = {
            id: bankId,
            uuid: editingBank?.uuid || uuidv4(),
            companyId: currentCompany.id,
            ledgerId: ledgerId,
            accountName: accountName.trim(),
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            ifsc: ifscCode.trim().toUpperCase(),
            branch: branch.trim(),
            accountType,
            openingBalance: Number(openingBalance) || 0,
            currentBalance: Number(openingBalance) || 0,
            isActive: isActiveState,
            createdAt: editingBank?.createdAt || now,
            updatedAt: now,
          };
          await dbStorage.saveBankAccount(bankRecord);
          await dbStorage.logAudit(
            isEdit ? 'EDIT' : 'CREATE',
            'BANK_ACCOUNT',
            bankId,
            `${isEdit ? 'Updated' : 'Created'} Bank Account & Ledger: ${bankRecord.bankName} - ${bankRecord.accountNumber}`
          );

          showNotification(`Bank account "${bankRecord.bankName}" saved successfully.`, 'success');
          setAddModalOpen(false);
          setEditingBank(null);

          await refreshActiveData();
          await loadLedgerBalances();
        } catch (err: any) {
          showNotification(err.message || 'Failed to save bank account.', 'error');
        }
      },
    });
  };

  const handleDeleteBankAccount = (b: BankAccount) => {
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Delete Bank Account',
      message: `Are you sure you want to permanently delete bank account "${b.bankName} (${b.accountNumber})"?`,
      details: [
        { label: 'Bank Name', value: b.bankName },
        { label: 'Account No', value: b.accountNumber },
        { label: 'IFSC', value: b.ifscCode || b.ifsc || '-' },
        { label: 'Opening Balance', value: `₹${(b.openingBalance || 0).toFixed(2)}` },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await dbStorage.deleteBankAccount(b.id);
          await dbStorage.logAudit('CANCEL', 'BANK_ACCOUNT', b.id, `Deleted Bank Account: ${b.bankName}`);
          showNotification(`Bank account "${b.bankName}" deleted successfully.`, 'info');
          if (viewingBank?.id === b.id) {
            setViewingBank(null);
          }
          await refreshActiveData();
          await loadLedgerBalances();
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete bank account.', 'error');
        }
      },
    });
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    const exportData = filteredBanks.map((b, idx) => {
      const summary = ledgerSummaries[b.id];
      const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
      const openType = linkedLedger?.openingBalanceType || 'DR';
      const currentBal = summary
        ? `${summary.closingBalance.toFixed(2)} ${summary.closingBalanceType}`
        : `${(b.openingBalance || 0).toFixed(2)} ${openType}`;
      return {
        sno: idx + 1,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        ifscCode: b.ifscCode || b.ifsc || '-',
        branch: b.branch || 'Main Branch',
        accountType: b.accountType || 'CURRENT',
        openingBalance: `${(b.openingBalance || 0).toFixed(2)} ${openType}`,
        currentBalance: currentBal,
        status: b.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      };
    });

    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Bank Accounts Register',
      subtitle: 'Master Record of Company Bank Accounts and Book Balances',
      columns: [
        { header: 'S.No', dataKey: 'sno', width: 10, align: 'center' },
        { header: 'Bank Name', dataKey: 'bankName', width: 25 },
        { header: 'Account Nickname', dataKey: 'accountName', width: 25 },
        { header: 'Account Number', dataKey: 'accountNumber', width: 20 },
        { header: 'IFSC Code', dataKey: 'ifscCode', width: 15 },
        { header: 'Branch', dataKey: 'branch', width: 20 },
        { header: 'Type', dataKey: 'accountType', width: 15 },
        { header: 'Opening Balance', dataKey: 'openingBalance', width: 20, align: 'right' },
        { header: 'Current Balance', dataKey: 'currentBalance', width: 20, align: 'right' },
        { header: 'Status', dataKey: 'status', width: 12, align: 'center' },
      ],
      data: exportData,
      filenamePrefix: 'bank_accounts_registry',
    });
    showNotification('Exported Bank Accounts to Excel.', 'success');
  };

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    const exportData = filteredBanks.map((b, idx) => {
      const summary = ledgerSummaries[b.id];
      const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
      const openType = linkedLedger?.openingBalanceType || 'DR';
      const currentBal = summary
        ? `${summary.closingBalance.toFixed(2)} ${summary.closingBalanceType}`
        : `${(b.openingBalance || 0).toFixed(2)} ${openType}`;
      return {
        sno: idx + 1,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        ifscCode: b.ifscCode || b.ifsc || '-',
        branch: b.branch || 'Main Branch',
        accountType: b.accountType || 'CURRENT',
        openingBalance: `${(b.openingBalance || 0).toFixed(2)} ${openType}`,
        currentBalance: currentBal,
        status: b.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      };
    });

    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Bank Accounts Register',
      subtitle: 'Master Record of Company Bank Accounts and Book Balances',
      columns: [
        { header: 'S.No', dataKey: 'sno', align: 'center' },
        { header: 'Bank Name', dataKey: 'bankName' },
        { header: 'Account Name', dataKey: 'accountName' },
        { header: 'Account Number', dataKey: 'accountNumber' },
        { header: 'IFSC Code', dataKey: 'ifscCode' },
        { header: 'Branch', dataKey: 'branch' },
        { header: 'Type', dataKey: 'accountType' },
        { header: 'Opening Balance', dataKey: 'openingBalance', align: 'right' },
        { header: 'Current Balance', dataKey: 'currentBalance', align: 'right' },
        { header: 'Status', dataKey: 'status', align: 'center' },
      ],
      data: exportData,
      filenamePrefix: 'bank_accounts_registry',
    });
    showNotification('Exported Bank Accounts to PDF.', 'success');
  };

  const handleExportCsv = () => {
    if (!currentCompany || !currentFiscalYear) return;
    const exportData = filteredBanks.map((b, idx) => {
      const summary = ledgerSummaries[b.id];
      const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
      const openType = linkedLedger?.openingBalanceType || 'DR';
      const currentBal = summary
        ? `${summary.closingBalance.toFixed(2)} ${summary.closingBalanceType}`
        : `${(b.openingBalance || 0).toFixed(2)} ${openType}`;
      return {
        sno: idx + 1,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        ifscCode: b.ifscCode || b.ifsc || '-',
        branch: b.branch || 'Main Branch',
        accountType: b.accountType || 'CURRENT',
        openingBalance: `${(b.openingBalance || 0).toFixed(2)} ${openType}`,
        currentBalance: currentBal,
        status: b.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      };
    });

    ExportEngine.exportToCsv({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Bank Accounts Register',
      columns: [
        { header: 'S.No', dataKey: 'sno' },
        { header: 'Bank Name', dataKey: 'bankName' },
        { header: 'Account Nickname', dataKey: 'accountName' },
        { header: 'Account Number', dataKey: 'accountNumber' },
        { header: 'IFSC Code', dataKey: 'ifscCode' },
        { header: 'Branch', dataKey: 'branch' },
        { header: 'Type', dataKey: 'accountType' },
        { header: 'Opening Balance', dataKey: 'openingBalance' },
        { header: 'Current Balance', dataKey: 'currentBalance' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: exportData,
      filenamePrefix: 'bank_accounts_registry',
    });
    showNotification('Exported Bank Accounts to CSV.', 'success');
  };

  return (
    <div className="space-y-2.5 text-slate-300">
      {/* 1. Header & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl shrink-0 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
            <h1 className="text-sm font-bold text-white tracking-tight uppercase flex items-center gap-1.5 font-mono">
              <Landmark className="w-4 h-4 text-sky-400" />
              Bank &amp; Digital Accounts Master
            </h1>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/60 font-mono">
              {totalAccounts} Accounts
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure Indian bank accounts, IFSC routing, book balances, statement parsers, and bank reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="CRUD Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportPdf}
            title="Export to PDF"
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer flex items-center justify-center"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportExcel}
            title="Export to Excel"
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer flex items-center justify-center"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={ExportEngine.printReport}
            title="Print Register"
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={async () => {
              await refreshActiveData();
              await loadLedgerBalances();
            }}
            title="Refresh Balances"
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingBalances ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Add Bank Account CTA */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition shadow-xs font-mono cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD BANK ACCOUNT</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Accounts</span>
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-white font-mono">{totalAccounts}</span>
            <span className="text-[10px] text-slate-500">accounts registered</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Active Banking Lines</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-emerald-400 font-mono">{activeAccounts}</span>
            <span className="text-[10px] text-slate-500">of {totalAccounts} active</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Opening Balance</span>
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-amber-300 font-mono">
              ₹{Math.abs(totalOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
              {totalOpeningBalance >= 0 ? 'DR' : 'CR'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Ledger Book Balance</span>
            <Landmark className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={`text-base font-bold font-mono ${totalBookBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{Math.abs(totalBookBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
              totalBookBalance >= 0
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
            }`}>
              {totalBookBalance >= 0 ? 'DR (Asset)' : 'CR (OD)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search bank name, A/C number, IFSC, branch..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-sky-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-sky-500 cursor-pointer"
            >
              <option value="ALL">All Account Types</option>
              <option value="CURRENT">Current Account</option>
              <option value="SAVINGS">Savings Account</option>
              <option value="CASH_CREDIT">Cash Credit (CC)</option>
              <option value="OVERDRAFT">Overdraft (OD)</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-sky-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Clear Filters CTA if active */}
          {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded text-xs transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. CRUD Table View (Primary) or Cards View */}
      {viewMode === 'TABLE' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 font-mono leading-tight">
                <tr>
                  <th className="py-0.5 px-3 w-12 text-center">#</th>
                  <th className="py-0.5 px-3.5">Bank &amp; Account Details</th>
                  <th className="py-0.5 px-3.5">Account Number</th>
                  <th className="py-0.5 px-3.5">IFSC &amp; Branch</th>
                  <th className="py-0.5 px-3.5">Type</th>
                  <th className="py-0.5 px-3.5 text-right">Opening Bal (₹)</th>
                  <th className="py-0.5 px-3.5 text-right">Book Balance (₹)</th>
                  <th className="py-0.5 px-3 text-center">Status</th>
                  <th className="py-0.5 px-4 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBanks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-400" />
                      <p className="text-xs font-medium text-slate-300">No bank accounts found matching the criteria.</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search keywords or clear filters.'
                          : 'Click "+ ADD BANK ACCOUNT" to configure your company bank accounts.'}
                      </p>
                      {searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setTypeFilter('ALL');
                            setStatusFilter('ALL');
                          }}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      ) : (
                        <button
                          onClick={openAddModal}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Bank Account
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredBanks.map((b, idx) => {
                    const summary = ledgerSummaries[b.id];
                    const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
                    const openType = linkedLedger?.openingBalanceType || 'DR';
                    const closingBal = summary ? summary.closingBalance : (b.openingBalance || 0);
                    const closingType = summary ? summary.closingBalanceType : openType;
                    const isAsset = closingType === 'DR';
                    const isSelected = idx === selectedIndex;

                    return (
                      <tr
                        key={b.id}
                        data-table-id="bank-accounts-table"
                        data-row-idx={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`transition-colors group cursor-pointer ${
                          isSelected
                            ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Index */}
                        <td className="py-1 px-3 text-center font-mono text-slate-500 text-[10px]">
                          {idx + 1}
                        </td>

                        {/* Bank & Account Name */}
                        <td className="py-1 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                              <Landmark className="w-3 h-3" />
                            </div>
                            <div>
                              <div
                                onClick={() => openViewModal(b)}
                                className="font-bold text-white hover:text-sky-300 transition cursor-pointer text-xs"
                              >
                                {b.bankName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <span>{b.accountName}</span>
                                {linkedLedger && (
                                  <span className="text-[9px] text-slate-500 bg-slate-950 px-1 rounded border border-slate-800">
                                    Ledger Linked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Account Number with 1-click copy */}
                        <td className="py-1 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-200 text-xs">
                              {b.accountNumber}
                            </span>
                            <button
                              onClick={() => handleCopyText(b.accountNumber, `acc-${b.id}`, 'Account Number')}
                              title="Copy Account Number"
                              className="p-0.5 text-slate-500 hover:text-sky-300 rounded hover:bg-slate-800 transition cursor-pointer"
                            >
                              {copiedKey === `acc-${b.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* IFSC & Branch */}
                        <td className="py-1 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-300 text-xs uppercase">
                              {b.ifscCode || b.ifsc || '-'}
                            </span>
                            {(b.ifscCode || b.ifsc) && (
                              <button
                                onClick={() => handleCopyText(b.ifscCode || b.ifsc || '', `ifsc-${b.id}`, 'IFSC Code')}
                                title="Copy IFSC Code"
                                className="p-0.5 text-slate-500 hover:text-sky-300 rounded hover:bg-slate-800 transition cursor-pointer"
                              >
                                {copiedKey === `ifsc-${b.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {b.branch || 'Main Branch'}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-1 px-3 whitespace-nowrap">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase border ${
                              b.accountType === 'CURRENT'
                                ? 'bg-sky-950/80 text-sky-300 border-sky-800'
                                : b.accountType === 'SAVINGS'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : b.accountType === 'CASH_CREDIT'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : b.accountType === 'OVERDRAFT'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {b.accountType || 'CURRENT'}
                          </span>
                        </td>

                        {/* Opening Balance */}
                        <td className="py-1 px-3 text-right font-mono whitespace-nowrap text-xs">
                          <div className="text-amber-300 font-bold">
                            ₹{(b.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] text-slate-400">{openType}</span>
                        </td>

                        {/* Current Book Balance */}
                        <td className="py-1 px-3 text-right font-mono whitespace-nowrap text-xs">
                          <div
                            className={`font-bold ${
                              isAsset ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ₹{closingBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${
                              isAsset ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {closingType} {isAsset ? '(In Bank)' : '(OD Loan)'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-1 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                              b.isActive !== false
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                b.isActive !== false ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            ></span>
                            {b.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions: CRUD toolbar */}
                        <td className="py-1 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Read: View Details */}
                            <button
                              onClick={() => openViewModal(b)}
                              title="View Bank Account Details"
                              className="p-1 rounded bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Update: Edit */}
                            <button
                              onClick={() => openEditModal(b)}
                              title="Edit Bank Account"
                              className="p-1 rounded bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Statement Import (CSV) */}
                            <button
                              onClick={() => setImportAccount(b)}
                              title="Import Bank Statement (CSV)"
                              className="p-1 rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 transition cursor-pointer"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                            </button>

                            {/* Bank Reconciliation (BRS) */}
                            <button
                              onClick={() => setActiveTab('bank_rec')}
                              title="Reconcile Bank Account (BRS)"
                              className="p-1 rounded bg-slate-800 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 border border-slate-700 transition cursor-pointer"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete: Remove Account */}
                            <button
                              onClick={() => handleDeleteBankAccount(b)}
                              title="Delete Bank Account"
                              className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer Summary Row */}
              {filteredBanks.length > 0 && (
                <tfoot className="bg-slate-950/90 border-t border-slate-800 font-mono text-xs font-bold text-slate-200">
                  <tr>
                    <td colSpan={5} className="py-1.5 px-3 text-right uppercase text-[10px] text-slate-400">
                      Summary Totals ({filteredBanks.length} Accounts):
                    </td>
                    <td className="py-1.5 px-3 text-right text-amber-300 whitespace-nowrap text-xs">
                      ₹{Math.abs(totalOpeningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {totalOpeningBalance >= 0 ? 'DR' : 'CR'}
                    </td>
                    <td className="py-1.5 px-3 text-right text-emerald-400 whitespace-nowrap text-xs">
                      ₹{Math.abs(totalBookBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {totalBookBalance >= 0 ? 'DR' : 'CR'}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* 5. Alternative Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBanks.length === 0 ? (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center font-mono space-y-2">
              <Landmark className="w-8 h-8 mx-auto text-sky-400 opacity-40" />
              <p className="text-white font-bold text-sm">NO BANK ACCOUNTS MATCH FILTERS</p>
              <p className="text-xs text-slate-400">Adjust your search keyword or add a new account.</p>
            </div>
          ) : (
            filteredBanks.map((b) => {
              const summary = ledgerSummaries[b.id];
              const linkedLedger = ledgers.find((l) => l.id === b.ledgerId);
              const openType = linkedLedger?.openingBalanceType || 'DR';
              const closingBal = summary ? summary.closingBalance : (b.openingBalance || 0);
              const closingType = summary ? summary.closingBalanceType : openType;
              const isAsset = closingType === 'DR';

              return (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 hover:border-slate-700 transition flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800 uppercase font-mono">
                          {b.accountType || 'CURRENT'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            b.isActive !== false
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}
                        >
                          {b.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <h3 className="font-bold text-white text-sm tracking-tight">{b.bankName}</h3>
                      <p className="text-xs text-slate-400 font-mono">{b.accountName}</p>
                    </div>

                    <div className="mt-2.5 space-y-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Account Number:</span>
                        <span className="text-slate-200 font-bold">{b.accountNumber}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>IFSC Code:</span>
                        <span className="text-slate-200 uppercase">{b.ifscCode || b.ifsc || '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Branch:</span>
                        <span className="text-slate-300 truncate max-w-[130px]">{b.branch || 'Main Branch'}</span>
                      </div>
                      <div className="border-t border-slate-800 pt-1 flex justify-between text-[11px]">
                        <span className="text-slate-400">Opening Balance:</span>
                        <span className="text-amber-300 font-bold">
                          ₹{(b.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {openType}
                        </span>
                      </div>
                      <div className="border-t border-slate-800 pt-1 flex justify-between text-[11px]">
                        <span className="text-slate-400">Book Balance:</span>
                        <span className={`font-bold ${isAsset ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{closingBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {closingType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-2 flex items-center gap-1.5 border-t border-slate-800 font-mono">
                    <button
                      onClick={() => openViewModal(b)}
                      title="View Details"
                      className="p-1.5 rounded bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setImportAccount(b)}
                      className="flex-1 flex items-center justify-center gap-1 bg-slate-950 hover:bg-slate-800 text-sky-300 text-[11px] font-semibold py-1 rounded border border-slate-800 transition cursor-pointer"
                    >
                      <UploadCloud className="w-3 h-3" />
                      CSV
                    </button>
                    <button
                      onClick={() => setActiveTab('bank_rec')}
                      className="flex-1 flex items-center justify-center gap-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 text-[11px] font-bold py-1 rounded border border-sky-700/50 transition cursor-pointer"
                    >
                      <FileCheck className="w-3 h-3" />
                      REC
                    </button>
                    <button
                      onClick={() => openEditModal(b)}
                      title="Edit Bank Account"
                      className="p-1.5 rounded bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBankAccount(b)}
                      title="Delete Bank Account"
                      className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Read: View Bank Account Details Modal */}
      {viewingBank && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm font-mono">{viewingBank.bankName}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{viewingBank.accountName}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingBank(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account Details Specs */}
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Account Number</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-white font-bold text-xs">{viewingBank.accountNumber}</span>
                  <button
                    onClick={() => handleCopyText(viewingBank.accountNumber, 'view-acc', 'Account Number')}
                    className="text-slate-500 hover:text-sky-300 cursor-pointer"
                  >
                    {copiedKey === 'view-acc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">IFSC Code</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-white font-bold text-xs uppercase">{viewingBank.ifscCode || viewingBank.ifsc || '-'}</span>
                  {(viewingBank.ifscCode || viewingBank.ifsc) && (
                    <button
                      onClick={() => handleCopyText(viewingBank.ifscCode || viewingBank.ifsc || '', 'view-ifsc', 'IFSC Code')}
                      className="text-slate-500 hover:text-sky-300 cursor-pointer"
                    >
                      {copiedKey === 'view-ifsc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Branch Name</span>
                <span className="text-slate-200 text-xs mt-0.5 block">{viewingBank.branch || 'Main Branch'}</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Account Type</span>
                <span className="text-sky-300 font-bold text-xs mt-0.5 block uppercase">{viewingBank.accountType || 'CURRENT'}</span>
              </div>
            </div>

            {/* Financial Balances Card */}
            {(() => {
              const summary = ledgerSummaries[viewingBank.id];
              const linkedLedger = ledgers.find((l) => l.id === viewingBank.ledgerId);
              const openType = linkedLedger?.openingBalanceType || 'DR';
              const closingBal = summary ? summary.closingBalance : (viewingBank.openingBalance || 0);
              const closingType = summary ? summary.closingBalanceType : openType;
              const isAsset = closingType === 'DR';

              return (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 font-mono">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5">
                    Financial Snapshot &amp; Balances
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Opening Balance:</span>
                      <span className="text-amber-300 font-bold">
                        ₹{(viewingBank.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {openType}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Status:</span>
                      <span className={viewingBank.isActive !== false ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {viewingBank.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {summary && (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate-400">Total Inflow (Dr):</span>
                          <span className="text-emerald-400 font-bold">
                            +₹{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate-400">Total Outflow (Cr):</span>
                          <span className="text-rose-400 font-bold">
                            -₹{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Current Ledger Book Balance:</span>
                    <span className={`text-sm font-bold ${isAsset ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{closingBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {closingType}
                    </span>
                  </div>

                  {linkedLedger && (
                    <div className="border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-400">
                      Linked to Ledger: <strong className="text-white">{linkedLedger.name}</strong> ({linkedLedger.id})
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const b = viewingBank;
                    setViewingBank(null);
                    openEditModal(b);
                  }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Account
                </button>
                <button
                  onClick={() => {
                    const b = viewingBank;
                    setViewingBank(null);
                    setImportAccount(b);
                  }}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </div>

              <button
                onClick={() => setViewingBank(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Update: Add / Edit Bank Account Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-mono">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                {editingBank ? 'EDIT COMPANY BANK ACCOUNT' : 'ADD COMPANY BANK ACCOUNT'}
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Name *</label>
                  <input
                    type="text"
                    list="bank-suggestions"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-hidden focus:border-sky-500"
                  />
                  <datalist id="bank-suggestions">
                    <option value="State Bank of India" />
                    <option value="HDFC Bank" />
                    <option value="ICICI Bank" />
                    <option value="Punjab National Bank" />
                    <option value="Axis Bank" />
                    <option value="Bank of Baroda" />
                    <option value="Kotak Mahindra Bank" />
                    <option value="Canara Bank" />
                    <option value="Union Bank of India" />
                    <option value="IndusInd Bank" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Nickname *</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Main Current A/C"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Number *</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="11 to 16 digit A/C No"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs font-mono uppercase focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Industrial Area Branch"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-hidden focus:border-sky-500 cursor-pointer"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CASH_CREDIT">Cash Credit (CC)</option>
                    <option value="OVERDRAFT">Overdraft (OD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Opening Balance (₹)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:outline-hidden focus:border-sky-500"
                  />
                  <select
                    value={openingBalanceType}
                    onChange={(e) => setOpeningBalanceType(e.target.value as 'DR' | 'CR')}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 text-amber-300 font-bold text-xs cursor-pointer"
                  >
                    <option value="DR">Dr (Asset / In Bank)</option>
                    <option value="CR">Cr (OD / Loan)</option>
                  </select>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bank-active-toggle"
                  checked={isActiveState}
                  onChange={(e) => setIsActiveState(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="bank-active-toggle" className="text-xs text-slate-300 cursor-pointer select-none">
                  Account is Active for transactions and vouchers
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAddModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-lg cursor-pointer transition"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveBankAccount}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Save className="w-3.5 h-3.5" />
                {editingBank ? 'UPDATE BANK ACCOUNT' : 'SAVE ACCOUNT & CREATE LEDGER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Statement Import Modal */}
      {importAccount && (
        <BankStatementImportModal
          bankAccount={importAccount}
          onClose={() => setImportAccount(null)}
          onSuccess={async () => {
            await refreshActiveData();
            await loadLedgerBalances();
          }}
        />
      )}

      {/* 8. Reusable Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        itemDetails={confirmModal.details}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
