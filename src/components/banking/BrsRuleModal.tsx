import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { brsRuleService } from '../../services/brsRuleService';
import { BrsRule, Ledger } from '../../types';
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Play,
  FileCheck,
} from 'lucide-react';

interface BrsRuleModalProps {
  onClose: () => void;
  onApplyRules: () => void;
}

export const BrsRuleModal: React.FC<BrsRuleModalProps> = ({ onClose, onApplyRules }) => {
  const { currentCompany, ledgers, showNotification } = useApp();
  const [rules, setRules] = useState<BrsRule[]>(() =>
    currentCompany ? brsRuleService.getRules(currentCompany.id) : []
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newTargetLedgerId, setNewTargetLedgerId] = useState('');
  const [newTxnType, setNewTxnType] = useState<'Payment' | 'Receipt' | 'ANY'>('Payment');
  const [newAutoPost, setNewAutoPost] = useState(false);

  const handleToggleActive = (rule: BrsRule) => {
    if (!currentCompany) return;
    const updated = { ...rule, isActive: !rule.isActive };
    brsRuleService.updateRule(currentCompany.id, updated);
    setRules(brsRuleService.getRules(currentCompany.id));
    showNotification(`Rule "${rule.name}" ${updated.isActive ? 'activated' : 'paused'}.`, 'info');
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!currentCompany) return;
    brsRuleService.deleteRule(currentCompany.id, ruleId);
    setRules(brsRuleService.getRules(currentCompany.id));
    showNotification('Rule deleted successfully.', 'info');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    if (!newRuleName.trim() || !newKeywords.trim()) {
      showNotification('Please provide a rule name and keywords.', 'error');
      return;
    }

    const selectedLedger = ledgers.find((l) => l.id === newTargetLedgerId) || ledgers[0];
    const keywordsList = newKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const created = brsRuleService.addRule(currentCompany.id, {
      name: newRuleName.trim(),
      keywords: keywordsList,
      targetLedgerId: selectedLedger?.id || '',
      targetLedgerName: selectedLedger?.name || newRuleName.trim(),
      transactionType: newTxnType,
      autoPost: newAutoPost,
      isActive: true,
    });

    setRules(brsRuleService.getRules(currentCompany.id));
    setIsAdding(false);
    setNewRuleName('');
    setNewKeywords('');
    showNotification(`Rule "${created.name}" created successfully!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-6 py-4 border-b border-purple-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                BRS Auto-Matching &amp; Posting Rules
              </h2>
              <p className="text-xs text-purple-200/80">
                Automate ledger mapping &amp; suggestions from bank statement narrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-3 bg-purple-950/30 border border-purple-900/50 rounded-xl p-3.5">
            <div className="text-xs text-purple-200">
              <span className="font-bold text-white">Rule Engine Active:</span> Keyword matching scans NEFT, RTGS, UPI, and bank remarks to automatically suggest and assign matching ledgers.
            </div>
            <button
              onClick={() => {
                onApplyRules();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Apply Rules Now
            </button>
          </div>

          {/* Add Rule Form or Button */}
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 border-2 border-dashed border-slate-700 hover:border-purple-500/60 hover:bg-purple-950/20 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-purple-400" />
              Add New Automation Rule
            </button>
          ) : (
            <form onSubmit={handleCreateRule} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  New Rule Definition
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g. Ganpati Corp NEFT"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Keywords (comma separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="e.g. GANPATI, GANPATI COR, HDFC"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Map to Ledger *
                  </label>
                  <select
                    value={newTargetLedgerId}
                    onChange={(e) => setNewTargetLedgerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500"
                  >
                    <option value="">-- Select Target Ledger --</option>
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={newTxnType}
                    onChange={(e) => setNewTxnType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500"
                  >
                    <option value="Payment">Payment (Withdrawal)</option>
                    <option value="Receipt">Receipt (Deposit)</option>
                    <option value="ANY">Any Type</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  Save Rule
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Rules List */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Configured Rules ({rules.length})
            </div>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs truncate">
                        {rule.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          rule.transactionType === 'Payment'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : rule.transactionType === 'Receipt'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {rule.transactionType}
                      </span>
                      {!rule.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                      <span className="text-slate-500">Keywords:</span>
                      {rule.keywords.map((k, i) => (
                        <span
                          key={i}
                          className="bg-purple-950/60 border border-purple-800/50 text-purple-200 px-1.5 py-0.2 rounded font-mono text-[10px]"
                        >
                          {k}
                        </span>
                      ))}
                      <span className="text-slate-500 ml-1">&rarr;</span>
                      <span className="text-sky-300 font-medium">
                        {rule.targetLedgerName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        rule.isActive
                          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/50'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Rules apply automatically on statement import and manual triggers
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onApplyRules();
                onClose();
              }}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              <FileCheck className="w-3.5 h-3.5" />
              Apply &amp; Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
