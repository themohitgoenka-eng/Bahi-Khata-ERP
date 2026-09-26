import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, ProfitLossResult } from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  Scale,
} from 'lucide-react';

export const ProfitLossView: React.FC = () => {
  const { currentCompany, currentFiscalYear } = useApp();

  const [plResult, setPlResult] = useState<ProfitLossResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>(currentFiscalYear?.startDate || getTodayISO());
  const [toDate, setToDate] = useState<string>(getTodayISO());

  useEffect(() => {
    const loadPL = async () => {
      setLoading(true);
      try {
        const res = await accountingEngine.getProfitAndLoss(fromDate || undefined, toDate || undefined);
        setPlResult(res);
      } catch (err) {
        console.error('Error calculating P&L:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPL();
  }, [fromDate, toDate, currentCompany, currentFiscalYear]);

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear || !plResult) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Trading and Profit & Loss Statement',
      subtitle: `Net Result: ${plResult.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'} ₹${Math.abs(plResult.netProfit).toLocaleString('en-IN')}`,
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(toDate)}`,
      columns: [
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Debit / Expenses (₹)', dataKey: 'debit', align: 'right' },
        { header: 'Credit / Revenue (₹)', dataKey: 'credit', align: 'right' },
      ],
      data: [
        { particulars: '--- TRADING ACCOUNT ---', debit: '', credit: '' },
        { particulars: 'To Opening Stock Value', debit: plResult.openingStockValue, credit: '' },
        { particulars: 'To Net Purchases', debit: plResult.netPurchases, credit: '' },
        ...plResult.directExpenses.map((e) => ({ particulars: `To ${e.ledgerName}`, debit: e.amount, credit: '' })),
        { particulars: 'By Net Sales Turnover', debit: '', credit: plResult.netSales },
        { particulars: 'By Closing Stock Valuation', debit: '', credit: plResult.closingStockValue },
        { particulars: 'To Gross Profit c/d', debit: plResult.grossProfit >= 0 ? plResult.grossProfit : '', credit: plResult.grossProfit < 0 ? Math.abs(plResult.grossProfit) : '' },
        { particulars: '--- PROFIT & LOSS ACCOUNT ---', debit: '', credit: '' },
        { particulars: 'By Gross Profit b/d', debit: '', credit: plResult.grossProfit >= 0 ? plResult.grossProfit : '' },
        ...plResult.indirectIncomes.map((i) => ({ particulars: `By ${i.ledgerName}`, debit: '', credit: i.amount })),
        ...plResult.indirectExpenses.map((e) => ({ particulars: `To ${e.ledgerName}`, debit: e.amount, credit: '' })),
        { particulars: 'To Net Profit transferred to Capital', debit: plResult.netProfit >= 0 ? plResult.netProfit : '', credit: plResult.netProfit < 0 ? Math.abs(plResult.netProfit) : '' },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear || !plResult) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Profit and Loss Account',
      periodText: `From: ${formatDateDisplay(fromDate || currentFiscalYear.startDate)} To: ${formatDateDisplay(toDate)}`,
      columns: [
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Debit / Expense (INR)', dataKey: 'debit' },
        { header: 'Credit / Revenue (INR)', dataKey: 'credit' },
      ],
      data: [
        { particulars: 'Opening Stock', debit: plResult.openingStockValue, credit: '' },
        { particulars: 'Net Purchases', debit: plResult.netPurchases, credit: '' },
        ...plResult.directExpenses.map((e) => ({ particulars: e.ledgerName, debit: e.amount, credit: '' })),
        { particulars: 'Net Sales', debit: '', credit: plResult.netSales },
        { particulars: 'Closing Stock', debit: '', credit: plResult.closingStockValue },
        { particulars: 'Gross Profit', debit: plResult.grossProfit, credit: '' },
        ...plResult.indirectExpenses.map((e) => ({ particulars: e.ledgerName, debit: e.amount, credit: '' })),
        ...plResult.indirectIncomes.map((i) => ({ particulars: i.ledgerName, debit: '', credit: i.amount })),
        { particulars: 'Net Profit', debit: plResult.netProfit, credit: '' },
      ],
    });
  };

  return (
    <div className="space-y-3 text-[#a0a5b8]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0f17] border border-slate-800 p-3 rounded shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]"></span>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              Trading &amp; Profit &amp; Loss Statement
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Standard Indian Financial Performance: Trading Account (Gross Margin) &amp; Profit &amp; Loss (Operating Net Margin).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 px-2.5 py-1 rounded font-bold transition cursor-pointer"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 px-2.5 py-1 rounded font-bold transition cursor-pointer"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            EXCEL
          </button>
          <button
            onClick={ExportEngine.printReport}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded font-bold transition"
          >
            <Printer className="w-3 h-3" />
            PRINT
          </button>
        </div>
      </div>

      {/* Date Range Selectors */}
      <div className="bg-[#0d0f17] border border-slate-800 p-3 rounded flex flex-wrap items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-bold uppercase text-[10px]">From Date:</label>
          <DateInput
            value={fromDate}
            onChange={setFromDate}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-bold uppercase text-[10px]">To Date:</label>
          <DateInput
            value={toDate}
            onChange={setToDate}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Calculating Trading &amp; Operational Balances...
        </div>
      ) : plResult ? (
        <>
          {/* KPI Summary Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div className="bg-[#0d0f17] border border-slate-800 p-3 rounded flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Trading Margin</span>
                <div className="text-lg font-bold text-indigo-300 mt-0.5">
                  ₹{plResult.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500">
                  Margin on Sales: {plResult.netSales > 0 ? ((plResult.grossProfit / plResult.netSales) * 100).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="w-9 h-9 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div
              className={`p-3 rounded border flex items-center justify-between ${
                plResult.netProfit >= 0
                  ? 'bg-[#0d0f17] border-emerald-800/60'
                  : 'bg-[#0d0f17] border-rose-800/60'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Outcome (Transferred)</span>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    plResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ₹{plResult.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className={`text-[10px] font-semibold ${plResult.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {plResult.netProfit >= 0 ? 'NET SURPLUS TRANSFERRED TO CAPITAL' : 'NET DEFICIT TRANSFERRED TO CAPITAL'}
                </span>
              </div>
              <div className="w-9 h-9 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Scale className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Part 1: Trading Account Matrix */}
          <div className="bg-[#0d0f17] border border-slate-800 rounded overflow-hidden">
            <div className="bg-[#090a0f] px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                PART 1: TRADING ACCOUNT (GROSS PROFIT COMPUTATION)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs font-mono">
              {/* Debit / Direct Costs */}
              <div className="p-3.5 space-y-2">
                <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between text-[11px]">
                  <span>Debit Particulars (Direct Costs)</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>To Opening Stock</span>
                  <span className="font-bold">₹{plResult.openingStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>To Gross Purchases</span>
                  <span className="font-bold">₹{plResult.netPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {plResult.directExpenses.map((e, idx) => (
                  <div key={idx} className="flex justify-between text-slate-400">
                    <span>To {e.ledgerName}</span>
                    <span className="text-slate-300">₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-indigo-300">
                  <span>To Gross Profit c/d (Trading Surplus)</span>
                  <span>₹{plResult.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Credit / Sales Turnover */}
              <div className="p-3.5 space-y-2">
                <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between text-[11px]">
                  <span>Credit Particulars (Turnover &amp; Closing)</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>By Net Sales (Turnover)</span>
                  <span className="font-bold text-emerald-400">
                    ₹{plResult.netSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>By Closing Stock Valuation</span>
                  <span className="font-bold text-amber-300">
                    ₹{plResult.closingStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Part 2: Profit & Loss Account Matrix */}
          <div className="bg-[#0d0f17] border border-slate-800 rounded overflow-hidden">
            <div className="bg-[#090a0f] px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                PART 2: PROFIT &amp; LOSS ACCOUNT (OPERATING OVERHEADS &amp; NET PROFIT)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs font-mono">
              {/* Debit / Indirect Expenses */}
              <div className="p-3.5 space-y-2">
                <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between text-[11px]">
                  <span>Debit Particulars (Indirect Overheads)</span>
                  <span>Amount (₹)</span>
                </div>
                {plResult.indirectExpenses.length === 0 ? (
                  <div className="text-slate-500 py-1">No indirect expenses recorded.</div>
                ) : (
                  plResult.indirectExpenses.map((e, idx) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span>To {e.ledgerName}</span>
                      <span className="text-rose-400 font-bold">₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-white">
                  <span>To Net Profit transferred to Balance Sheet</span>
                  <span className={plResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    ₹{plResult.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Credit / Incomes */}
              <div className="p-3.5 space-y-2">
                <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between text-[11px]">
                  <span>Credit Particulars (Incomes &amp; Surplus)</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold">
                  <span>By Gross Profit b/d</span>
                  <span className="text-indigo-300">
                    ₹{plResult.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {plResult.indirectIncomes.map((inc, idx) => (
                  <div key={idx} className="flex justify-between text-slate-400">
                    <span>By {inc.ledgerName}</span>
                    <span className="text-emerald-400 font-bold">₹{inc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
