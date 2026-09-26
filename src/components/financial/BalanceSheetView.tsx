import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, BalanceSheetResult } from '../../services/accountingEngine';
import { ExportEngine } from '../../services/exportEngine';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay, getTodayISO } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import {
  Scale,
  FileDown,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Wallet,
  Package,
  Layers,
} from 'lucide-react';

export const BalanceSheetView: React.FC = () => {
  const { currentCompany, currentFiscalYear, setActiveTab } = useApp();

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [asOfDate, setAsOfDate] = useState<string>(getTodayISO());

  useEffect(() => {
    const loadBS = async () => {
      setLoading(true);
      try {
        const bs = await accountingEngine.getBalanceSheet(asOfDate || undefined);
        setBalanceSheet(bs);
      } catch (err) {
        console.error('Error calculating Balance Sheet:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBS();
  }, [asOfDate, currentCompany, currentFiscalYear]);

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear || !balanceSheet) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Balance Sheet Statement',
      subtitle: `Status: ${balanceSheet.isBalanced ? 'BALANCED' : 'IMBALANCED'} | Total Assets: ₹${balanceSheet.assets.totalAssets.toLocaleString('en-IN')}`,
      periodText: `As on Date: ${formatDateDisplay(asOfDate)}`,
      columns: [
        { header: 'Liabilities & Capital', dataKey: 'liabilityItem' },
        { header: 'Amount (₹)', dataKey: 'liabilityAmount', align: 'right' },
        { header: 'Assets', dataKey: 'assetItem' },
        { header: 'Amount (₹)', dataKey: 'assetAmount', align: 'right' },
      ],
      data: [
        {
          liabilityItem: 'CAPITAL & RESERVES',
          liabilityAmount: balanceSheet.liabilities.totalCapital,
          assetItem: 'FIXED ASSETS',
          assetAmount: balanceSheet.assets.totalFixedAssets,
        },
        {
          liabilityItem: 'Current Period Net Outcome',
          liabilityAmount: balanceSheet.liabilities.currentPeriodNetProfit,
          assetItem: 'CURRENT ASSETS',
          assetAmount: '',
        },
        {
          liabilityItem: 'CURRENT LIABILITIES',
          liabilityAmount: balanceSheet.liabilities.currentLiabilities.total,
          assetItem: '  Closing Stock Valuation',
          assetAmount: balanceSheet.assets.currentAssets.stockInHandValue,
        },
        {
          liabilityItem: `  Sundry Creditors (${balanceSheet.liabilities.currentLiabilities.sundryCreditors.length})`,
          liabilityAmount: balanceSheet.liabilities.currentLiabilities.sundryCreditors.reduce((s, c) => s + c.amount, 0),
          assetItem: `  Sundry Debtors (${balanceSheet.assets.currentAssets.sundryDebtors.length})`,
          assetAmount: balanceSheet.assets.currentAssets.sundryDebtors.reduce((s, d) => s + d.amount, 0),
        },
        {
          liabilityItem: `  Other Liabilities`,
          liabilityAmount: balanceSheet.liabilities.currentLiabilities.otherLiabilities.reduce((s, l) => s + l.amount, 0),
          assetItem: `  Bank Accounts`,
          assetAmount: balanceSheet.assets.currentAssets.bankAccounts.reduce((s, b) => s + b.amount, 0),
        },
        {
          liabilityItem: '',
          liabilityAmount: '',
          assetItem: `  Cash in Hand`,
          assetAmount: balanceSheet.assets.currentAssets.cashInHand.reduce((s, c) => s + c.amount, 0),
        },
      ],
      summaryRows: [
        {
          liabilityItem: 'TOTAL LIABILITIES & CAPITAL',
          liabilityAmount: balanceSheet.liabilities.totalLiabilities,
          assetItem: 'TOTAL ASSETS',
          assetAmount: balanceSheet.assets.totalAssets,
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear || !balanceSheet) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Balance Sheet',
      periodText: `As on Date: ${formatDateDisplay(asOfDate)}`,
      columns: [
        { header: 'Liabilities & Capital', dataKey: 'liability' },
        { header: 'Amount (INR)', dataKey: 'liabilityAmount' },
        { header: 'Assets', dataKey: 'asset' },
        { header: 'Amount (INR)', dataKey: 'assetAmount' },
      ],
      data: [
        { liability: 'Capital Accounts', liabilityAmount: balanceSheet.liabilities.totalCapital, asset: 'Fixed Assets', assetAmount: balanceSheet.assets.totalFixedAssets },
        { liability: 'Net Profit / Surplus', liabilityAmount: balanceSheet.liabilities.currentPeriodNetProfit, asset: 'Closing Stock Valuation', assetAmount: balanceSheet.assets.currentAssets.stockInHandValue },
        { liability: 'Sundry Creditors', liabilityAmount: balanceSheet.liabilities.currentLiabilities.sundryCreditors.reduce((s, c) => s + c.amount, 0), asset: 'Sundry Debtors', assetAmount: balanceSheet.assets.currentAssets.sundryDebtors.reduce((s, d) => s + d.amount, 0) },
        { liability: 'Other Liabilities', liabilityAmount: balanceSheet.liabilities.currentLiabilities.otherLiabilities.reduce((s, l) => s + l.amount, 0), asset: 'Bank Balances', assetAmount: balanceSheet.assets.currentAssets.bankAccounts.reduce((s, b) => s + b.amount, 0) },
        { liability: '', liabilityAmount: '', asset: 'Cash in Hand', assetAmount: balanceSheet.assets.currentAssets.cashInHand.reduce((s, c) => s + c.amount, 0) },
        { liability: 'Total Liabilities', liabilityAmount: balanceSheet.liabilities.totalLiabilities, asset: 'Total Assets', assetAmount: balanceSheet.assets.totalAssets },
      ],
    });
  };

  return (
    <div className="space-y-3 text-[#a0a5b8]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0f17] border border-slate-800 p-3 rounded shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"></span>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Balance Sheet &bull; Financial Position Statement
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Real-time Indian double-entry balance sheet displaying Assets, Liabilities, and Net Worth.
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

      {/* Date & Balance Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0d0f17] border border-slate-800 p-3 rounded text-xs items-center font-mono">
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">As on Date:</label>
          <DateInput
            value={asOfDate}
            onChange={setAsOfDate}
            className="w-full"
          />
        </div>

        <div className="flex sm:justify-end">
          {balanceSheet?.isBalanced ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>BALANCED (Liabilities = Assets)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>IMBALANCE DIFF: ₹{Math.abs(balanceSheet?.difference || 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Evaluating Assets, Liabilities &amp; Capital...
        </div>
      ) : balanceSheet ? (
        /* Side-by-Side Balance Sheet Matrix */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
          {/* Left: Liabilities & Capital */}
          <div className="bg-[#0d0f17] border border-slate-800 rounded overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-[#090a0f] px-3.5 py-2 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Liabilities &amp; Capital
                </h2>
                <span className="text-[10px] text-slate-400">AMOUNT (₹)</span>
              </div>

              <div className="p-3.5 space-y-3 text-xs">
                {/* Capital & Reserves */}
                <div className="space-y-1.5">
                  <div className="font-bold text-indigo-300 border-b border-slate-800 pb-1 text-[11px]">
                    CAPITAL ACCOUNT &amp; NET WORTH
                  </div>
                  {balanceSheet.liabilities.capitalAccounts.map((c, i) => (
                    <div key={i} className="flex justify-between text-slate-300">
                      <span>{c.ledgerName}</span>
                      <span className="font-bold">₹{c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-emerald-400">
                    <span>Add: Current Period Net Surplus</span>
                    <span className="font-bold">
                      {balanceSheet.liabilities.currentPeriodNetProfit >= 0 ? '+' : ''}₹{balanceSheet.liabilities.currentPeriodNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Current Liabilities */}
                <div className="space-y-1.5 pt-2">
                  <div className="font-bold text-sky-300 border-b border-slate-800 pb-1 text-[11px]">
                    CURRENT LIABILITIES &amp; CREDITORS
                  </div>
                  {balanceSheet.liabilities.currentLiabilities.sundryCreditors.length === 0 ? (
                    <div className="text-slate-500 text-[11px]">No sundry creditors balances.</div>
                  ) : (
                    balanceSheet.liabilities.currentLiabilities.sundryCreditors.map((c, i) => (
                      <div key={i} className="flex justify-between text-slate-400">
                        <span className="text-slate-300">{c.ledgerName}</span>
                        <span>₹{c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}

                  {balanceSheet.liabilities.currentLiabilities.otherLiabilities.map((l, i) => (
                    <div key={i} className="flex justify-between text-slate-400">
                      <span className="text-slate-300">{l.ledgerName}</span>
                      <span>₹{l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#090a0f] p-3 border-t-2 border-slate-800 flex justify-between items-center text-xs font-bold text-white">
              <span className="uppercase text-[11px] text-slate-400">Total Liabilities &amp; Capital:</span>
              <span className="text-sky-400 text-sm">
                ₹{balanceSheet.liabilities.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Right: Assets */}
          <div className="bg-[#0d0f17] border border-slate-800 rounded overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-[#090a0f] px-3.5 py-2 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  Assets &amp; Properties
                </h2>
                <span className="text-[10px] text-slate-400">AMOUNT (₹)</span>
              </div>

              <div className="p-3.5 space-y-3 text-xs">
                {/* Fixed Assets */}
                <div className="space-y-1.5">
                  <div className="font-bold text-amber-300 border-b border-slate-800 pb-1 text-[11px]">
                    FIXED ASSETS &amp; PLANT
                  </div>
                  {balanceSheet.assets.fixedAssets.length === 0 ? (
                    <div className="text-slate-500 text-[11px]">No fixed asset properties recorded.</div>
                  ) : (
                    balanceSheet.assets.fixedAssets.map((a, i) => (
                      <div key={i} className="flex justify-between text-slate-300">
                        <span>{a.ledgerName}</span>
                        <span className="font-bold">₹{a.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Current Assets */}
                <div className="space-y-1.5 pt-2">
                  <div className="font-bold text-emerald-300 border-b border-slate-800 pb-1 text-[11px]">
                    CURRENT ASSETS, CASH &amp; INVENTORY
                  </div>

                  {/* Stock in hand */}
                  <div className="flex justify-between text-slate-300">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-amber-400" />
                      Closing Stock in Hand
                    </span>
                    <span className="font-bold text-amber-300">
                      ₹{balanceSheet.assets.currentAssets.stockInHandValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Sundry Debtors */}
                  {balanceSheet.assets.currentAssets.sundryDebtors.map((d, i) => (
                    <div key={i} className="flex justify-between text-slate-400">
                      <span className="text-slate-300">{d.ledgerName}</span>
                      <span>₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}

                  {/* Bank Accounts */}
                  {balanceSheet.assets.currentAssets.bankAccounts.map((b, i) => (
                    <div key={i} className="flex justify-between text-slate-400">
                      <span className="text-slate-300">{b.ledgerName}</span>
                      <span className="text-sky-300">₹{b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}

                  {/* Cash in Hand */}
                  {balanceSheet.assets.currentAssets.cashInHand.map((c, i) => (
                    <div key={i} className="flex justify-between text-slate-400">
                      <span className="text-slate-300">{c.ledgerName}</span>
                      <span className="text-emerald-300">₹{c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#090a0f] p-3 border-t-2 border-slate-800 flex justify-between items-center text-xs font-bold text-white">
              <span className="uppercase text-[11px] text-slate-400">Total Assets Valuation:</span>
              <span className="text-emerald-400 text-sm">
                ₹{balanceSheet.assets.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
