import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { accountingEngine } from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { Voucher, VoucherType } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import { VoucherPrintModal } from './VoucherPrintModal';
import {
  FileSpreadsheet,
  Search,
  Filter,
  RotateCcw,
  Printer,
  FileDown,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Pencil,
  MoreVertical,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';

interface VoucherRegisterViewProps {
  initialFilterType?: string;
  title?: string;
}

export const VoucherRegisterView: React.FC<VoucherRegisterViewProps> = ({ initialFilterType = 'ALL', title }) => {
  const { currentCompany, currentFiscalYear, openVoucherModal, showNotification, refreshActiveData, vouchersVersion, notifyVouchersUpdated } = useApp();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>(initialFilterType);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    if (initialFilterType && initialFilterType !== 'ALL') {
      setFilterType(initialFilterType);
    }
  }, [initialFilterType]);
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [activeActionMenu, setActiveActionMenu] = useState<{
    voucher: Voucher;
    top: number;
    left: number;
  } | null>(null);
  const [voucherForPrintView, setVoucherForPrintView] = useState<Voucher | null>(null);

  // Close floating options menu on scroll, resize or click outside
  useEffect(() => {
    if (!activeActionMenu) return;
    const handleClose = () => setActiveActionMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeActionMenu]);

  const isDedicatedRegister = initialFilterType === 'SALES' || initialFilterType === 'PURCHASE';

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await dbStorage.getVouchers();
      const rawVouchers = isDedicatedRegister
        ? data
        : data.filter((v) => v.voucherType !== 'SALES' && v.voucherType !== 'PURCHASE');
      setVouchers(
        [...rawVouchers].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, [currentCompany, currentFiscalYear, initialFilterType, vouchersVersion]);

  const filteredVouchers = vouchers.filter((v) => {
    if (!isDedicatedRegister && (v.voucherType === 'SALES' || v.voucherType === 'PURCHASE')) {
      return false;
    }

    const matchesSearch =
      v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.series && v.series.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.narration && v.narration.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.referenceNo && v.referenceNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.lines.some((l) => l.ledgerName?.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesType = false;
    if (filterType === 'ALL') {
      matchesType = true;
    } else if (filterType === 'DEBIT_NOTE' || filterType === 'PURCHASE_RETURN') {
      matchesType = v.voucherType === 'DEBIT_NOTE' || v.voucherType === 'PURCHASE_RETURN';
    } else if (filterType === 'CREDIT_NOTE' || filterType === 'SALES_RETURN') {
      matchesType = v.voucherType === 'CREDIT_NOTE' || v.voucherType === 'SALES_RETURN';
    } else {
      matchesType = v.voucherType === filterType;
    }

    const matchesStatus = filterStatus === 'ALL' || v.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const totalAmount = filteredVouchers.reduce((s, v) => s + v.totalDebit, 0);

  // Keyboard navigation for Voucher Register table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredVouchers.length,
    tableId: 'voucher-register-table',
    enabled: !voucherToDelete,
    onEnter: (idx) => {
      const v = filteredVouchers[idx];
      if (v) {
        handleEditVoucher(v);
      }
    },
  });

  const handleEditVoucher = (v: Voucher) => {
    openVoucherModal(v.voucherType as VoucherType, v);
  };

  const handleConfirmDelete = async () => {
    if (!voucherToDelete) return;
    try {
      setIsDeleting(true);
      await dbStorage.deleteVoucher(voucherToDelete.id);
      showNotification(`Voucher "${voucherToDelete.voucherNumber}" deleted successfully.`, 'success');
      setVoucherToDelete(null);
      await loadVouchers();
      await refreshActiveData();
      if (notifyVouchersUpdated) notifyVouchersUpdated();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete voucher.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Direct export for a single voucher row (PDF or Excel)
  const handleDirectExport = async (v: Voucher, exportType: 'pdf' | 'excel') => {
    if (!currentCompany || !currentFiscalYear) return;
    try {
      const formattedType =
        v.voucherType === 'PURCHASE_RETURN' || v.voucherType === 'DEBIT_NOTE'
          ? 'DEBIT NOTE'
          : v.voucherType === 'SALES_RETURN' || v.voucherType === 'CREDIT_NOTE'
          ? 'CREDIT NOTE'
          : v.voucherType;

      const dateFormatted = formatDateDisplay(v.date);
      const cleanNo = (v.voucherNumber || 'VOUCHER').replace(/[^a-zA-Z0-9_-]/g, '_');

      const columns = [
        { header: 'S.No', dataKey: 'sno', align: 'center' as const },
        { header: 'Type', dataKey: 'type', align: 'center' as const },
        { header: 'Particulars / Account Name', dataKey: 'ledgerName', align: 'left' as const },
        { header: 'Debit (₹)', dataKey: 'debit', align: 'right' as const },
        { header: 'Credit (₹)', dataKey: 'credit', align: 'right' as const },
      ];

      const data = v.lines.map((line, idx) => ({
        sno: idx + 1,
        type: line.type,
        ledgerName: line.ledgerName || 'Account',
        debit: line.type === 'DR' ? line.amount.toFixed(2) : '-',
        credit: line.type === 'CR' ? line.amount.toFixed(2) : '-',
      }));

      const summaryRows = [
        {
          sno: '',
          type: 'TOTAL',
          ledgerName: v.narration ? `Narration: ${v.narration}` : '',
          debit: v.totalDebit.toFixed(2),
          credit: v.totalCredit.toFixed(2),
        },
      ];

      const exportOptions = {
        company: currentCompany,
        fiscalYear: currentFiscalYear,
        reportTitle: `${formattedType} VOUCHER (${v.voucherNumber})`,
        subtitle: `Voucher No: ${v.voucherNumber} | Date: ${dateFormatted} | Series: ${v.series || 'MAIN'}${v.referenceNo ? ` | Ref: ${v.referenceNo}` : ''}`,
        periodText: `Dated: ${dateFormatted}`,
        columns,
        data,
        summaryRows,
        customFilename: `${cleanNo}_${formattedType}_${dateFormatted.replace(/\//g, '-')}`,
      };

      if (exportType === 'pdf') {
        const res = await ExportEngine.exportToPdf(exportOptions);
        if (res && res.saved) {
          showNotification(`PDF downloaded: ${res.filename}`, 'success');
        }
      } else {
        const res = await ExportEngine.exportToExcel(exportOptions);
        if (res && res.saved) {
          showNotification(`Excel downloaded: ${res.filename}`, 'success');
        }
      }
    } catch (err) {
      console.error('Voucher direct export error:', err);
      showNotification(`Failed to export ${exportType.toUpperCase()}`, 'error');
    }
  };

  const handleOpenPrintView = (v: Voucher) => {
    setVoucherForPrintView(v);
    setActiveActionMenu(null);
  };

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Voucher Register',
      periodText: `Filter: ${filterType} | Records: ${filteredVouchers.length}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher No', dataKey: 'voucherNumber' },
        { header: 'Type', dataKey: 'voucherType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Reference', dataKey: 'referenceNo' },
        { header: 'Amount (₹)', dataKey: 'amount', align: 'right' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: filteredVouchers.map((v) => ({
        date: formatDateDisplay(v.date),
        voucherNumber: v.voucherNumber,
        voucherType:
          v.voucherType === 'PURCHASE_RETURN' || v.voucherType === 'DEBIT_NOTE'
            ? 'DEBIT NOTE'
            : v.voucherType === 'SALES_RETURN' || v.voucherType === 'CREDIT_NOTE'
            ? 'CREDIT NOTE'
            : v.voucherType,
        particulars: v.lines.map((l) => `${l.type}: ${l.ledgerName || 'Account'}`).join(' | '),
        referenceNo: v.referenceNo || '-',
        amount: v.totalDebit,
        status: v.status,
      })),
      summaryRows: [
        {
          date: 'TOTAL',
          voucherNumber: `${filteredVouchers.length} Vouchers`,
          voucherType: '',
          particulars: '',
          referenceNo: '',
          amount: totalAmount,
          status: '',
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Voucher Register',
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher Number', dataKey: 'voucherNumber' },
        { header: 'Voucher Type', dataKey: 'voucherType' },
        { header: 'Particulars / Accounts', dataKey: 'particulars' },
        { header: 'Reference No', dataKey: 'referenceNo' },
        { header: 'Total Amount (INR)', dataKey: 'amount' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Narration', dataKey: 'narration' },
      ],
      data: filteredVouchers.map((v) => ({
        date: formatDateDisplay(v.date),
        voucherNumber: v.voucherNumber,
        voucherType:
          v.voucherType === 'PURCHASE_RETURN' || v.voucherType === 'DEBIT_NOTE'
            ? 'DEBIT NOTE'
            : v.voucherType === 'SALES_RETURN' || v.voucherType === 'CREDIT_NOTE'
            ? 'CREDIT NOTE'
            : v.voucherType,
        particulars: v.lines.map((l) => `${l.type}: ${l.ledgerName || 'Account'}`).join(' | '),
        referenceNo: v.referenceNo || '',
        amount: v.totalDebit,
        status: v.status,
        narration: v.narration,
      })),
    });
  };

  const displayTitle = title || (filterType === 'SALES' ? 'Sales Register' : filterType === 'PURCHASE' ? 'Purchase Register' : 'Voucher Register');
  const displaySubtitle = filterType === 'SALES'
    ? 'Chronological register of all sales invoices, credit notes and outward billing records.'
    : filterType === 'PURCHASE'
    ? 'Chronological register of all purchase bills, debit notes and inward supplier records.'
    : 'Complete chronological audit register of all double-entry transaction vouchers.';

  return (
    <div className="space-y-3 text-[#FFFFFF]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
            {filterType === 'SALES' ? (
              <ShoppingBag className="w-4 h-4 text-[#2588E8]" />
            ) : filterType === 'PURCHASE' ? (
              <ShoppingCart className="w-4 h-4 text-[#2588E8]" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-[#2588E8]" />
            )}
            {displayTitle}
          </h1>
          <p className="text-[11px] text-[#7F98AE] mt-0.5 hidden sm:block">
            {displaySubtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            Export Excel
          </button>
          {filterType === 'SALES' ? (
            <button
              onClick={() => openVoucherModal('SALES')}
              className="flex items-center gap-1 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Sale Invoice (F8)
            </button>
          ) : filterType === 'PURCHASE' ? (
            <button
              onClick={() => openVoucherModal('PURCHASE')}
              className="flex items-center gap-1 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Purchase Bill (F9)
            </button>
          ) : (
            <button
              onClick={() => openVoucherModal('PAYMENT')}
              className="flex items-center gap-1 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Voucher
            </button>
          )}
        </div>
      </div>


      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] p-3.5 rounded-2xl text-xs shadow-xs">
        <div className="relative sm:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#7F98AE] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Voucher #, Account name, Ref #, Narration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl pl-9 pr-3 py-1.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
          />
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
          >
            <option value="ALL">All Voucher Types</option>
            <option value="RECEIPT">Receipt</option>
            <option value="PAYMENT">Payment</option>
            <option value="CONTRA">Contra</option>
            <option value="JOURNAL">Journal</option>
            {isDedicatedRegister && (
              <>
                <option value="SALES">Sales</option>
                <option value="PURCHASE">Purchase</option>
              </>
            )}
            <option value="DEBIT_NOTE">Debit Note</option>
            <option value="CREDIT_NOTE">Credit Note</option>
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">Posted</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold text-[10.5px] uppercase font-mono border-b border-[rgba(112,185,245,0.25)] h-7 leading-tight">
              <tr>
                <th className="py-0.5 px-3">Date (DD/MM/YYYY)</th>
                <th className="py-0.5 px-3">Voucher Number</th>
                <th className="py-0.5 px-3">Type</th>
                <th className="py-0.5 px-3">Accounts &amp; Particulars</th>
                <th className="py-0.5 px-3">Reference</th>
                <th className="py-0.5 px-3 text-right">Amount (₹)</th>
                <th className="py-0.5 px-3 text-center">Status</th>
                <th className="py-0.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#7F98AE]">
                    No vouchers found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={v.id}
                      data-table-id="voucher-register-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(57,167,255,0.06)]'
                      }`}
                    >
                    <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-xs">{formatDateDisplay(v.date)}</td>
                    <td className="py-1 px-3 font-mono font-bold whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditVoucher(v);
                          }}
                          title={`Click to edit voucher ${v.voucherNumber}`}
                          className="text-[#2588E8] hover:text-[#52C7FF] underline decoration-1 underline-offset-2 transition cursor-pointer font-bold text-left"
                        >
                          {v.voucherNumber}
                        </button>
                        {v.series && (
                          <span className="text-[9px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] text-[#2588E8] px-1.5 py-0.2 rounded-md font-sans font-semibold">
                            {v.series}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-3">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-lg uppercase ${
                          v.voucherType === 'RECEIPT'
                            ? 'bg-[#1b4332] text-[#55D68A] border border-[#55D68A]/30'
                            : v.voucherType === 'PAYMENT'
                            ? 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                            : v.voucherType === 'CONTRA'
                            ? 'bg-[#2a2415] text-[#F2C94C] border border-[#F2C94C]/30'
                            : v.voucherType === 'JOURNAL'
                            ? 'bg-[#2b1836] text-[#c084fc] border border-[#c084fc]/30'
                            : v.voucherType === 'DEBIT_NOTE' || v.voucherType === 'PURCHASE_RETURN'
                            ? 'bg-[#2e1d24] text-[#f87171] border border-rose-500/30'
                            : v.voucherType === 'CREDIT_NOTE' || v.voucherType === 'SALES_RETURN'
                            ? 'bg-[#1e293b] text-[#38bdf8] border border-sky-500/30'
                            : v.voucherType === 'SALES'
                            ? 'bg-[#23402f] text-[#d4eda3] border border-[rgba(112,185,245,0.25)]'
                            : v.voucherType === 'PURCHASE'
                            ? 'bg-[#193328] text-[#c0d6b5] border border-[rgba(112,185,245,0.25)]'
                            : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] border border-[rgba(112,185,245,0.25)]'
                        }`}
                      >
                        {v.voucherType === 'PURCHASE_RETURN' || v.voucherType === 'DEBIT_NOTE'
                          ? 'DEBIT NOTE'
                          : v.voucherType === 'SALES_RETURN' || v.voucherType === 'CREDIT_NOTE'
                          ? 'CREDIT NOTE'
                          : v.voucherType}
                      </span>
                    </td>
                    <td className="py-1 px-3 max-w-xs">
                      <div className="space-y-0.5">
                        {v.lines.map((line, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="truncate text-[#B7C9D9]">
                              <span className={line.type === 'DR' ? 'text-[#2588E8] font-semibold' : 'text-[#2588E8] font-semibold'}>
                                {line.type}
                              </span>{' '}
                              {line.ledgerName}
                            </span>
                            <span className="font-mono text-[#7F98AE] ml-2">₹{line.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {v.narration && <div className="text-[10px] text-[#7F98AE] italic truncate">{v.narration}</div>}
                    </td>
                    <td className="py-1 px-3 font-mono text-[#7F98AE] text-xs">{v.referenceNo || '-'}</td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      ₹{v.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-3 text-center">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-lg uppercase ${
                          v.status === 'POSTED'
                            ? 'bg-[#1b4332] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                            : 'bg-[#421d23] text-[#fca5a5] border border-rose-800/50'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditVoucher(v)}
                          title="Edit Voucher"
                          className="p-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.20)] text-[#2588E8] hover:text-[#52C7FF] border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setVoucherToDelete(v)}
                          title="Delete Voucher"
                          className="p-1 rounded-lg bg-[#421d23] hover:bg-[#5c242e] text-[#fca5a5] hover:text-[#ff8a8a] border border-rose-800/50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeActionMenu?.voucher.id === v.id) {
                              setActiveActionMenu(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 145;
                              const menuWidth = 144;
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;
                              setActiveActionMenu({
                                voucher: v,
                                top: openUpwards ? rect.top - menuHeight - 4 : rect.bottom + 6,
                                left: Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth)),
                              });
                            }
                          }}
                          title="More options (PDF, Excel, Print View)"
                          className={`p-1 rounded-lg transition cursor-pointer border ${
                            activeActionMenu?.voucher.id === v.id
                              ? 'bg-[#2588E8]/20 text-[#2588E8] border-[#2588E8]/50'
                              : 'bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.20)] text-[#B7C9D9] hover:text-[#FFFFFF] border-[rgba(112,185,245,0.25)]'
                          }`}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {filteredVouchers.length > 0 && (
              <tfoot className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-bold border-t border-[rgba(112,185,245,0.25)]">
                <tr>
                  <td colSpan={5} className="py-3 px-3.5 text-right font-semibold">
                    Grand Total ({filteredVouchers.length} Vouchers):
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-[#2588E8]">
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Delete Voucher Confirmation Modal */}
      {voucherToDelete && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.54)] backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[rgba(13,38,62,0.96)] backdrop-blur-2xl border border-[rgba(112,185,245,0.30)] rounded-2xl p-5 w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-[rgba(112,185,245,0.25)] pb-3">
              <h3 className="font-bold text-[#fca5a5] text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                Confirm Delete Voucher
              </h3>
              <button
                onClick={() => setVoucherToDelete(null)}
                className="text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[#B7C9D9]">
              Are you sure you want to permanently delete voucher{' '}
              <span className="font-bold text-[#2588E8]">{voucherToDelete.voucherNumber}</span> for ₹
              {voucherToDelete.totalDebit.toFixed(2)}?
            </p>
            <p className="text-[#7F98AE] text-[11px]">
              This will remove the voucher record permanently from the register and database.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-[#421d23] hover:bg-[#5c242e] text-[#fca5a5] border border-rose-800/50 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Voucher'}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setVoucherToDelete(null)}
                className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-4 py-2 rounded-xl border border-[rgba(112,185,245,0.25)] cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Options Menu (SALE KE JAISE teleported to document.body) */}
      {activeActionMenu && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${activeActionMenu.top}px`,
            left: `${activeActionMenu.left}px`,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-36 bg-[#081A2D] border border-[rgba(112,185,245,0.28)] rounded-xl shadow-2xl py-1.5 text-left backdrop-blur-xl ring-1 ring-black/50"
        >
          <button
            type="button"
            onClick={() => {
              handleDirectExport(activeActionMenu.voucher, 'pdf');
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(57,167,255,0.15)] hover:text-[#2588E8] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <PdfFileIcon className="w-4 h-4 shrink-0" />
            <span>Pdf</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleDirectExport(activeActionMenu.voucher, 'excel');
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(57,167,255,0.15)] hover:text-[#2588E8] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <ExcelFileIcon className="w-4 h-4 shrink-0" />
            <span>Excel</span>
          </button>
          <div className="h-px bg-[rgba(112,185,245,0.12)] my-1" />
          <button
            type="button"
            onClick={() => {
              handleOpenPrintView(activeActionMenu.voucher);
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-amber-500/15 hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Print View</span>
          </button>
        </div>,
        document.body
      )}

      {/* Voucher Print View Modal */}
      {voucherForPrintView && (
        <VoucherPrintModal
          isOpen={!!voucherForPrintView}
          onClose={() => setVoucherForPrintView(null)}
          voucher={voucherForPrintView}
          onExportPdf={(v) => handleDirectExport(v, 'pdf')}
          onExportExcel={(v) => handleDirectExport(v, 'excel')}
        />
      )}
    </div>
  );
};
