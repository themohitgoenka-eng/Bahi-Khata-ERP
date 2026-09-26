import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  accountingEngine,
  TrialBalanceResult,
  TrialBalanceItem,
} from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO, getTrialBalanceDefaultFilename } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import {
  Scale,
  FileDown,
  Calendar,
  AlertTriangle,
  Search,
  Layers,
  ListTree,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  FileSpreadsheet,
  ShieldCheck,
  Folder,
  ExternalLink,
  Printer,
} from 'lucide-react';

interface GroupData {
  groupName: string;
  accountType: string;
  items: TrialBalanceItem[];
  totalDebit: number;
  totalCredit: number;
  isNetDebit: boolean;
  netAmount: number;
}

export const TrialBalanceView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    setActiveTab,
    setSelectedLedgerId,
    setSelectedLedgerName,
    openLedger,
    openOrSwitchTab,
  } = useApp();

  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>(currentFiscalYear?.startDate || '2026-04-01');
  const [toDate, setToDate] = useState<string>(getTodayISO());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [natureFilter, setNatureFilter] = useState<string>('ALL');

  useEffect(() => {
    if (currentFiscalYear?.startDate && (!fromDate || fromDate === '2026-04-01')) {
      setFromDate(currentFiscalYear.startDate);
    }
  }, [currentFiscalYear]);

  // Build fully qualified URL so links work across any browser, tab, or window
  const getLedgerHref = (ledgerId: string, ledgerName: string) => {
    if (typeof window === 'undefined') {
      return `?tab=ledgers&ledgerId=${encodeURIComponent(ledgerId)}&ledgerName=${encodeURIComponent(ledgerName)}`;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'ledgers');
      url.searchParams.set('ledgerId', ledgerId);
      url.searchParams.set('ledgerName', ledgerName);
      return url.toString();
    } catch {
      return `${window.location.pathname}?tab=ledgers&ledgerId=${encodeURIComponent(ledgerId)}&ledgerName=${encodeURIComponent(ledgerName)}`;
    }
  };

  const handleViewLedger = (ledgerId: string, ledgerName: string) => {
    if (openOrSwitchTab) {
      openOrSwitchTab('ledgers', ledgerId, ledgerName);
    } else {
      openLedger(ledgerId, ledgerName, false);
    }
  };

  const handleLedgerClick = (_ledgerId: string, _ledgerName: string) => {
    // Native <a target="_blank"> handles new tab opening cleanly without popup blocker interference
  };

  // View Mode: 'GROUPED_DETAILED' (Default), 'GROUPED_SUMMARY', or 'FLAT'
  const [viewMode, setViewMode] = useState<'GROUPED_DETAILED' | 'GROUPED_SUMMARY' | 'FLAT'>('GROUPED_DETAILED');

  // Hide Zero Balances Option: Default true
  const [hideZero, setHideZero] = useState<boolean>(true);

  // State to track expanded groups in detailed mode
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const loadTB = async () => {
    setLoading(true);
    try {
      const tb = await accountingEngine.getTrialBalance(toDate || undefined, true, fromDate || undefined);
      setTrialBalance(tb);
    } catch (err) {
      console.error('Error calculating trial balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTB();
  }, [fromDate, toDate, currentCompany, currentFiscalYear]);

  // Direct Ledger Items from Accounting Engine
  const baseItems: TrialBalanceItem[] = useMemo(() => {
    return trialBalance?.items || [];
  }, [trialBalance]);

  // Filter items based on Hide Zero, Search, and Account Nature
  const { filteredItems, hiddenZeroCount } = useMemo(() => {
    let zeroCount = 0;
    const result: TrialBalanceItem[] = [];

    const searchLower = searchTerm.toLowerCase().trim();

    for (const item of baseItems) {
      const isZero =
        (item.closingDebit || 0) === 0 &&
        (item.closingCredit || 0) === 0 &&
        (item.openingDebit || 0) === 0 &&
        (item.openingCredit || 0) === 0;

      if (isZero) {
        zeroCount++;
      }

      if (hideZero && isZero) {
        continue;
      }

      // Filter by nature / accountType if selected
      if (natureFilter !== 'ALL') {
        const itemNature = (item.accountType || '').toUpperCase();
        if (natureFilter === 'INCOME' && !itemNature.includes('INCOME') && !itemNature.includes('SALES')) continue;
        if (natureFilter === 'EXPENSE' && !itemNature.includes('EXPENSE') && !itemNature.includes('PURCHASE')) continue;
        if (natureFilter === 'ASSET' && !itemNature.includes('ASSET')) continue;
        if (natureFilter === 'LIABILITY' && !itemNature.includes('LIABILITY')) continue;
        if (natureFilter === 'CAPITAL' && !itemNature.includes('CAPITAL')) continue;
      }

      // Filter by search query
      if (
        searchLower &&
        !item.ledgerName.toLowerCase().includes(searchLower) &&
        !item.groupName.toLowerCase().includes(searchLower)
      ) {
        continue;
      }

      result.push(item);
    }

    return { filteredItems: result, hiddenZeroCount: zeroCount };
  }, [baseItems, hideZero, searchTerm, natureFilter]);

  // Priority order for Account Types / Groups
  const getNatureWeight = (type: string): number => {
    const t = (type || '').toUpperCase();
    if (t.includes('CAPITAL')) return 1;
    if (t.includes('LIABILITY')) return 2;
    if (t.includes('ASSET')) return 3;
    if (t.includes('DIRECT_INCOME') || t.includes('SALES')) return 4;
    if (t.includes('INDIRECT_INCOME')) return 5;
    if (t.includes('DIRECT_EXPENSE') || t.includes('PURCHASE')) return 6;
    if (t.includes('INDIRECT_EXPENSE')) return 7;
    return 8;
  };

  // Group-Wise Hierarchy Structure
  const groupedData: GroupData[] = useMemo(() => {
    const map = new Map<string, GroupData>();

    filteredItems.forEach((item) => {
      const gName = item.groupName || 'General';
      if (!map.has(gName)) {
        map.set(gName, {
          groupName: gName,
          accountType: item.accountType,
          items: [],
          totalDebit: 0,
          totalCredit: 0,
          isNetDebit: true,
          netAmount: 0,
        });
      }
      const g = map.get(gName)!;
      g.items.push(item);
      g.totalDebit += item.closingDebit || 0;
      g.totalCredit += item.closingCredit || 0;
    });

    const list = Array.from(map.values()).map((g) => {
      const net = g.totalDebit - g.totalCredit;
      g.isNetDebit = net >= 0;
      g.netAmount = Math.abs(net);
      // Sort items inside each group
      g.items.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
      return g;
    });

    // Sort groups logically: Capital -> Liabilities -> Assets -> Income -> Expense
    return list.sort((a, b) => {
      const wA = getNatureWeight(a.accountType);
      const wB = getNatureWeight(b.accountType);
      if (wA !== wB) return wA - wB;
      return a.groupName.localeCompare(b.groupName);
    });
  }, [filteredItems]);

  // Aggregate totals across all items
  const displayedTotals = useMemo(() => {
    let closingDebit = 0;
    let closingCredit = 0;

    filteredItems.forEach((item) => {
      closingDebit += item.closingDebit || 0;
      closingCredit += item.closingCredit || 0;
    });

    const diffClosing = Math.abs(closingDebit - closingCredit);

    return {
      closingDebit,
      closingCredit,
      isClosingBalanced: diffClosing < 0.02,
      closingDifference: diffClosing,
    };
  }, [filteredItems]);

  // Expand / Collapse All handlers
  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  const collapseAllGroups = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedData.forEach((g) => {
      allCollapsed[g.groupName] = true;
    });
    setCollapsedGroups(allCollapsed);
  };

  // Helper for Export Columns
  const getExportColumns = () => {
    return [
      { header: 'Particulars', dataKey: 'particulars' },
      { header: 'Account Group & Nature', dataKey: 'group' },
      { header: 'Debit Balance (₹)', dataKey: 'closingDr', align: 'right' as const },
      { header: 'Credit Balance (₹)', dataKey: 'closingCr', align: 'right' as const },
    ];
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!currentCompany || !currentFiscalYear || !trialBalance) return;
    const defaultFilename = getTrialBalanceDefaultFilename(currentFiscalYear);

    const columns = getExportColumns();
    const exportRows: any[] = [];

    if (viewMode === 'GROUPED_SUMMARY') {
      groupedData.forEach((g) => {
        exportRows.push({
          particulars: g.groupName.toUpperCase(),
          group: g.accountType.replace('_', ' '),
          closingDr: g.totalDebit > 0 ? g.totalDebit : '',
          closingCr: g.totalCredit > 0 ? g.totalCredit : '',
        });
      });
    } else {
      groupedData.forEach((g) => {
        exportRows.push({
          particulars: g.groupName.toUpperCase(),
          group: `[GROUP: ${g.accountType.replace('_', ' ')}]`,
          closingDr: g.totalDebit > 0 ? g.totalDebit : '',
          closingCr: g.totalCredit > 0 ? g.totalCredit : '',
          isGroup: true,
        });

        g.items.forEach((item) => {
          exportRows.push({
            particulars: `   ${item.ledgerName}`,
            group: g.groupName,
            closingDr: (item.closingDebit || 0) > 0 ? item.closingDebit : '',
            closingCr: (item.closingCredit || 0) > 0 ? item.closingCredit : '',
            isGroup: false,
          });
        });
      });
    }

    const summaryRow: any = {
      particulars: 'GRAND TOTAL',
      group: '',
      closingDr: displayedTotals.closingDebit,
      closingCr: displayedTotals.closingCredit,
    };

    await ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Trial Balance',
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(toDate)}`,
      hideGeneratedDate: true,
      hideFooter: false,
      columns,
      data: exportRows,
      summaryRows: [summaryRow],
      filenamePrefix: 'trial_balance',
      customFilename: defaultFilename,
    });
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (!currentCompany || !currentFiscalYear || !trialBalance) return;
    const defaultFilename = getTrialBalanceDefaultFilename(currentFiscalYear);
    const columns = getExportColumns();
    const exportRows: any[] = [];

    if (viewMode === 'GROUPED_SUMMARY') {
      groupedData.forEach((g) => {
        exportRows.push({
          particulars: g.groupName.toUpperCase(),
          group: g.accountType.replace('_', ' '),
          closingDr: g.totalDebit > 0 ? g.totalDebit : '',
          closingCr: g.totalCredit > 0 ? g.totalCredit : '',
        });
      });
    } else {
      groupedData.forEach((g) => {
        exportRows.push({
          particulars: g.groupName.toUpperCase(),
          group: `[GROUP: ${g.accountType.replace('_', ' ')}]`,
          closingDr: g.totalDebit > 0 ? g.totalDebit : '',
          closingCr: g.totalCredit > 0 ? g.totalCredit : '',
        });

        g.items.forEach((item) => {
          exportRows.push({
            particulars: `   ${item.ledgerName}`,
            group: g.groupName,
            closingDr: (item.closingDebit || 0) > 0 ? item.closingDebit : '',
            closingCr: (item.closingCredit || 0) > 0 ? item.closingCredit : '',
          });
        });
      });
    }

    const summaryRow: any = {
      particulars: 'GRAND TOTAL',
      group: '',
      closingDr: displayedTotals.closingDebit,
      closingCr: displayedTotals.closingCredit,
    };

    await ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Trial Balance',
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear?.startDate || '')} To: ${formatDateDisplay(toDate)}`,
      columns,
      data: exportRows,
      summaryRows: [summaryRow],
      filenamePrefix: 'trial_balance',
      customFilename: defaultFilename,
    });
  };

  // Helper for Nature Badge colors
  const getNatureBadgeClass = (nature: string) => {
    const t = (nature || '').toUpperCase();
    if (t.includes('ASSET')) return 'bg-sky-950/80 text-sky-400 border-sky-800/80';
    if (t.includes('LIABILITY')) return 'bg-amber-950/80 text-amber-400 border-amber-800/80';
    if (t.includes('CAPITAL')) return 'bg-purple-950/80 text-purple-400 border-purple-800/80';
    if (t.includes('INCOME') || t.includes('SALES')) return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
    if (t.includes('EXPENSE') || t.includes('PURCHASE')) return 'bg-rose-950/80 text-rose-400 border-rose-800/80';
    return 'bg-slate-900 text-slate-400 border-slate-700';
  };

  return (
    <div className="space-y-2.5 text-slate-300 font-mono">
      {/* 1. Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl shrink-0 shadow-sm space-y-2">
        {/* Line 1: Title, counts & View Mode toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
              <h1 className="text-sm font-bold text-white tracking-tight uppercase flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-400" />
                Trial Balance
              </h1>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                {groupedData.length} Groups &bull; {filteredItems.length} Accounts
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Double-entry ledger verification with Group hierarchy. Click any ledger to open its account statement in a new tab.
            </p>
          </div>

          {/* Action Controls & Format Selector */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* View Mode Selector: DETAILED, SUMMARY, FLAT */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('GROUPED_DETAILED')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  viewMode === 'GROUPED_DETAILED'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Detailed view grouped by Account Group"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>DETAILED</span>
              </button>
              <button
                onClick={() => setViewMode('GROUPED_SUMMARY')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  viewMode === 'GROUPED_SUMMARY'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Compact group totals summary"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>SUMMARY</span>
              </button>
              <button
                onClick={() => setViewMode('FLAT')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  viewMode === 'FLAT'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Alphabetical flat accounts list"
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>FLAT</span>
              </button>
            </div>

            {/* Hide Zero Toggle */}
            <button
              onClick={() => setHideZero(!hideZero)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold transition cursor-pointer text-xs ${
                hideZero
                  ? 'bg-sky-950/80 text-sky-300 border-sky-700/80 hover:bg-sky-900/80'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={hideZero ? 'Zero balance accounts are currently hidden' : 'Showing all accounts including zero balance'}
            >
              {hideZero ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{hideZero ? 'ZERO HIDDEN' : 'SHOW ALL'}</span>
            </button>
          </div>
        </div>

        {/* Line 2: Date Range (From Date & To Date) and Actions (PDF, Excel, Print) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* From Date & To Date */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                From Date:
              </span>
              <DateInput value={fromDate} onChange={setFromDate} className="w-36" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                To Date:
              </span>
              <DateInput value={toDate} onChange={setToDate} className="w-36" />
            </div>
          </div>

          {/* Actions: PDF, EXCEL, PRINT */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 transition cursor-pointer font-bold text-xs"
              title="Export Trial Balance to PDF"
            >
              <PdfFileIcon className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 transition cursor-pointer font-bold text-xs"
              title="Export Trial Balance to Excel (XLSX)"
            >
              <ExcelFileIcon className="w-3.5 h-3.5" />
              <span>EXCEL</span>
            </button>

            <button
              onClick={ExportEngine.printReport}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 transition cursor-pointer font-bold text-xs"
              title="Print Trial Balance"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>PRINT</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="SEARCH LEDGER / GROUP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Account Nature Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Account Natures</option>
              <option value="ASSET">Assets Only</option>
              <option value="LIABILITY">Liabilities Only</option>
              <option value="CAPITAL">Capital Only</option>
              <option value="INCOME">Income Only</option>
              <option value="EXPENSE">Expenses Only</option>
            </select>
          </div>
        </div>

        {/* Quick Utilities */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'GROUPED_DETAILED' && (
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={expandAllGroups}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={collapseAllGroups}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}

          {hideZero && hiddenZeroCount > 0 && (
            <button
              onClick={() => setHideZero(false)}
              className="text-[11px] text-sky-400 hover:underline cursor-pointer bg-sky-950/40 px-2 py-1 rounded border border-sky-800/50"
              title="Click to view zero balance accounts"
            >
              {hiddenZeroCount} Zero Accounts Hidden
            </button>
          )}
        </div>
      </div>

      {/* 3. Trial Balance Display Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
            Computing Trial Balance from Ledger Accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              {/* Header */}
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[10.5px] uppercase tracking-wider leading-tight">
                <tr>
                  <th className="py-0.5 px-3.5 w-12 text-center">#</th>
                  <th className="py-0.5 px-4">Particulars / Account Name</th>
                  <th className="py-0.5 px-3.5">Account Group &bull; Nature</th>
                  <th className="py-0.5 px-4 text-right text-sky-400 w-44">Debit Balance (₹)</th>
                  <th className="py-0.5 px-4 text-right text-emerald-400 w-44">Credit Balance (₹)</th>
                </tr>
              </thead>

              {/* VIEW MODE 1: GROUPED DETAILED (DEFAULT) */}
              {viewMode === 'GROUPED_DETAILED' && (
                <tbody className="divide-y divide-slate-800/60">
                  {groupedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                        <Scale className="w-8 h-8 mx-auto mb-2 text-amber-400 opacity-40" />
                        No ledger accounts found matching the current criteria.
                        {hideZero && (
                          <div className="mt-2">
                            <button
                              onClick={() => setHideZero(false)}
                              className="text-amber-400 hover:underline cursor-pointer"
                            >
                              Show zero balance accounts
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    groupedData.map((group, groupIdx) => {
                      const isCollapsed = !!collapsedGroups[group.groupName];

                      return (
                        <React.Fragment key={group.groupName}>
                          {/* Group Sectional Header Row */}
                          <tr
                            onClick={() => toggleGroup(group.groupName)}
                            className="transition cursor-pointer select-none border-t border-slate-800 bg-slate-950/80 hover:bg-slate-800/60"
                          >
                            <td className="py-1 px-3 text-center text-amber-400">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 mx-auto" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 mx-auto" />
                              )}
                            </td>
                            <td className="py-1 px-3 font-bold text-white text-xs">
                              <div className="flex items-center gap-1.5">
                                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="uppercase tracking-tight text-amber-300">
                                  {group.groupName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-normal px-1 py-0.2 rounded bg-slate-900 border border-slate-800">
                                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                            </td>
                            <td className="py-1 px-3">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${getNatureBadgeClass(
                                  group.accountType
                                )}`}
                              >
                                {group.accountType.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-1 px-3 text-right font-bold text-sky-400 text-xs">
                              {group.totalDebit > 0
                                ? `₹${group.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                : '-'}
                            </td>
                            <td className="py-1 px-3 text-right font-bold text-emerald-400 text-xs">
                              {group.totalCredit > 0
                                ? `₹${group.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                : '-'}
                            </td>
                          </tr>

                          {/* Member Ledger Rows */}
                          {!isCollapsed &&
                            group.items.map((item, itemIdx) => {
                              return (
                                <tr
                                  key={item.ledgerId}
                                  onClick={() => handleViewLedger(item.ledgerId, item.ledgerName)}
                                  className="transition hover:bg-slate-800/60 bg-slate-900/40 cursor-pointer group"
                                  title={`Click to view ${item.ledgerName} statement`}
                                >
                                  <td className="py-1 px-3 text-center text-slate-600 text-[10px]">
                                    {groupIdx + 1}.{itemIdx + 1}
                                  </td>
                                  <td className="py-1 px-3 pl-8 text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap group/item">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-amber-400 transition-colors"></span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewLedger(item.ledgerId, item.ledgerName);
                                        }}
                                        className="font-semibold text-slate-200 group-hover:text-amber-300 hover:underline text-left cursor-pointer transition inline-flex items-center gap-1 text-xs"
                                        title={`Click to view ${item.ledgerName} statement`}
                                      >
                                        <span>{item.ledgerName}</span>
                                      </button>
                                      <a
                                        href={getLedgerHref(item.ledgerId, item.ledgerName)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleLedgerClick(item.ledgerId, item.ledgerName);
                                        }}
                                        className="text-slate-500 hover:text-amber-400 opacity-50 hover:opacity-100 transition p-0.5 rounded hover:bg-slate-800"
                                        title={`Open ${item.ledgerName} in new browser tab`}
                                      >
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    </div>
                                  </td>
                                  <td className="py-1 px-3 text-slate-400 text-[11px]">
                                    <span className="text-slate-500">{group.groupName}</span>
                                  </td>
                                  <td className="py-1 px-3 text-right font-mono text-sky-300 font-medium text-xs">
                                    {(item.closingDebit || 0) > 0
                                      ? `₹${item.closingDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                      : '-'}
                                  </td>
                                  <td className="py-1 px-3 text-right font-mono text-emerald-300 font-medium text-xs">
                                    {(item.closingCredit || 0) > 0
                                      ? `₹${item.closingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                      : '-'}
                                  </td>
                                </tr>
                              );
                            })}

                          {/* Subtotal Row for multi-item groups */}
                          {!isCollapsed && group.items.length > 1 && (
                            <tr className="bg-slate-950/40 text-slate-400 text-[11px] font-semibold border-b border-slate-800/80">
                              <td></td>
                              <td className="py-1 px-3 pl-8 text-slate-400 italic text-xs">
                                Subtotal &bull; {group.groupName}:
                              </td>
                              <td></td>
                              <td className="py-1 px-3 text-right font-bold text-sky-400/90 border-t border-slate-800 text-xs">
                                {group.totalDebit > 0
                                  ? `₹${group.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                              <td className="py-1 px-3 text-right font-bold text-emerald-400/90 border-t border-slate-800 text-xs">
                                {group.totalCredit > 0
                                  ? `₹${group.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              )}

              {/* VIEW MODE 2: GROUPED SUMMARY */}
              {viewMode === 'GROUPED_SUMMARY' && (
                <tbody className="divide-y divide-slate-800/60">
                  {groupedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                        No groups found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    groupedData.map((group, idx) => (
                      <tr
                        key={group.groupName}
                        className="hover:bg-slate-800/40 transition group cursor-pointer"
                        onClick={() => setViewMode('GROUPED_DETAILED')}
                        title="Click to switch to detailed view for this group"
                      >
                        <td className="py-1 px-3 text-center text-slate-500 text-[10px]">{idx + 1}</td>
                        <td className="py-1 px-3">
                          <div className="flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-bold text-white group-hover:text-amber-300 transition text-xs">
                              {group.groupName}
                            </span>
                            <span className="text-[9px] text-slate-400 bg-slate-950 px-1 py-0.2 rounded border border-slate-800">
                              {group.items.length} {group.items.length === 1 ? 'account' : 'accounts'}
                            </span>
                          </div>
                        </td>
                        <td className="py-1 px-3">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${getNatureBadgeClass(
                              group.accountType
                            )}`}
                          >
                            {group.accountType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-1 px-3 text-right font-bold text-sky-400 text-xs">
                          {group.totalDebit > 0
                            ? `₹${group.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className="py-1 px-3 text-right font-bold text-emerald-400 text-xs">
                          {group.totalCredit > 0
                            ? `₹${group.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}

              {/* VIEW MODE 3: FLAT LIST */}
              {viewMode === 'FLAT' && (
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                        No accounts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr
                        key={item.ledgerId}
                        onClick={() => handleViewLedger(item.ledgerId, item.ledgerName)}
                        className="hover:bg-slate-800/60 transition cursor-pointer group"
                        title={`Click to view ${item.ledgerName} statement`}
                      >
                        <td className="py-1 px-3 text-center text-slate-600 text-[10px]">{idx + 1}</td>
                        <td className="py-1 px-3 font-semibold text-white">
                          <div className="flex items-center gap-1.5 group/item">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewLedger(item.ledgerId, item.ledgerName);
                              }}
                              className="font-semibold text-slate-200 group-hover:text-amber-300 hover:underline text-left cursor-pointer transition inline-flex items-center gap-1 text-xs"
                              title={`Click to view ${item.ledgerName} statement`}
                            >
                              <span>{item.ledgerName}</span>
                            </button>
                            <a
                              href={getLedgerHref(item.ledgerId, item.ledgerName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLedgerClick(item.ledgerId, item.ledgerName);
                              }}
                              className="text-slate-500 hover:text-amber-400 opacity-50 hover:opacity-100 transition p-0.5 rounded hover:bg-slate-800"
                              title={`Open ${item.ledgerName} in new browser tab`}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        </td>
                        <td className="py-1 px-3 text-slate-400 text-[11px]">
                          <span className="text-slate-300">{item.groupName}</span>
                          <span className="ml-2 text-[9px] px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400 uppercase">
                            {item.accountType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-sky-300 font-bold text-xs">
                          {(item.closingDebit || 0) > 0
                            ? `₹${item.closingDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-emerald-300 font-bold text-xs">
                          {(item.closingCredit || 0) > 0
                            ? `₹${item.closingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}

              {/* Table Footer: GRAND TOTAL ROW */}
              <tfoot className="bg-slate-950 text-slate-200 font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={3} className="py-1.5 px-3 text-right uppercase tracking-wider text-xs text-amber-400">
                    GRAND TRIAL BALANCE TOTAL ({filteredItems.length} Items):
                  </td>
                  <td className="py-1.5 px-3 text-right text-sky-400 text-xs whitespace-nowrap font-mono">
                    ₹{displayedTotals.closingDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-3 text-right text-emerald-400 text-xs whitespace-nowrap font-mono">
                    ₹{displayedTotals.closingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 4. Audit Verification & Balance Verification Footer */}
      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {displayedTotals.isClosingBalanced ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="font-bold">ARITHMETIC ACCURACY VERIFIED:</span>
              <span className="text-slate-400">
                Dual-entry debits match credits exactly (Debit: ₹{displayedTotals.closingDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} = Credit: ₹{displayedTotals.closingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-bold">IMBALANCE DETECTED:</span>
              <span>
                Difference of ₹{displayedTotals.closingDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })} between Debit &amp; Credit.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>
            Mode: <strong className="text-slate-300">{viewMode.replace('GROUPED_', '')}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
