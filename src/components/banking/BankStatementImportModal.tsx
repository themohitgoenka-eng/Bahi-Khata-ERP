import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { bankingEngine } from '../../services/bankingEngine';
import { BankStatementTransaction, BankAccount } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import {
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';

interface BankStatementImportModalProps {
  bankAccount: BankAccount;
  onClose: () => void;
  onSuccess: () => void;
}

export const BankStatementImportModal: React.FC<BankStatementImportModalProps> = ({
  bankAccount,
  onClose,
  onSuccess,
}) => {
  const { currentCompany, currentFiscalYear, showNotification } = useApp();

  const [parsedEntries, setParsedEntries] = useState<BankStatementTransaction[]>([]);
  const [parsing, setParsing] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');

  const handleFileProcess = async (file: File) => {
    if (!currentCompany || !currentFiscalYear) return;
    setParsing(true);
    setFileName(file.name);

    try {
      let entries: BankStatementTransaction[] = [];
      if (file.name.endsWith('.csv') || file.type.includes('csv')) {
        const text = await file.text();
        entries = bankingEngine.parseCsvBankStatement(text, bankAccount.id, currentCompany.id, currentFiscalYear.id);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        entries = bankingEngine.parseXlsxBankStatement(buffer, bankAccount.id, currentCompany.id, currentFiscalYear.id);
      } else {
        throw new Error('Unsupported file format. Please upload a standard .csv or .xlsx bank statement.');
      }

      setParsedEntries(entries);
      showNotification(`Successfully parsed ${entries.length} statement rows from ${file.name}`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to parse bank statement.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveImport = async () => {
    if (parsedEntries.length === 0) return;
    try {
      const saved = await bankingEngine.importBankStatement(parsedEntries);
      showNotification(`Imported ${saved.length} bank statement rows into ledger reconciliation.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save bank statement.', 'error');
    }
  };

  const sampleCsvContent = `Date,Description,ReferenceNo,Debit,Credit,Balance
2026-04-05,NEFT-INWARD-MARBLE-SALES,NEFT889900,,250000,550000
2026-04-08,CHQ-PAID-MAHADEV-SUPPLY,CHQ445566,120000,,430000
2026-04-12,BANK-CHARGES-ANNUAL-FEE,CHG112233,590,,429410`;

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sample_Bank_Statement_${bankAccount.bankName.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-mono">
      <div className="bg-[#0d0f17] border border-slate-800 rounded p-5 w-full max-w-3xl space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-sky-400" />
              Import Statement for {bankAccount.bankName}
            </h3>
            <p className="text-slate-400 text-[11px]">
              A/C: {bankAccount.accountNumber} &bull; IFSC: {bankAccount.ifscCode || 'N/A'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        {/* Upload Box */}
        {parsedEntries.length === 0 ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileProcess(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded p-8 text-center transition flex flex-col items-center justify-center gap-2 ${
                dragOver ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-[#090a0f]'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-sky-400" />
              <p className="text-sm font-semibold text-white">
                Drag &amp; drop your Bank Statement (.csv / .xlsx) here
              </p>
              <p className="text-xs text-slate-400">
                Supports Standard Indian Bank Formats (SBI, HDFC, ICICI, PNB, BoB, Axis)
              </p>

              <label className="mt-2 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition shadow">
                Browse File
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 bg-[#090a0f] p-3 rounded border border-slate-800">
              <span>Need a sample template for testing?</span>
              <button
                onClick={handleDownloadSampleCsv}
                className="text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Download Sample CSV &darr;
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-[#090a0f] p-2.5 rounded border border-slate-800">
              <span className="text-white font-bold">
                Parsed {parsedEntries.length} entries from {fileName}
              </span>
              <button
                onClick={() => setParsedEntries([])}
                className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
              >
                Upload Different File
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-slate-800 rounded bg-[#090a0f]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0d0f17] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Ref / Cheque</th>
                    <th className="p-2 text-right">Debit (Dr)</th>
                    <th className="p-2 text-right">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {parsedEntries.slice(0, 15).map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2 text-slate-300">{formatDateDisplay(e.date)}</td>
                      <td className="p-2 text-white truncate max-w-[200px]">{e.narration || e.description}</td>
                      <td className="p-2 text-slate-400">{e.referenceNo || e.chequeNo || '-'}</td>
                      <td className="p-2 text-right text-rose-400 font-bold">
                        {(e.type === 'DEBIT' || (e.debit || 0) > 0) ? `₹${(e.debit || e.amount).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-2 text-right text-emerald-400 font-bold">
                        {(e.type === 'CREDIT' || (e.credit || 0) > 0) ? `₹${(e.credit || e.amount).toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleSaveImport}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-1.5 rounded shadow cursor-pointer"
              >
                Save &amp; Auto-Reconcile ({parsedEntries.length} Transactions)
              </button>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
