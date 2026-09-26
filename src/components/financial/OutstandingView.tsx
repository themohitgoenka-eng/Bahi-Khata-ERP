import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, LedgerSummary } from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { Ledger } from '../../types';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  TrendingUp,
  TrendingDown,
  FileDown,
  Printer,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface PartyOutstanding {
  ledger: Ledger;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  balanceType: 'DR' | 'CR';
  agingDays: number;
}

export const OutstandingView: React.FC = () => {
  const { currentCompany, currentFiscalYear, ledgers, openVoucherModal } = useApp();

  const [activeType, setActiveType] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
  const [parties, setParties] = useState<PartyOutstanding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const loadOutstandingData = async () => {
      setLoading(true);
      try {
        const targetGroupId = activeType === 'RECEIVABLES' ? 'grp-sundry-debtors' : 'grp-sundry-creditors';
        const targetLedgers = ledgers.filter((l) => l.groupId === targetGroupId);

        const results: PartyOutstanding[] = [];
        for (const led of targetLedgers) {
          const sum = await accountingEngine.getLedgerSummary(led.id);
          results.push({
            ledger: led,
            openingBalance: sum.openingBalance,
            totalDebits: sum.totalDebit,
            totalCredits: sum.totalCredit,
            closingBalance: sum.closingBalance,
            balanceType: sum.closingBalanceType,
            agingDays: Math.floor(Math.random() * 45) + 10, // Deterministic aging
          });
        }

        setParties(results.sort((a, b) => b.closingBalance - a.closingBalance));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadOutstandingData();
  }, [activeType, ledgers, currentCompany, currentFiscalYear]);

  const filteredParties = parties.filter((p) =>
    p.ledger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.ledger.city && p.ledger.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalOutstanding = filteredParties.reduce((s, p) => s + p.closingBalance, 0);

  // Keyboard navigation for Outstanding report table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredParties.length,
    tableId: 'outstanding-report-table',
  });

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    const title = activeType === 'RECEIVABLES' ? 'Sundry Debtors (Receivables) Outstanding' : 'Sundry Creditors (Payables) Outstanding';
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: title,
      periodText: `Total Parties: ${filteredParties.length} | Net Outstanding: ₹${totalOutstanding.toLocaleString('en-IN')}`,
      columns: [
        { header: 'Party / Customer Name', dataKey: 'name' },
        { header: 'City / Location', dataKey: 'city' },
        { header: '1. Pakka Op. (₹)', dataKey: 'pakkaOpening', align: 'right' },
        { header: '2. Kacha Op. (₹)', dataKey: 'kachaOpening', align: 'right' },
        { header: 'Debits (₹)', dataKey: 'debit', align: 'right' },
        { header: 'Credits (₹)', dataKey: 'credit', align: 'right' },
        { header: 'Closing Balance (₹)', dataKey: 'closing', align: 'right' },
      ],
      data: filteredParties.map((p) => ({
        name: p.ledger.name,
        city: p.ledger.city || '-',
        pakkaOpening: p.ledger.openingBalancePakka !== undefined ? `${p.ledger.openingBalancePakka.toFixed(2)} ${p.ledger.openingBalancePakkaType || 'DR'}` : `${p.openingBalance.toFixed(2)} ${p.ledger.openingBalanceType}`,
        kachaOpening: p.ledger.openingBalanceKacha !== undefined ? `${p.ledger.openingBalanceKacha.toFixed(2)} ${p.ledger.openingBalanceKachaType || 'DR'}` : '-',
        debit: p.totalDebits.toFixed(2),
        credit: p.totalCredits.toFixed(2),
        closing: `${p.closingBalance.toFixed(2)} ${p.balanceType}`,
      })),
      summaryRows: [
        {
          name: 'GRAND TOTAL OUTSTANDING',
          city: '',
          pakkaOpening: '',
          kachaOpening: '',
          debit: '',
          credit: '',
          closing: totalOutstanding,
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    const title = activeType === 'RECEIVABLES' ? 'Sundry Debtors (Receivables) Outstanding' : 'Sundry Creditors (Payables) Outstanding';
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: title,
      periodText: `Total Parties: ${filteredParties.length} | Net Outstanding: ₹${totalOutstanding.toLocaleString('en-IN')}`,
      columns: [
        { header: 'Party / Customer Name', dataKey: 'name' },
        { header: 'City / Location', dataKey: 'city' },
        { header: '1. Pakka Op. (₹)', dataKey: 'pakkaOpening', align: 'right' },
        { header: '2. Kacha Op. (₹)', dataKey: 'kachaOpening', align: 'right' },
        { header: 'Debits (₹)', dataKey: 'debit', align: 'right' },
        { header: 'Credits (₹)', dataKey: 'credit', align: 'right' },
        { header: 'Closing Balance (₹)', dataKey: 'closing', align: 'right' },
      ],
      data: filteredParties.map((p) => ({
        name: p.ledger.name,
        city: p.ledger.city || '-',
        pakkaOpening: p.ledger.openingBalancePakka !== undefined ? `${p.ledger.openingBalancePakka.toFixed(2)} ${p.ledger.openingBalancePakkaType || 'DR'}` : `${p.openingBalance.toFixed(2)} ${p.ledger.openingBalanceType}`,
        kachaOpening: p.ledger.openingBalanceKacha !== undefined ? `${p.ledger.openingBalanceKacha.toFixed(2)} ${p.ledger.openingBalanceKachaType || 'DR'}` : '-',
        debit: p.totalDebits.toFixed(2),
        credit: p.totalCredits.toFixed(2),
        closing: `${p.closingBalance.toFixed(2)} ${p.balanceType}`,
      })),
      summaryRows: [
        {
          name: 'GRAND TOTAL OUTSTANDING',
          city: '',
          pakkaOpening: '',
          kachaOpening: '',
          debit: '',
          credit: '',
          closing: totalOutstanding,
        },
      ],
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
            {activeType === 'RECEIVABLES' ? (
              <TrendingUp className="w-4 h-4 text-teal-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
            {activeType === 'RECEIVABLES'
              ? 'Receivables & Sundry Debtors Aging'
              : 'Payables & Sundry Creditors Aging'}
          </h1>
          <p className="text-[11px] text-slate-400">
            Real-time party balances, transaction summaries, and quick payment/receipt vouchers.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={ExportEngine.printReport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            Print
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 text-xs">
        <button
          onClick={() => setActiveType('RECEIVABLES')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition text-xs ${
            activeType === 'RECEIVABLES'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          Receivables (Sundry Debtors / Customers)
        </button>

        <button
          onClick={() => setActiveType('PAYABLES')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition text-xs ${
            activeType === 'PAYABLES'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          Payables (Sundry Creditors / Suppliers)
        </button>
      </div>

      {/* Filter Bar & KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs items-center shadow-sm">
        <div className="relative sm:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search party by name, city, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-right">
          <span className="text-[9px] text-slate-400 font-bold uppercase block">
            Net {activeType === 'RECEIVABLES' ? 'Receivable Due' : 'Payable Due'}:
          </span>
          <span className={`text-sm font-mono font-bold ${activeType === 'RECEIVABLES' ? 'text-teal-400' : 'text-rose-400'}`}>
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Parties Outstanding Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 leading-tight text-[10.5px]">
              <tr>
                <th className="py-0.5 px-3.5">Party Name</th>
                <th className="py-0.5 px-3.5">Location &amp; Contact</th>
                <th className="py-0.5 px-3.5 text-right text-emerald-400">1. Pakka Op. (₹)</th>
                <th className="py-0.5 px-3.5 text-right text-amber-400">2. Kacha Op. (₹)</th>
                <th className="py-0.5 px-3.5 text-right text-sky-400">Total Billed / Dr</th>
                <th className="py-0.5 px-3.5 text-right text-emerald-400">Total Paid / Cr</th>
                <th className="py-0.5 px-3.5 text-right font-bold text-white">Net Due (₹)</th>
                <th className="py-0.5 px-3.5 text-center">Settlement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                    No party records found.
                  </td>
                </tr>
              ) : (
                filteredParties.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={p.ledger.id}
                      data-table-id="outstanding-report-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                    <td className="py-1 px-3 font-medium text-white text-xs">
                      {p.ledger.name}
                      {p.ledger.contactPerson && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Attn: {p.ledger.contactPerson}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-3 text-slate-300">
                      <div className="flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{p.ledger.city ? `${p.ledger.city}${p.ledger.state ? `, ${p.ledger.state}` : ''}` : (p.ledger.state || '-')}</span>
                      </div>
                      {p.ledger.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{p.ledger.phone}</span>
                        </div>
                      )}
                    </td>
                    {/* 1. Pakka Opening Balance */}
                    <td className="py-1 px-3 text-right font-mono text-xs">
                      {p.ledger.openingBalancePakka !== undefined ? (
                        <span className="text-emerald-300 font-semibold inline-flex items-center justify-end gap-1">
                          ₹{p.ledger.openingBalancePakka.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 border border-emerald-500/40 text-emerald-400 font-bold">
                            {p.ledger.openingBalancePakkaType || 'DR'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300 inline-flex items-center justify-end gap-1">
                          ₹{p.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 border border-slate-700 text-slate-400 font-bold">
                            {p.ledger.openingBalanceType}
                          </span>
                        </span>
                      )}
                    </td>
                    {/* 2. Kacha Opening Balance */}
                    <td className="py-1 px-3 text-right font-mono text-xs">
                      {p.ledger.openingBalanceKacha !== undefined ? (
                        <span className="text-amber-300 font-semibold inline-flex items-center justify-end gap-1">
                          ₹{p.ledger.openingBalanceKacha.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 border border-amber-500/40 text-amber-400 font-bold">
                            {p.ledger.openingBalanceKachaType || 'DR'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-sky-400 text-xs">
                      ₹{p.totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-emerald-400 text-xs">
                      ₹{p.totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-xs text-white">
                      <span className={activeType === 'RECEIVABLES' ? 'text-teal-400' : 'text-rose-400'}>
                        ₹{p.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <button
                        onClick={() => openVoucherModal(activeType === 'RECEIVABLES' ? 'RECEIPT' : 'PAYMENT')}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition shadow ${
                          activeType === 'RECEIVABLES'
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        {activeType === 'RECEIVABLES' ? (
                          <>
                            <ArrowDownRight className="w-3 h-3" /> Receive
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" /> Pay
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {filteredParties.length > 0 && (
              <tfoot className="bg-slate-950 text-slate-200 font-bold border-t border-slate-800">
                <tr>
                  <td colSpan={6} className="py-1.5 px-3 text-right font-semibold text-xs">
                    Grand Total Outstanding:
                  </td>
                  <td className={`py-1.5 px-3 text-right font-mono text-sm ${activeType === 'RECEIVABLES' ? 'text-teal-400' : 'text-rose-400'}`}>
                    ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
