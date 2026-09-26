import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BankStatementTransaction, BankAccount } from '../../types';
import { bankingEngine } from '../../services/bankingEngine';
import { formatDateDisplay } from '../../utils/dateUtils';
import {
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

interface BankEntryPostingModalProps {
  entry: BankStatementTransaction;
  bankAccount: BankAccount;
  onClose: () => void;
  onSuccess: () => void;
}

export const BankEntryPostingModal: React.FC<BankEntryPostingModalProps> = ({
  entry,
  bankAccount,
  onClose,
  onSuccess,
}) => {
  const { ledgers, showNotification, refreshActiveData } = useApp();

  const isWithdrawal = entry.type === 'DEBIT' || (entry.debit || 0) > 0;
  const amount = (entry.credit || 0) > 0 ? entry.credit : (entry.debit || entry.amount || 0);

  // Suggested opposing ledger
  const defaultOpposing = isWithdrawal
    ? ledgers.find((l) => l.name.toLowerCase().includes('bank charge') || l.name.toLowerCase().includes('office')) || ledgers[0]
    : ledgers.find((l) => l.groupId === 'grp-sundry-debtors' || l.name.toLowerCase().includes('sales')) || ledgers[0];

  const [opposingLedgerId, setOpposingLedgerId] = useState<string>(defaultOpposing?.id || '');
  const [narration, setNarration] = useState<string>(
    entry.narration || entry.description || (isWithdrawal ? 'Bank Payment / Debit Entry' : 'Bank Direct Deposit / Receipt')
  );

  const handlePost = async () => {
    if (!opposingLedgerId) {
      showNotification('Please select an opposing ledger.', 'error');
      return;
    }

    try {
      await bankingEngine.postVoucherFromStatement(entry, bankAccount, opposingLedgerId, narration);
      showNotification(`Posted and auto-reconciled voucher for ₹${amount?.toFixed(2)}`, 'success');
      await refreshActiveData();
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to post voucher.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-mono">
      <div className="bg-[#0d0f17] border border-slate-800 rounded p-5 w-full max-w-md space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Quick Post &amp; Reconcile Statement Row
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        {/* Statement Detail Box */}
        <div className="bg-[#090a0f] p-3 rounded border border-slate-800 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Statement Date:</span>
            <span className="font-mono text-white font-bold">{formatDateDisplay(entry.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bank Entry Type:</span>
            <span className={isWithdrawal ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isWithdrawal ? 'DEBIT / WITHDRAWAL (Payment)' : 'CREDIT / DEPOSIT (Receipt)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Amount:</span>
            <span className="font-mono text-sm font-bold text-amber-300">
              ₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bank Narration:</span>
            <span className="text-slate-300 font-mono truncate max-w-[220px]">{entry.narration || entry.description}</span>
          </div>
        </div>

        {/* Posting Form */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Select Counter Ledger Account *
            </label>
            <select
              value={opposingLedgerId}
              onChange={(e) => setOpposingLedgerId(e.target.value)}
              className="w-full bg-[#090a0f] border border-slate-800 rounded p-2 text-white text-xs focus:outline-hidden focus:border-sky-500"
            >
              {ledgers.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#0d0f17] text-white">
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Voucher Narration
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full bg-[#090a0f] border border-slate-800 rounded p-2 text-white text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handlePost}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded flex items-center gap-1.5 shadow cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Post &amp; Auto-Reconcile
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
