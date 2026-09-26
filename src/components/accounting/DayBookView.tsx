import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { ExportEngine } from '../../services/exportEngine';
import { Voucher } from '../../types';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  CalendarDays,
  FileDown,
  Printer,
  Calendar,
  Filter,
  Layers,
  ArrowRightLeft,
  Plus,
} from 'lucide-react';

export const DayBookView: React.FC = () => {
  const { currentCompany, currentFiscalYear, openVoucherModal } = useApp();

  const [dateFrom, setDateFrom] = useState<string>(
    currentFiscalYear?.startDate || getTodayISO()
  );
  const [dateTo, setDateTo] = useState<string>(
    getTodayISO()
  );
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDayBook = async () => {
      setLoading(true);
      try {
        const all = await dbStorage.getVouchers();
        const active = all
          .filter((v) => v.status === 'POSTED' && v.date >= dateFrom && v.date <= dateTo)
          .sort((a, b) => a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber));
        setVouchers(active);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDayBook();
  }, [dateFrom, dateTo, currentCompany, currentFiscalYear]);

  const totalDebit = vouchers.reduce((s, v) => s + v.totalDebit, 0);
  const totalCredit = vouchers.reduce((s, v) => s + v.totalCredit, 0);

  // Keyboard navigation for Day Book table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: vouchers.length,
    tableId: 'daybook-table',
  });

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Day Book (Transaction Journal)',
      periodText: `From: ${formatDateDisplay(dateFrom)} To: ${formatDateDisplay(dateTo)}`,
      columns: [
        { header: 'Date (DD/MM/YYYY)', dataKey: 'date' },
        { header: 'Voucher No', dataKey: 'voucherNumber' },
        { header: 'Type', dataKey: 'voucherType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Ref No', dataKey: 'referenceNo' },
        { header: 'Debit (₹)', dataKey: 'debit', align: 'right' },
        { header: 'Credit (₹)', dataKey: 'credit', align: 'right' },
      ],
      data: vouchers.map((v) => ({
        date: formatDateDisplay(v.date),
        voucherNumber: v.voucherNumber,
        voucherType: v.voucherType,
        particulars: v.lines.map((l) => `${l.type}: ${l.ledgerName}`).join(' | '),
        referenceNo: v.referenceNo || '-',
        debit: v.totalDebit,
        credit: v.totalCredit,
      })),
      summaryRows: [
        {
          date: 'TOTAL',
          voucherNumber: `${vouchers.length} Entries`,
          voucherType: '',
          particulars: '',
          referenceNo: '',
          debit: totalDebit,
          credit: totalCredit,
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Day Book',
      periodText: `From: ${formatDateDisplay(dateFrom)} To: ${formatDateDisplay(dateTo)}`,
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Voucher Number', dataKey: 'voucherNumber' },
        { header: 'Voucher Type', dataKey: 'voucherType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Reference', dataKey: 'referenceNo' },
        { header: 'Debit (INR)', dataKey: 'debit' },
        { header: 'Credit (INR)', dataKey: 'credit' },
        { header: 'Narration', dataKey: 'narration' },
      ],
      data: vouchers.map((v) => ({
        date: formatDateDisplay(v.date),
        voucherNumber: v.voucherNumber,
        voucherType: v.voucherType,
        particulars: v.lines.map((l) => `${l.type}: ${l.ledgerName}`).join(' | '),
        referenceNo: v.referenceNo || '',
        debit: v.totalDebit,
        credit: v.totalCredit,
        narration: v.narration,
      })),
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#2588E8]" />
            Day Book (Transaction Journal)
          </h1>
          <p className="text-[11px] text-[#B7C9D9]">
            Daily sequential record of all posted financial debit and credit transactions.
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

      {/* Date Range Filter Bar */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl flex flex-wrap items-center gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-[#7F98AE] font-bold uppercase tracking-wider text-[10px]">From Date:</label>
          <DateInput
            value={dateFrom}
            onChange={setDateFrom}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[#7F98AE] font-bold uppercase tracking-wider text-[10px]">To Date:</label>
          <DateInput
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        <div className="ml-auto text-xs text-[#B7C9D9] font-medium">
          Showing <span className="font-bold text-[#FFFFFF]">{vouchers.length}</span> transactions
        </div>
      </div>

      {/* Day Book Table */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] text-[10.5px] leading-tight">
              <tr>
                <th className="py-0.5 px-3">Date (DD/MM/YYYY)</th>
                <th className="py-0.5 px-3">Voucher Number</th>
                <th className="py-0.5 px-3">Type</th>
                <th className="py-0.5 px-3">Particulars / Accounts Involved</th>
                <th className="py-0.5 px-3">Ref No</th>
                <th className="py-0.5 px-3 text-right">Debit (₹)</th>
                <th className="py-0.5 px-3 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[#7F98AE] text-xs">
                    No transactions found for the selected date range.
                  </td>
                </tr>
              ) : (
                vouchers.map((v, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={v.id}
                      data-table-id="daybook-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(57,167,255,0.06)]'
                      }`}
                    >
                    <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-xs">{formatDateDisplay(v.date)}</td>
                    <td className="py-1 px-3 font-mono font-bold text-[#2588E8] whitespace-nowrap text-xs">
                      {v.voucherNumber}
                    </td>
                    <td className="py-1 px-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]">
                        {v.voucherType}
                      </span>
                    </td>
                    <td className="py-1 px-3">
                      <div className="space-y-0.5">
                        {v.lines.map((line, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold ${
                                line.type === 'DR' ? 'text-[#2588E8]' : 'text-[#2588E8]'
                              }`}
                            >
                              {line.type}
                            </span>
                            <span className="text-[#FFFFFF] font-medium text-xs">{line.ledgerName}</span>
                            <span className="text-[#7F98AE] font-mono text-[10px]">
                              ₹{line.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {v.narration && <div className="text-[10px] text-[#7F98AE] italic mt-0.5">{v.narration}</div>}
                    </td>
                    <td className="py-1 px-3 font-mono text-[#7F98AE] text-xs">{v.referenceNo || '-'}</td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      ₹{v.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                      ₹{v.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {vouchers.length > 0 && (
              <tfoot className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-bold border-t border-[rgba(112,185,245,0.25)]">
                <tr>
                  <td colSpan={5} className="py-1.5 px-3 text-right font-semibold text-xs">
                    Day Book Total:
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[#FFFFFF] text-xs">
                    ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[#2588E8] text-xs">
                    ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
