import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, LedgerSummary } from '../../services/accountingEngine';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { ExportEngine } from '../../services/exportEngine';
import { DateInput } from '../common/DateInput';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { formatDateDisplay, getTodayISO, parseDisplayToISO } from '../../utils/dateUtils';
import { Voucher, VoucherType } from '../../types';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Calendar,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const CashBookView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    ledgers,
    openVoucherModal,
    voucherModalOpen,
    vouchersVersion,
    showNotification,
    refreshActiveData,
  } = useApp();

  // Find all cash-related ledgers
  const cashLedgers = ledgers.filter(
    (l) => l.groupId === 'grp-cash-in-hand' || l.name.toLowerCase().includes('cash')
  );

  const [selectedCashId, setSelectedCashId] = useState<string>(cashLedgers[0]?.id || 'ALL');
  const [fromDate, setFromDate] = useState<string>(currentFiscalYear?.startDate || getTodayISO());
  const [toDate, setToDate] = useState<string>(currentFiscalYear?.endDate || getTodayISO());
  const [appliedFromDate, setAppliedFromDate] = useState<string>(currentFiscalYear?.startDate || getTodayISO());
  const [appliedToDate, setAppliedToDate] = useState<string>(currentFiscalYear?.endDate || getTodayISO());
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [vouchersMap, setVouchersMap] = useState<Record<string, Voucher>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters for CRUD Table
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'RECEIPT' | 'PAYMENT' | 'CONTRA'>('ALL');

  // Modals for CRUD operations
  const [selectedVoucherForView, setSelectedVoucherForView] = useState<Voucher | null>(null);
  const [voucherToDelete, setVoucherToDelete] = useState<{ id: string; voucherNumber: string; amount: number; date: string; particulars: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedCashId && cashLedgers.length > 0) {
      setSelectedCashId(cashLedgers[0].id);
    }
  }, [cashLedgers, selectedCashId]);

  // Default to company's active/open financial year dates when fiscal year loads or changes
  useEffect(() => {
    if (currentFiscalYear) {
      const start = currentFiscalYear.startDate;
      const end = currentFiscalYear.endDate || getTodayISO();
      setFromDate(start);
      setToDate(end);
      setAppliedFromDate(start);
      setAppliedToDate(end);
    }
  }, [currentFiscalYear]);

  const loadCashData = async (fDate?: string, tDate?: string) => {
    if (!selectedCashId) return;
    const start = fDate !== undefined ? fDate : appliedFromDate;
    const end = tDate !== undefined ? tDate : appliedToDate;
    setLoading(true);
    try {
      const [res, allVouchers] = await Promise.all([
        accountingEngine.getLedgerSummary(selectedCashId, start || undefined, end || undefined),
        dbStorage.getVouchers(),
      ]);

      setSummary(res);

      // Create lookup map for fast voucher retrieval
      const vMap: Record<string, Voucher> = {};
      for (const v of allVouchers) {
        vMap[v.id] = v;
      }
      setVouchersMap(vMap);
    } catch (err) {
      console.error('Error loading cash book data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashData(appliedFromDate, appliedToDate);
  }, [selectedCashId, appliedFromDate, appliedToDate, currentCompany, vouchersVersion]);

  // Re-fetch automatically when global voucher modal closes
  useEffect(() => {
    if (!voucherModalOpen) {
      loadCashData(appliedFromDate, appliedToDate);
    }
  }, [voucherModalOpen, appliedFromDate, appliedToDate]);

  // Handle OK button click to apply selected From & To date range
  const handleApplyDates = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    loadCashData(fromDate, toDate);
  };

  const hasPendingDateChanges = fromDate !== appliedFromDate || toDate !== appliedToDate;

  // Quick Date Presets
  const setTodayPreset = () => {
    const today = getTodayISO();
    setFromDate(today);
    setToDate(today);
    setAppliedFromDate(today);
    setAppliedToDate(today);
    loadCashData(today, today);
  };

  const setThisMonthPreset = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayIso = getTodayISO();
    setFromDate(firstDay);
    setToDate(todayIso);
    setAppliedFromDate(firstDay);
    setAppliedToDate(todayIso);
    loadCashData(firstDay, todayIso);
  };

  const setFullFyPreset = () => {
    if (currentFiscalYear) {
      const start = currentFiscalYear.startDate;
      const end = currentFiscalYear.endDate || getTodayISO();
      setFromDate(start);
      setToDate(end);
      setAppliedFromDate(start);
      setAppliedToDate(end);
      loadCashData(start, end);
    }
  };

  // Filtered rows for CRUD table
  const filteredRows = useMemo(() => {
    if (!summary) return [];
    return summary.rows.filter((row) => {
      // Type Filter
      if (filterType === 'RECEIPT' && row.debit <= 0) return false;
      if (filterType === 'PAYMENT' && row.credit <= 0) return false;
      if (filterType === 'CONTRA' && row.voucherType !== 'CONTRA') return false;

      // Search Term Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesVoucherNo = row.voucherNo.toLowerCase().includes(query);
        const matchesParticulars = row.particulars.toLowerCase().includes(query);
        const matchesNarration = (row.narration || '').toLowerCase().includes(query);
        const matchesRef = (row.referenceNo || '').toLowerCase().includes(query);
        const matchesAmount =
          row.debit.toString().includes(query) || row.credit.toString().includes(query);

        return matchesVoucherNo || matchesParticulars || matchesNarration || matchesRef || matchesAmount;
      }

      return true;
    });
  }, [summary, filterType, searchTerm]);

  // Keyboard navigation for Cash Book rows
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredRows.length,
    tableId: 'cashbook-table',
    enabled: !voucherToDelete && !selectedVoucherForView,
    onEnter: (idx) => {
      const row = filteredRows[idx];
      if (row) {
        handleViewVoucher(row.voucherId);
      }
    },
  });

  // Handle Edit Voucher (CRUD Update)
  const handleEditVoucher = (voucherId: string) => {
    const voucher = vouchersMap[voucherId];
    if (voucher) {
      openVoucherModal(voucher.voucherType, voucher);
    } else {
      showNotification('Voucher record not found for editing.', 'error');
    }
  };

  // Handle Delete Voucher (CRUD Delete)
  const handleDeleteClick = (row: (typeof summary.rows)[0]) => {
    setVoucherToDelete({
      id: row.voucherId,
      voucherNumber: row.voucherNo,
      amount: row.debit > 0 ? row.debit : row.credit,
      date: row.date,
      particulars: row.particulars,
    });
  };

  const handleConfirmDelete = async () => {
    if (!voucherToDelete) return;
    try {
      setIsDeleting(true);
      await dbStorage.deleteVoucher(voucherToDelete.id);
      showNotification(`Cash voucher "${voucherToDelete.voucherNumber}" deleted successfully.`, 'success');
      setVoucherToDelete(null);
      await loadCashData(appliedFromDate, appliedToDate);
      await refreshActiveData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete voucher.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle View Voucher (CRUD Read Details)
  const handleViewVoucher = (voucherId: string) => {
    const voucher = vouchersMap[voucherId];
    if (voucher) {
      setSelectedVoucherForView(voucher);
    } else {
      showNotification('Voucher record details not found.', 'info');
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear || !summary) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Cash Book: ${summary.ledger.name}`,
      periodText: `From: ${formatDateDisplay(appliedFromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(appliedToDate)}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher No', dataKey: 'voucherNo' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Receipt (Dr ₹)', dataKey: 'receipt', align: 'right' },
        { header: 'Payment (Cr ₹)', dataKey: 'payment', align: 'right' },
        { header: 'Cash Balance', dataKey: 'balance', align: 'right' },
      ],
      data: [
        {
          date: formatDateDisplay(appliedFromDate || currentFiscalYear.startDate),
          voucherNo: '-',
          type: 'OPENING',
          particulars: 'To Opening Balance in Hand',
          receipt: summary.openingBalanceType === 'DR' ? summary.openingBalance : '',
          payment: summary.openingBalanceType === 'CR' ? summary.openingBalance : '',
          balance: `₹${summary.openingBalance.toFixed(2)}`,
        },
        ...filteredRows.map((r) => ({
          date: formatDateDisplay(r.date),
          voucherNo: r.voucherNo,
          type: r.voucherType || 'VOUCHER',
          particulars: r.particulars,
          receipt: r.debit > 0 ? r.debit : '',
          payment: r.credit > 0 ? r.credit : '',
          balance: `₹${r.runningBalance.toFixed(2)}`,
        })),
      ],
      summaryRows: [
        {
          date: 'TOTAL',
          voucherNo: `${filteredRows.length} Entries`,
          type: '',
          particulars: 'Closing Cash in Hand',
          receipt: summary.totalDebit,
          payment: summary.totalCredit,
          balance: `₹${summary.closingBalance.toFixed(2)}`,
        },
      ],
    });
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear || !summary) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Cash Book - ${summary.ledger.name}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher Number', dataKey: 'voucherNo' },
        { header: 'Voucher Type', dataKey: 'voucherType' },
        { header: 'Particulars / Account', dataKey: 'particulars' },
        { header: 'Reference No', dataKey: 'referenceNo' },
        { header: 'Cash Receipt (Dr ₹)', dataKey: 'debit' },
        { header: 'Cash Payment (Cr ₹)', dataKey: 'credit' },
        { header: 'Running Cash Balance (₹)', dataKey: 'balance' },
        { header: 'Narration / Remarks', dataKey: 'narration' },
      ],
      data: filteredRows.map((r) => ({
        date: formatDateDisplay(r.date),
        voucherNo: r.voucherNo,
        voucherType: r.voucherType,
        particulars: r.particulars,
        referenceNo: r.referenceNo || '-',
        debit: r.debit > 0 ? r.debit : 0,
        credit: r.credit > 0 ? r.credit : 0,
        balance: r.runningBalance,
        narration: r.narration || '-',
      })),
    });
  };

  return (
    <div className="space-y-2">
      {/* Compact Top Header with Quick CRUD Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-lg text-[#2588E8]">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#FFFFFF]">Cash Book</h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]">
                {cashLedgers.find((l) => l.id === selectedCashId)?.name || 'Cash in Hand'}
              </span>
            </div>
            <p className="text-[10.5px] text-[#B7C9D9] hidden sm:block">
              CRUD register for recording physical cash receipts, payments, and contra entries
            </p>
          </div>
        </div>

        {/* Compact CRUD Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Create Cash Receipt */}
          <button
            onClick={() => openVoucherModal('RECEIPT', undefined, selectedCashId !== 'ALL' ? selectedCashId : undefined)}
            className="flex items-center gap-1 bg-[#1b4332] hover:bg-[#245741] text-[#2588E8] font-semibold px-2.5 py-1 rounded-lg text-xs transition border border-[rgba(112,185,245,0.25)] shadow-xs cursor-pointer"
            title="Create Cash Receipt (F6)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Receipt (F6)</span>
          </button>

          {/* Create Cash Payment */}
          <button
            onClick={() => openVoucherModal('PAYMENT', undefined, selectedCashId !== 'ALL' ? selectedCashId : undefined)}
            className="flex items-center gap-1 bg-[#421d23] hover:bg-[#59262f] text-[#fca5a5] font-semibold px-2.5 py-1 rounded-lg text-xs transition border border-rose-800/40 shadow-xs cursor-pointer"
            title="Create Cash Payment (F5)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>- Payment (F5)</span>
          </button>

          {/* Create Contra / Cash Transfer */}
          <button
            onClick={() => openVoucherModal('CONTRA', undefined, selectedCashId !== 'ALL' ? selectedCashId : undefined)}
            className="flex items-center gap-1 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] font-semibold px-2.5 py-1 rounded-lg text-xs transition border border-[rgba(112,185,245,0.25)] shadow-xs cursor-pointer"
            title="Cash Deposit / Withdrawal / Transfer (F4)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Contra (F4)</span>
          </button>

          {/* Compact Export & Refresh Toolbar */}
          <div className="flex items-center gap-1 border-l border-[rgba(112,185,245,0.25)] pl-1.5 ml-0.5">
            <button
              onClick={handleExportExcel}
              title="Export to Excel"
              className="p-1 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] rounded-lg border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
            >
              <ExcelFileIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExportPdf}
              title="Export to PDF"
              className="p-1 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] rounded-lg border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
            >
              <PdfFileIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={ExportEngine.printReport}
              title="Print Cash Book"
              className="p-1 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] rounded-lg border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#2588E8]" />
            </button>
            <button
              onClick={() => loadCashData(appliedFromDate, appliedToDate)}
              title="Refresh Data"
              className="p-1 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] rounded-lg border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2588E8] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Compact Filters & Date Bar */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Cash Ledger Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">Account:</span>
            <select
              value={selectedCashId}
              onChange={(e) => setSelectedCashId(e.target.value)}
              className="bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-1.5 text-xs text-[#FFFFFF] font-bold focus:outline-hidden focus:border-[#2588E8] transition cursor-pointer"
            >
              <option value="ALL" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold">
                All Cash Accounts (Combined)
              </option>
              {cashLedgers.map((l) => (
                <option key={l.id} value={l.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-medium">
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* From & To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">From:</span>
            <DateInput
              value={fromDate}
              onChange={setFromDate}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">To:</span>
            <DateInput
              value={toDate}
              onChange={setToDate}
              className="w-32"
            />
          </div>

          {/* OK Button to apply date range */}
          <button
            type="button"
            onClick={handleApplyDates}
            className={`flex items-center gap-1.5 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-md ${
              hasPendingDateChanges
                ? 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] ring-2 ring-[#2588E8]/50 shadow-[#2588E8]/30 animate-pulse'
                : 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF]'
            }`}
            title="Click OK to load Cash Book data for the selected date range"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>OK</span>
          </button>

          {hasPendingDateChanges && (
            <span className="text-[10px] text-[#2588E8] font-medium italic hidden sm:inline">
              Click OK to apply
            </span>
          )}
        </div>

        {/* Compact Quick Date Presets */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-[#7F98AE] font-semibold mr-1">Period:</span>
          <button
            onClick={setTodayPreset}
            className="px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] font-medium border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={setThisMonthPreset}
            className="px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] font-medium border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
          >
            This Month
          </button>
          <button
            onClick={setFullFyPreset}
            className="px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] font-medium border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
          >
            FY {currentFiscalYear?.name || ''}
          </button>
        </div>
      </div>

      {/* Compact Cash Book CRUD Table Container */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl overflow-hidden shadow-md">
        {/* Compact Table Options Bar: Search & Filter Tabs */}
        <div className="px-3 py-1.5 border-b border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl flex flex-col sm:flex-row gap-2 items-center justify-between">
          {/* Compact Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#7F98AE] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher #, party, narration..."
              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl pl-9 pr-7 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8] transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Compact Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0">
            <span className="text-[10px] font-bold uppercase text-[#7F98AE] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Type:
            </span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-[#2588E8] text-[#FFFFFF] font-bold shadow-xs'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              All ({summary?.rows.length || 0})
            </button>
            <button
              onClick={() => setFilterType('RECEIPT')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'RECEIPT'
                  ? 'bg-[#1b4332] text-[#2588E8] border border-[rgba(112,185,245,0.25)] font-bold shadow-xs'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              <ArrowDownRight className="w-3 h-3 text-[#2588E8]" /> Receipts
            </button>
            <button
              onClick={() => setFilterType('PAYMENT')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'PAYMENT'
                  ? 'bg-[#421d23] text-[#fca5a5] border border-rose-800/50 font-bold shadow-xs'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              <ArrowUpRight className="w-3 h-3 text-[#FF647C]" /> Payments
            </button>
            <button
              onClick={() => setFilterType('CONTRA')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'CONTRA'
                  ? 'bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8] border border-[#2588E8]/40 font-bold shadow-xs'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3 text-[#2588E8]" /> Contra
            </button>
          </div>
        </div>

        {/* Compact CRUD Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] uppercase tracking-wider text-[10px] leading-tight">
              <tr>
                <th className="py-0.5 px-3 w-10 text-center">#</th>
                <th className="py-0.5 px-3">Date</th>
                <th className="py-0.5 px-3">Voucher No</th>
                <th className="py-0.5 px-3">Type</th>
                <th className="py-0.5 px-3">Particulars / Opposite Account</th>
                <th className="py-0.5 px-3 text-right text-[#2588E8]">Receipt (Dr ₹)</th>
                <th className="py-0.5 px-3 text-right text-[#FF647C]">Payment (Cr ₹)</th>
                <th className="py-0.5 px-3 text-right">Cash Balance (₹)</th>
                <th className="py-0.5 px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {/* Opening Balance Row */}
              {summary && filterType === 'ALL' && !searchTerm && (
                <tr className="bg-[rgba(18,48,76,0.42)] backdrop-blur-xl text-[#B7C9D9] italic font-semibold border-b border-[rgba(112,185,245,0.25)] leading-tight">
                  <td className="py-1 px-3 text-center text-[#7F98AE] font-mono text-[10px]">-</td>
                  <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-[10.5px]">
                    {formatDateDisplay(appliedFromDate || currentFiscalYear?.startDate)}
                  </td>
                  <td className="py-1 px-3 text-[#7F98AE] font-mono text-[10.5px]">-</td>
                  <td className="py-1 px-3">
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] border border-[rgba(112,185,245,0.25)]">
                      OPENING
                    </span>
                  </td>
                  <td className="py-1 px-3 text-[#FFFFFF]">To Opening Cash in Hand b/f</td>
                  <td className="py-1 px-3 text-right font-mono text-[#2588E8] text-xs">
                    {summary.openingBalanceType === 'DR' ? `₹${summary.openingBalance.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-[#FF647C] text-xs">
                    {summary.openingBalanceType === 'CR' ? `₹${summary.openingBalance.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                    ₹{summary.openingBalance.toFixed(2)}
                  </td>
                  <td className="py-1 px-3 text-center text-[#7F98AE] text-[10px] italic">
                    Opening
                  </td>
                </tr>
              )}

              {/* Transaction Rows */}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#7F98AE]">
                    <Wallet className="w-6 h-6 mx-auto mb-2 opacity-30 text-[#2588E8]" />
                    <div className="text-xs font-medium text-[#B7C9D9]">No cash entries found for this period</div>
                    <div className="text-[11px] text-[#7F98AE] mt-0.5">
                      Use "+ Receipt (F6)" or "- Payment (F5)" above to add a transaction.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={row.id}
                      data-table-id="cashbook-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition group cursor-pointer leading-tight ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(57,167,255,0.06)]'
                      }`}
                    >
                      <td className="py-1 px-3 text-center font-mono text-[#7F98AE] text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-[10.5px]">
                        {formatDateDisplay(row.date)}
                      </td>
                      <td className="py-1 px-3 whitespace-nowrap">
                        <button
                          onClick={() => handleViewVoucher(row.voucherId)}
                          className="font-mono font-bold text-[#2588E8] hover:text-[#c5e4af] hover:underline transition text-left cursor-pointer text-xs"
                          title="View voucher details"
                        >
                          {row.voucherNo}
                        </button>
                      </td>
                      <td className="py-1 px-3 whitespace-nowrap">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase border ${
                            row.voucherType === 'RECEIPT'
                              ? 'bg-[#1b4332] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
                              : row.voucherType === 'PAYMENT'
                              ? 'bg-[#421d23] text-[#fca5a5] border-rose-800/40'
                              : row.voucherType === 'CONTRA'
                              ? 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border-[rgba(112,185,245,0.25)]'
                              : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] border-[rgba(112,185,245,0.25)]'
                          }`}
                        >
                          {row.voucherType || (row.debit > 0 ? 'RECEIPT' : 'PAYMENT')}
                        </span>
                      </td>
                      <td className="py-1 px-3">
                        <div className="text-[#FFFFFF] font-medium text-xs truncate max-w-sm">{row.particulars}</div>
                        {row.narration && (
                          <div className="text-[10px] text-[#7F98AE] italic truncate max-w-xs">
                            {row.narration}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-semibold text-[#2588E8] text-xs whitespace-nowrap">
                        {row.debit > 0
                          ? `+₹${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-semibold text-[#FF647C] text-xs whitespace-nowrap">
                        {row.credit > 0
                          ? `-₹${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs whitespace-nowrap">
                        ₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* CRUD Read: View Details */}
                          <button
                            onClick={() => handleViewVoucher(row.voucherId)}
                            title="View Voucher Details"
                            className="p-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.2)] text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#2588E8]" />
                          </button>

                          {/* CRUD Update: Edit Voucher */}
                          <button
                            onClick={() => handleEditVoucher(row.voucherId)}
                            title="Edit Voucher Entry"
                            className="p-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.2)] text-[#B7C9D9] hover:text-[#2588E8] border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* CRUD Delete: Delete Voucher */}
                          <button
                            onClick={() => handleDeleteClick(row)}
                            title="Delete Voucher Entry"
                            className="p-1 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#421d23] text-[#B7C9D9] hover:text-[#fca5a5] border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
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

            {/* Compact Table Footer */}
            {summary && (
              <tfoot className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-bold border-t border-[rgba(112,185,245,0.25)]">
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-right font-semibold text-xs">
                    Total ({filteredRows.length} entries):
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#2588E8] text-xs whitespace-nowrap">
                    +₹{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#FF647C] text-xs whitespace-nowrap">
                    -₹{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#2588E8] text-xs font-bold whitespace-nowrap">
                    ₹{summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* CRUD Read: Voucher Detail Modal */}
      {selectedVoucherForView && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-5 w-full max-w-lg space-y-4 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-[rgba(112,185,245,0.25)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#FFFFFF] text-base">
                    Voucher #{selectedVoucherForView.voucherNumber}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase ${
                      selectedVoucherForView.voucherType === 'RECEIPT'
                        ? 'bg-[#1b4332] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                        : selectedVoucherForView.voucherType === 'PAYMENT'
                        ? 'bg-[#421d23] text-[#fca5a5] border border-rose-800/40'
                        : 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                    }`}
                  >
                    {selectedVoucherForView.voucherType}
                  </span>
                </div>
                <p className="text-[#7F98AE] text-xs mt-0.5">
                  Date: {formatDateDisplay(selectedVoucherForView.date)} &bull; Status: {selectedVoucherForView.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedVoucherForView(null)}
                className="p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#FFFFFF] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Transaction Lines */}
            <div className="space-y-2">
              <div className="font-bold text-[#B7C9D9] text-xs uppercase tracking-wider">Accounting Entries (Double-Entry):</div>
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3.5 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2">
                {selectedVoucherForView.lines.map((l, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-[rgba(112,185,245,0.12)] last:border-0">
                    <span className="text-[#FFFFFF]">
                      <span
                        className={`font-bold mr-1.5 px-1.5 py-0.5 rounded-lg text-[10px] ${
                          l.type === 'DR' ? 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]' : 'bg-[#1b4332] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                        }`}
                      >
                        {l.type}
                      </span>
                      {l.ledgerName}
                    </span>
                    <span className="font-mono text-[#FFFFFF] font-bold">
                      ₹{l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>

              {selectedVoucherForView.referenceNo && (
                <div className="text-xs">
                  <span className="font-semibold text-[#7F98AE]">Reference No: </span>
                  <span className="text-[#FFFFFF] font-mono">{selectedVoucherForView.referenceNo}</span>
                </div>
              )}

              {selectedVoucherForView.narration && (
                <div className="text-xs bg-[rgba(18,48,76,0.42)] backdrop-blur-xl p-2.5 rounded-xl border border-[rgba(112,185,245,0.25)]">
                  <span className="font-semibold text-[#7F98AE]">Narration / Remarks: </span>
                  <span className="text-[#B7C9D9] italic">{selectedVoucherForView.narration}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-[rgba(112,185,245,0.25)]">
              <button
                onClick={() => {
                  const v = selectedVoucherForView;
                  setSelectedVoucherForView(null);
                  handleEditVoucher(v.id);
                }}
                className="flex items-center gap-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shadow-md"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit This Voucher
              </button>

              <button
                onClick={() => setSelectedVoucherForView(null)}
                className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] px-4 py-2 rounded-xl font-semibold border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRUD Delete: Confirmation Modal */}
      {voucherToDelete && (
        <ConfirmationModal
          isOpen={true}
          type="DELETE"
          title="Delete Cash Voucher"
          message={`Are you sure you want to permanently delete cash voucher #${voucherToDelete.voucherNumber}? This will reverse its effect and update the cash balance.`}
          itemDetails={[
            { label: 'Voucher Number', value: voucherToDelete.voucherNumber },
            { label: 'Date', value: formatDateDisplay(voucherToDelete.date) },
            { label: 'Particulars', value: voucherToDelete.particulars },
            { label: 'Amount', value: `₹${voucherToDelete.amount.toFixed(2)}` },
          ]}
          confirmLabel="Delete Voucher"
          cancelLabel="Cancel"
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setVoucherToDelete(null)}
        />
      )}
    </div>
  );
};
