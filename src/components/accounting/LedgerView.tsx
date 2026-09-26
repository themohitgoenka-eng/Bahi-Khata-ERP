import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, LedgerSummary } from '../../services/accountingEngine';
import { Ledger } from '../../types';
import { ExportEngine } from '../../services/exportEngine';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  BookOpen,
  Search,
  Calendar,
  FileDown,
  Printer,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Plus,
  ArrowLeft,
} from 'lucide-react';

export const LedgerView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    ledgers,
    openVoucherModal,
    selectedLedgerId: contextLedgerId,
    setSelectedLedgerId: setContextLedgerId,
    selectedLedgerName: contextLedgerName,
    setSelectedLedgerName: setContextLedgerName,
    isSystemInitialized,
    setActiveTab,
    openOrSwitchTab,
  } = useApp();

  // Helper to resolve candidate ledger ID/name against available ledgers in active DB
  const resolveTargetLedger = useCallback(
    (candId?: string | null, candName?: string | null, list: Ledger[] = ledgers): string => {
      if (!list || list.length === 0) return candId || '';

      // 1. Direct ID match (exact and case-insensitive)
      if (candId) {
        const cleanCandId = candId.trim();
        const byId = list.find((l) => l.id === cleanCandId || l.id.toLowerCase() === cleanCandId.toLowerCase());
        if (byId) return byId.id;
      }

      // 2. Direct Name match (case-insensitive)
      if (candName) {
        const cleanName = candName.trim().toLowerCase();
        const byName = list.find((l) => l.name.trim().toLowerCase() === cleanName);
        if (byName) return byName.id;
      }

      // 3. candId might actually be a name
      if (candId) {
        const cleanCandId = candId.trim().toLowerCase();
        const byCandIdAsName = list.find((l) => l.name.trim().toLowerCase() === cleanCandId);
        if (byCandIdAsName) return byCandIdAsName.id;
      }

      // 4. If an explicit candidate ID was passed, trust it
      if (candId && candId.trim()) {
        return candId.trim();
      }

      // 5. Default to first ledger in master only if NO candidate was requested
      return list[0]?.id || '';
    },
    [ledgers]
  );

  // Initialize from context or URL param or first ledger in master
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(() => {
    if (contextLedgerId) return contextLedgerId;
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const paramId = params.get('ledgerId');
        if (paramId) return paramId;
      } catch {
        // ignore
      }
    }
    return ledgers[0]?.id || '';
  });

  const [fromDate, setFromDate] = useState<string>(currentFiscalYear?.startDate || '2026-04-01');
  const [toDate, setToDate] = useState<string>(getTodayISO());
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Synchronize and resolve candidate ledger whenever ledgers master is loaded or context changes
  useEffect(() => {
    let targetId = contextLedgerId;
    let targetName = contextLedgerName;

    if (!targetId && !targetName && typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        targetId = params.get('ledgerId');
        targetName = params.get('ledgerName');
      } catch {
        // ignore
      }
    }

    if (targetId || targetName || (ledgers && ledgers.length > 0)) {
      const resolved = resolveTargetLedger(targetId, targetName, ledgers);
      if (
        resolved &&
        (!selectedLedgerId || !ledgers.some((l) => l.id === selectedLedgerId) || (targetId && resolved !== selectedLedgerId))
      ) {
        setSelectedLedgerId(resolved);
        setContextLedgerId?.(resolved);
        const matched = ledgers.find((l) => l.id === resolved);
        if (matched && setContextLedgerName) {
          setContextLedgerName(matched.name);
        }
      }
    }
  }, [
    contextLedgerId,
    contextLedgerName,
    ledgers,
    resolveTargetLedger,
    selectedLedgerId,
    setContextLedgerId,
    setContextLedgerName,
  ]);

  // Sync fromDate with fiscal year start date once fiscal year is ready
  useEffect(() => {
    if (currentFiscalYear?.startDate && (!fromDate || fromDate === '2026-04-01')) {
      setFromDate(currentFiscalYear.startDate);
    }
  }, [currentFiscalYear]);

  // Fetch summary whenever selected ledger, date range, or company context changes
  useEffect(() => {
    if (!selectedLedgerId || !isSystemInitialized || !currentCompany) return;

    let isCancelled = false;
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await accountingEngine.getLedgerSummary(
          selectedLedgerId,
          fromDate || currentFiscalYear?.startDate || undefined,
          toDate || undefined
        );
        if (!isCancelled) {
          setSummary(res);
        }
      } catch (err) {
        console.error('Failed to load ledger summary:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchSummary();
    return () => {
      isCancelled = true;
    };
  }, [selectedLedgerId, fromDate, toDate, currentCompany, currentFiscalYear, isSystemInitialized]);

  // Keyboard navigation for Ledger Statement report table
  const rowsCount = summary?.rows?.length || 0;
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: rowsCount,
    tableId: 'ledger-report-table',
  });

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear || !summary) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Ledger Statement: ${summary.ledger.name}`,
      subtitle: `Account Group: ${summary.group?.name || 'General'} | Account Type: ${summary.ledger.accountType}`,
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(toDate)}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher No', dataKey: 'voucherNo' },
        { header: 'Type', dataKey: 'voucherType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Debit (₹)', dataKey: 'debit', align: 'right' },
        { header: 'Credit (₹)', dataKey: 'credit', align: 'right' },
        { header: 'Balance (₹)', dataKey: 'balance', align: 'right' },
      ],
      data: [
        {
          date: formatDateDisplay(fromDate || currentFiscalYear.startDate),
          voucherNo: '-',
          voucherType: 'OP-BAL',
          particulars: 'To Opening Balance',
          debit: summary.openingBalanceType === 'DR' ? summary.openingBalance : 0,
          credit: summary.openingBalanceType === 'CR' ? summary.openingBalance : 0,
          balance: `${summary.openingBalance.toFixed(2)} ${summary.openingBalanceType}`,
        },
        ...summary.rows.map((r) => ({
          date: formatDateDisplay(r.date),
          voucherNo: r.voucherNo,
          voucherType: r.voucherType,
          particulars: r.particulars,
          debit: r.debit > 0 ? r.debit : '',
          credit: r.credit > 0 ? r.credit : '',
          balance: `${r.runningBalance.toFixed(2)} ${r.balanceType}`,
        })),
      ],
      summaryRows: [
        {
          date: 'CLOSING',
          voucherNo: '-',
          voucherType: '',
          particulars: 'Closing Balance',
          debit: summary.totalDebit,
          credit: summary.totalCredit,
          balance: `${summary.closingBalance.toFixed(2)} ${summary.closingBalanceType}`,
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear || !summary) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Ledger Statement - ${summary.ledger.name}`,
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(toDate)}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher Number', dataKey: 'voucherNo' },
        { header: 'Voucher Type', dataKey: 'voucherType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Debit (INR)', dataKey: 'debit' },
        { header: 'Credit (INR)', dataKey: 'credit' },
        { header: 'Running Balance', dataKey: 'balance' },
        { header: 'Narration', dataKey: 'narration' },
      ],
      data: [
        {
          date: formatDateDisplay(fromDate || currentFiscalYear.startDate),
          voucherNo: '-',
          voucherType: 'OPENING',
          particulars: 'To Opening Balance',
          debit: summary.openingBalanceType === 'DR' ? summary.openingBalance : 0,
          credit: summary.openingBalanceType === 'CR' ? summary.openingBalance : 0,
          balance: `${summary.openingBalance.toFixed(2)} ${summary.openingBalanceType}`,
          narration: 'Brought forward balance',
        },
        ...summary.rows.map((r) => ({
          date: formatDateDisplay(r.date),
          voucherNo: r.voucherNo,
          voucherType: r.voucherType,
          particulars: r.particulars,
          debit: r.debit,
          credit: r.credit,
          balance: `${r.runningBalance.toFixed(2)} ${r.balanceType}`,
          narration: r.narration || '',
        })),
      ],
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveTab('trial_balance')}
          className="text-[#7F98AE] hover:text-[#2588E8] flex items-center gap-1 transition cursor-pointer font-medium"
          title="Return to Trial Balance"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trial Balance</span>
        </button>
        <span className="text-[#7F98AE]/50">/</span>
        <span className="text-[#2588E8] font-bold">
          {summary?.ledger.name || 'Account Ledger'}
        </span>
        {summary?.group?.name && (
          <span className="text-[10px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] text-[#B7C9D9] px-2 py-0.5 rounded-full">
            {summary.group.name}
          </span>
        )}
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#2588E8]" />
            Ledger Statement &amp; Running Balance
          </h1>
          <p className="text-[11px] text-[#B7C9D9]">
            Account statement showing chronological debit, credit transactions and running balances.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={ExportEngine.printReport}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#2588E8]" />
            Print
          </button>
          <button
            onClick={() => openVoucherModal('PAYMENT')}
            className="flex items-center gap-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Voucher
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl text-xs shadow-sm">
        <div>
          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-0.5">
            Select Account Ledger:
          </label>
          <select
            value={selectedLedgerId}
            onChange={(e) => {
              const newId = e.target.value;
              const matched = ledgers.find((l) => l.id === newId);
              if (openOrSwitchTab) {
                openOrSwitchTab('ledgers', newId, matched?.name || null);
              } else {
                setSelectedLedgerId(newId);
                setContextLedgerId?.(newId);
                if (matched && setContextLedgerName) {
                  setContextLedgerName(matched.name);
                }
              }
            }}
            className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1 text-xs text-[#FFFFFF] font-bold focus:outline-none focus:ring-1 focus:ring-[#2588E8] cursor-pointer"
          >
            {ledgers.map((l) => (
              <option key={l.id} value={l.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-0.5">
            From Date:
          </label>
          <DateInput
            value={fromDate}
            onChange={setFromDate}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-0.5">
            To Date:
          </label>
          <DateInput
            value={toDate}
            onChange={setToDate}
            className="w-full"
          />
        </div>
      </div>

      {/* Loading State */}
      {(!isSystemInitialized || (loading && !summary)) && (
        <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-12 text-center text-[#7F98AE]">
          <div className="w-8 h-8 border-2 border-[#2588E8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold text-[#FFFFFF]">Loading Account Ledger...</p>
          <p className="text-xs text-[#7F98AE] mt-1">Retrieving account statement and calculating running balance</p>
        </div>
      )}

      {/* Empty / Not Found State */}
      {isSystemInitialized && !loading && !summary && (
        <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-8 text-center text-[#7F98AE]">
          <p className="text-sm font-bold text-[#FFFFFF] mb-1">No Ledger Account Selected</p>
          <p className="text-xs text-[#7F98AE]">
            Please choose an account from the dropdown above to view transactions and running balance.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm">
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase">Opening Balance</div>
            <div className="text-sm font-mono font-bold text-[#FFFFFF] mt-0.5">
              ₹{summary.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs text-[#2588E8] font-semibold">{summary.openingBalanceType}</span>
            </div>
            {(summary.ledger.openingBalancePakka !== undefined || summary.ledger.openingBalanceKacha !== undefined) && (
              <div className="mt-1 pt-1 border-t border-[rgba(112,185,245,0.25)] text-[10px] font-mono space-y-0.5">
                <div className="flex justify-between items-center text-emerald-400">
                  <span>1. Pakka:</span>
                  <span>₹{(summary.ledger.openingBalancePakka || 0).toLocaleString('en-IN')} {summary.ledger.openingBalancePakkaType || 'DR'}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span>2. Kacha:</span>
                  <span>₹{(summary.ledger.openingBalanceKacha || 0).toLocaleString('en-IN')} {summary.ledger.openingBalanceKachaType || 'DR'}</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm">
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase">Period Total Debit</div>
            <div className="text-sm font-mono font-bold text-[#FFFFFF] mt-0.5">
              ₹{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm">
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase">Period Total Credit</div>
            <div className="text-sm font-mono font-bold text-[#2588E8] mt-0.5">
              ₹{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm">
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase">Closing Balance</div>
            <div className="text-sm font-mono font-bold text-[#2588E8] mt-0.5">
              ₹{summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs text-[#FFFFFF] font-semibold">{summary.closingBalanceType}</span>
            </div>
          </div>
        </div>
      )}

      {/* Statement Table */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] text-[10.5px] leading-tight">
              <tr>
                <th className="py-0.5 px-3">Date (DD/MM/YYYY)</th>
                <th className="py-0.5 px-3">Voucher No</th>
                <th className="py-0.5 px-3">Type</th>
                <th className="py-0.5 px-3">Particulars</th>
                <th className="py-0.5 px-3 text-right">Debit (₹)</th>
                <th className="py-0.5 px-3 text-right">Credit (₹)</th>
                <th className="py-0.5 px-3 text-right">Running Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {/* Opening Balance Row */}
              {summary && (
                <tr className="bg-[rgba(18,48,76,0.42)] backdrop-blur-xl text-[#B7C9D9] font-semibold italic">
                  <td className="py-1 px-3 font-mono text-xs">{formatDateDisplay(fromDate || currentFiscalYear?.startDate)}</td>
                  <td className="py-1 px-3 text-xs">-</td>
                  <td className="py-1 px-3">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] border border-[rgba(112,185,245,0.25)]">OP-BAL</span>
                  </td>
                  <td className="py-1 px-3 text-xs">To Opening Balance b/f</td>
                  <td className="py-1 px-3 text-right font-mono text-[#FFFFFF] text-xs">
                    {summary.openingBalanceType === 'DR' ? `₹${summary.openingBalance.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-[#2588E8] text-xs">
                    {summary.openingBalanceType === 'CR' ? `₹${summary.openingBalance.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                    ₹{summary.openingBalance.toFixed(2)} {summary.openingBalanceType}
                  </td>
                </tr>
              )}

              {/* Transactions */}
              {summary && summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[#7F98AE] italic text-xs">
                    No transactions recorded for this ledger in the selected date range.
                  </td>
                </tr>
              ) : (
                summary?.rows.map((row, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={row.id}
                      data-table-id="ledger-report-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(57,167,255,0.06)]'
                      }`}
                    >
                    <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-xs">{formatDateDisplay(row.date)}</td>
                    <td className="py-1 px-3 font-mono font-bold text-[#2588E8] whitespace-nowrap text-xs">
                      {row.voucherNo}
                    </td>
                    <td className="py-1 px-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]">
                        {row.voucherType}
                      </span>
                    </td>
                    <td className="py-1 px-3">
                      <div className="font-medium text-[#FFFFFF] text-xs leading-tight">{row.particulars}</div>
                      {row.narration && <div className="text-[10px] text-[#7F98AE] italic truncate max-w-sm">{row.narration}</div>}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                      {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      ₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] text-[#2588E8] font-semibold">{row.balanceType}</span>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {summary && (
              <tfoot className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-bold border-t border-[rgba(112,185,245,0.25)]">
                <tr>
                  <td colSpan={4} className="py-1.5 px-3 text-right font-semibold text-xs">
                    Closing Balance as of {toDate || 'Today'}:
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[#FFFFFF] text-xs">
                    ₹{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[#2588E8] text-xs">
                    ₹{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[#2588E8] text-xs font-bold">
                    ₹{summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                    <span className="text-[10px] font-semibold text-[#FFFFFF]">{summary.closingBalanceType}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
