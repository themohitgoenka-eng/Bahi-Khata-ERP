import React from 'react';
import { StockJournalEntry } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import { Printer, X, FileText, ArrowRight, Layers } from 'lucide-react';
import { printElementById } from '../../utils/printHelper';

interface StockJournalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  journal: StockJournalEntry | null;
}

export const StockJournalPrintModal: React.FC<StockJournalPrintModalProps> = ({
  isOpen,
  onClose,
  journal,
}) => {
  const { currentCompany } = useApp();

  if (!isOpen || !journal) return null;

  const handlePrint = () => {
    printElementById('stock_journal_printable_area', {
      title: `Stock_Journal_${journal.voucherNo}`,
      pageSize: 'A4 portrait',
      pageMargin: '5mm',
    });
  };

  const getJournalTypeLabel = (t: string) => {
    switch (t) {
      case 'MANUFACTURING':
        return 'Manufacturing / Processing';
      case 'INTER_LOCATION':
        return 'Inter-Godown Transfer';
      case 'CONSUMPTION_PRODUCTION':
        return 'Consumption & Production';
      case 'GENERAL_TRANSFER':
        return 'General Stock Transfer';
      case 'STOCK_ADJUSTMENT':
        return 'Stock Repacking / Conversion';
      default:
        return t;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-mono">
      <div className="bg-[#0f111a] border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#090a0f]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-white">STOCK JOURNAL VOUCHER</span>
            <span className="text-xs text-amber-300 font-mono bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
              {journal.voucherNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Area */}
        <div id="stock_journal_printable_area" className="p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs space-y-5 print:p-0 print:bg-white print:text-black">
          {/* Company & Voucher Header */}
          <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {currentCompany?.name || 'Bahi Khata ERP'}
              </h2>
              <p className="text-slate-400 text-[11px]">{currentCompany?.address || 'Industrial Area, Kota, Rajasthan'}</p>
              {currentCompany?.gstin && (
                <p className="text-slate-400 text-[11px]">GSTIN: {currentCompany.gstin}</p>
              )}
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                STOCK JOURNAL VOUCHER
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-slate-500">Voucher No: </span>
                <span className="font-bold text-white">{journal.voucherNo}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-slate-500">Date: </span>
                <span className="font-bold text-white">{formatDateDisplay(journal.date)}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-slate-500">Type: </span>
                <span className="font-medium text-amber-300">{getJournalTypeLabel(journal.journalType)}</span>
              </div>
              {journal.referenceNo && (
                <div className="text-[11px] text-slate-300">
                  <span className="text-slate-500">Ref: </span>
                  <span>{journal.referenceNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Side by Side Consumption & Production Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOURCE (CONSUMPTION / ISSUE) */}
            <div className="bg-[#090a0f] border border-rose-900/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-rose-900/30 pb-2">
                <span className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Source (Consumption / Issue)
                </span>
                <span className="text-[10px] text-slate-400">
                  {journal.sourceItems.length} Item(s)
                </span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="text-left py-1">Item Description</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Rate (₹)</th>
                    <th className="text-right py-1">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {journal.sourceItems.map((itm, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">
                        <div className="font-semibold text-slate-200">{itm.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {itm.itemCode} {itm.godown ? `• ${itm.godown}` : ''}
                        </div>
                      </td>
                      <td className="text-right py-1.5 font-bold text-white">
                        {itm.quantity} {itm.unit}
                      </td>
                      <td className="text-right py-1.5 text-slate-300">
                        ₹{Number(itm.rate).toFixed(2)}
                      </td>
                      <td className="text-right py-1.5 font-bold text-rose-300">
                        ₹{Number(itm.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {journal.sourceItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-500 italic text-[10px]">
                        No source items (Pure receipt)
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 font-bold text-slate-200">
                    <td className="py-1.5">Total Issue:</td>
                    <td className="text-right py-1.5 text-white">{journal.totalSourceQty}</td>
                    <td></td>
                    <td className="text-right py-1.5 text-rose-400 font-bold">
                      ₹{Number(journal.totalSourceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* DESTINATION (PRODUCTION / RECEIPT) */}
            <div className="bg-[#090a0f] border border-emerald-900/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2">
                <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Destination (Production / Receipt)
                </span>
                <span className="text-[10px] text-slate-400">
                  {journal.destinationItems.length} Item(s)
                </span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="text-left py-1">Item Description</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Rate (₹)</th>
                    <th className="text-right py-1">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {journal.destinationItems.map((itm, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">
                        <div className="font-semibold text-slate-200">{itm.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {itm.itemCode} {itm.godown ? `• ${itm.godown}` : ''}
                        </div>
                      </td>
                      <td className="text-right py-1.5 font-bold text-white">
                        {itm.quantity} {itm.unit}
                      </td>
                      <td className="text-right py-1.5 text-slate-300">
                        ₹{Number(itm.rate).toFixed(2)}
                      </td>
                      <td className="text-right py-1.5 font-bold text-emerald-300">
                        ₹{Number(itm.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {journal.destinationItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-500 italic text-[10px]">
                        No destination items (Pure issue)
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 font-bold text-slate-200">
                    <td className="py-1.5">Total Output:</td>
                    <td className="text-right py-1.5 text-white">{journal.totalDestinationQty}</td>
                    <td></td>
                    <td className="text-right py-1.5 text-emerald-400 font-bold">
                      ₹{Number(journal.totalDestinationAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Narration and Overheads */}
          <div className="bg-[#090a0f] border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row justify-between gap-3 text-xs">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] uppercase text-slate-500 font-bold">Narration / Notes:</span>
              <p className="text-slate-300 italic text-[11px] leading-relaxed">
                {journal.narration || 'No remarks entered for this stock transaction.'}
              </p>
            </div>
            {Number(journal.additionalCost || 0) > 0 && (
              <div className="text-right border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
                <span className="text-[10px] text-slate-400">Additional Processing Cost / Overheads:</span>
                <div className="text-sm font-bold text-amber-300 font-mono">
                  ₹{Number(journal.additionalCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[10px] text-slate-500 border-t border-slate-800">
            <div>
              <div className="border-b border-dashed border-slate-700 pb-8"></div>
              <div className="mt-1">Prepared By</div>
            </div>
            <div>
              <div className="border-b border-dashed border-slate-700 pb-8"></div>
              <div className="mt-1">Store / Production Manager</div>
            </div>
            <div>
              <div className="border-b border-dashed border-slate-700 pb-8"></div>
              <div className="mt-1">Authorised Signatory</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090a0f] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Voucher
          </button>
        </div>
      </div>
    </div>
  );
};
