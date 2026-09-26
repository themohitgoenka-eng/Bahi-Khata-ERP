import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ShortcutKeyConfig, ShortcutActionType, VoucherType } from '../../types';
import { shortcutService } from '../../services/shortcutService';
import {
  Keyboard,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  X,
  Search,
  AlertTriangle,
  Zap,
  Info,
  Compass,
  Receipt,
  Sliders,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vouchers', label: 'Voucher Register' },
  { id: 'day_book', label: 'Day Book' },
  { id: 'cash_book', label: 'Cash Book' },
  { id: 'ledgers', label: 'Ledger Statement' },
  { id: 'chart_of_accounts', label: 'Chart of Accounts' },
  { id: 'bank_accounts', label: 'Bank Accounts' },
  { id: 'bank_reconciliation', label: 'Bank Reconciliation (BRS)' },
  { id: 'inventory_summary', label: 'Stock Summary' },
  { id: 'stock_ledger', label: 'Item Stock Ledger' },
  { id: 'wastage_analysis', label: 'Wastage & Rejection' },
  { id: 'trial_balance', label: 'Trial Balance' },
  { id: 'profit_loss', label: 'Profit & Loss A/c' },
  { id: 'balance_sheet', label: 'Balance Sheet' },
  { id: 'outstanding', label: 'Outstanding (Aging)' },
  { id: 'sync', label: 'Cloud Sync Center' },
];

const VOUCHER_TYPES: { id: VoucherType; label: string }[] = [
  { id: 'CONTRA', label: 'Contra Voucher (Bank & Cash)' },
  { id: 'PAYMENT', label: 'Payment Voucher (Expense/Outward)' },
  { id: 'RECEIPT', label: 'Receipt Voucher (Income/Inward)' },
  { id: 'JOURNAL', label: 'Journal Voucher (Adjustment)' },
  { id: 'SALES', label: 'Sales Invoice (Outward + Inventory)' },
  { id: 'PURCHASE', label: 'Purchase Invoice (Inward + Inventory)' },
  { id: 'PURCHASE_RETURN', label: 'Debit Note (Purchase Return)' },
  { id: 'SALES_RETURN', label: 'Credit Note (Sales Return)' },
  { id: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment' },
  { id: 'OPENING_BALANCE', label: 'Opening Balance' },
  { id: 'BANK_ENTRY', label: 'Bank Direct Entry' },
];

const FUNCTION_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const ALPHABET_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBER_KEYS = '0123456789'.split('');

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    resetShortcutsToDefault,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    label: string;
    category: 'Voucher Entry' | 'Navigation' | 'Actions';
    actionType: ShortcutActionType;
    targetPayload: string;
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    enabled: boolean;
    description: string;
  }>({
    label: '',
    category: 'Voucher Entry',
    actionType: 'OPEN_VOUCHER',
    targetPayload: 'PAYMENT',
    key: 'F5',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    enabled: true,
    description: '',
  });

  const [isRecordingKey, setIsRecordingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Key recorder event listener
  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record modifier keys alone
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      let detectedKey = e.key.toUpperCase();
      if (detectedKey === ' ') detectedKey = 'SPACE';

      setFormData((prev) => ({
        ...prev,
        key: detectedKey,
        ctrlKey: e.ctrlKey || e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      }));

      setIsRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeyRecord, true);
    return () => window.removeEventListener('keydown', handleKeyRecord, true);
  }, [isRecordingKey]);

  // Live test key press listener
  useEffect(() => {
    const handleTestKey = (e: KeyboardEvent) => {
      if (isRecordingKey || isAddingNew || editingId) return;

      const matched = shortcuts.find((sc) => shortcutService.matchesEvent(e, sc));
      if (matched) {
        setTestResult(`Triggered: ${matched.label} (${shortcutService.formatKeyCombo(matched)})`);
      }
    };

    window.addEventListener('keydown', handleTestKey);
    return () => window.removeEventListener('keydown', handleTestKey);
  }, [shortcuts, isRecordingKey, isAddingNew, editingId]);

  const handleStartAdd = () => {
    setEditingId(null);
    setFormData({
      label: 'New Shortcut Action',
      category: 'Voucher Entry',
      actionType: 'OPEN_VOUCHER',
      targetPayload: 'PAYMENT',
      key: 'F5',
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      enabled: true,
      description: 'Custom ERP Shortcut',
    });
    setIsAddingNew(true);
  };

  const handleStartEdit = (sc: ShortcutKeyConfig) => {
    setIsAddingNew(false);
    setEditingId(sc.id);
    setFormData({
      label: sc.label,
      category: sc.category,
      actionType: sc.actionType,
      targetPayload: sc.targetPayload || '',
      key: sc.key,
      ctrlKey: Boolean(sc.ctrlKey),
      altKey: Boolean(sc.altKey),
      shiftKey: Boolean(sc.shiftKey),
      enabled: sc.enabled,
      description: sc.description || '',
    });
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setIsRecordingKey(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key.trim()) return;

    if (isAddingNew) {
      addShortcut({
        label: formData.label.trim() || 'Custom Shortcut',
        category: formData.category,
        actionType: formData.actionType,
        targetPayload: formData.targetPayload,
        key: formData.key.toUpperCase(),
        ctrlKey: formData.ctrlKey,
        altKey: formData.altKey,
        shiftKey: formData.shiftKey,
        enabled: formData.enabled,
        description: formData.description.trim(),
      });
    } else if (editingId) {
      updateShortcut(editingId, {
        label: formData.label.trim() || 'Custom Shortcut',
        category: formData.category,
        actionType: formData.actionType,
        targetPayload: formData.targetPayload,
        key: formData.key.toUpperCase(),
        ctrlKey: formData.ctrlKey,
        altKey: formData.altKey,
        shiftKey: formData.shiftKey,
        enabled: formData.enabled,
        description: formData.description.trim(),
      });
    }

    setIsAddingNew(false);
    setEditingId(null);
  };

  // Conflict check for current form combination
  const conflictingShortcut = shortcuts.find((sc) => {
    if (editingId && sc.id === editingId) return false;
    return (
      sc.enabled &&
      sc.key.toUpperCase() === formData.key.toUpperCase() &&
      Boolean(sc.ctrlKey) === formData.ctrlKey &&
      Boolean(sc.altKey) === formData.altKey &&
      Boolean(sc.shiftKey) === formData.shiftKey
    );
  });

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter((sc) => {
    const matchesCat = selectedCategory === 'ALL' || sc.category === selectedCategory;
    const matchesSearch =
      sc.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sc.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sc.description && sc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      shortcutService.formatKeyCombo(sc).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ERP Keyboard Shortcut Keys
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-normal">
                  {shortcuts.filter((s) => s.enabled).length} Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Customize, add, or edit fast keyboard mappings for vouchers, navigation, and actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartAdd}
              disabled={isAddingNew || editingId !== null}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Key</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Restore all shortcut keys to original ERP factory defaults?')) {
                  resetShortcutsToDefault();
                }
              }}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs transition cursor-pointer"
              title="Reset to ERP Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-2.5 items-center justify-between shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shortcut (e.g. F4, Payment, Dashboard, Alt+D)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'Voucher Entry', 'Navigation', 'Actions'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition text-xs font-medium cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Keys' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add / Edit Form Modal Panel */}
          {(isAddingNew || editingId !== null) && (
            <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-4 shadow-xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  {isAddingNew ? 'Add New Shortcut Key' : 'Edit Shortcut Key'}
                </h3>
                <span className="text-xs text-slate-400">
                  Preview: <span className="font-mono font-bold text-amber-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-700">{shortcutService.formatKeyCombo(formData)}</span>
                </span>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Shortcut Label */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Shortcut Name / Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="e.g. Sales Invoice Fast Key"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-amber-500 text-xs"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[#7F98AE] font-medium mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as any,
                          actionType: e.target.value === 'Voucher Entry' ? 'OPEN_VOUCHER' : e.target.value === 'Navigation' ? 'NAVIGATE_TAB' : 'GLOBAL_SEARCH',
                        })
                      }
                      className="w-full px-3 py-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] text-xs cursor-pointer"
                    >
                      <option value="Voucher Entry">Voucher Entry (F4-F9, etc.)</option>
                      <option value="Navigation">Navigation (Switch View/Tab)</option>
                      <option value="Actions">Actions (Search, Sync, etc.)</option>
                    </select>
                  </div>

                  {/* Action Type & Target */}
                  <div>
                    <label className="block text-[#7F98AE] font-medium mb-1">Action Type</label>
                    <select
                      value={formData.actionType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          actionType: e.target.value as ShortcutActionType,
                          targetPayload:
                            e.target.value === 'OPEN_VOUCHER'
                              ? 'PAYMENT'
                              : e.target.value === 'NAVIGATE_TAB'
                              ? 'dashboard'
                              : '',
                        })
                      }
                      className="w-full px-3 py-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] text-xs cursor-pointer"
                    >
                      <option value="OPEN_VOUCHER">Open Voucher Entry Form</option>
                      <option value="NAVIGATE_TAB">Navigate To View / Tab</option>
                      <option value="GLOBAL_SEARCH">Open Global Search (Ctrl+F)</option>
                      <option value="SYNC_CLOUD">Trigger Cloud Sync (Alt+Y)</option>
                    </select>
                  </div>

                  {/* Target Selector */}
                  {formData.actionType === 'OPEN_VOUCHER' && (
                    <div>
                      <label className="block text-[#7F98AE] font-medium mb-1">Voucher Type</label>
                      <select
                        value={formData.targetPayload}
                        onChange={(e) => setFormData({ ...formData, targetPayload: e.target.value })}
                        className="w-full px-3 py-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] text-xs font-semibold cursor-pointer"
                      >
                        {VOUCHER_TYPES.map((vt) => (
                          <option key={vt.id} value={vt.id}>
                            {vt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.actionType === 'NAVIGATE_TAB' && (
                    <div>
                      <label className="block text-[#7F98AE] font-medium mb-1">Target Screen / Tab</label>
                      <select
                        value={formData.targetPayload}
                        onChange={(e) => setFormData({ ...formData, targetPayload: e.target.value })}
                        className="w-full px-3 py-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] text-xs cursor-pointer"
                      >
                        {AVAILABLE_TABS.map((tab) => (
                          <option key={tab.id} value={tab.id}>
                            {tab.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Key Combination Selector & Key Recorder */}
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Key Combination Setup
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsRecordingKey(!isRecordingKey)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isRecordingKey
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>{isRecordingKey ? 'Press any key on keyboard...' : 'Press Key to Record'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    {/* Modifiers */}
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium select-none">
                        <input
                          type="checkbox"
                          checked={formData.ctrlKey}
                          onChange={(e) => setFormData({ ...formData, ctrlKey: e.target.checked })}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>Ctrl / Cmd</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium select-none">
                        <input
                          type="checkbox"
                          checked={formData.altKey}
                          onChange={(e) => setFormData({ ...formData, altKey: e.target.checked })}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>Alt</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium select-none">
                        <input
                          type="checkbox"
                          checked={formData.shiftKey}
                          onChange={(e) => setFormData({ ...formData, shiftKey: e.target.checked })}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>Shift</span>
                      </label>
                    </div>

                    {/* Primary Key Selector */}
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <span className="text-slate-400 font-medium">+ Key:</span>
                      <select
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg text-[#FFFFFF] font-mono font-bold text-xs focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                      >
                        <optgroup label="Function Keys (F1-F12)">
                          {FUNCTION_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Letters (A-Z)">
                          {ALPHABET_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Numbers (0-9)">
                          {NUMBER_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Other Keys">
                          <option value="ESCAPE">Escape</option>
                          <option value="ENTER">Enter</option>
                          <option value="SPACE">Space</option>
                          <option value="DELETE">Delete</option>
                          <option value="BACKSPACE">Backspace</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Conflict Warning */}
                  {conflictingShortcut && (
                    <div className="p-2 bg-amber-950/60 border border-amber-600/60 rounded-lg text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Key Conflict:</strong> This key combination is already assigned to{' '}
                        <strong>"{conflictingShortcut.label}"</strong>.
                      </span>
                    </div>
                  )}
                </div>

                {/* Description and Enabled */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Shortcut Enabled</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelForm}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Shortcut</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Shortcuts Table / Cards */}
          <div className="space-y-2">
            {filteredShortcuts.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-slate-800">
                <Keyboard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No shortcuts found</p>
                <p className="text-xs text-slate-500 mt-0.5">Try searching with a different term or add a new key</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredShortcuts.map((sc) => {
                  const isEditingThis = editingId === sc.id;
                  return (
                    <div
                      key={sc.id}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isEditingThis
                          ? 'bg-amber-950/30 border-amber-500'
                          : sc.enabled
                          ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      {/* Left: Key Badge & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Key badge */}
                        <div className="shrink-0 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-amber-400 font-mono font-bold text-xs shadow-inner flex items-center justify-center min-w-[70px]">
                          {shortcutService.formatKeyCombo(sc)}
                        </div>

                        {/* Title & category */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs truncate">{sc.label}</span>
                            {!sc.enabled && (
                              <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-800 px-1 py-0.2 rounded">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                            {sc.actionType === 'OPEN_VOUCHER' && (
                              <span className="text-amber-400 font-medium">Voucher: {sc.targetPayload}</span>
                            )}
                            {sc.actionType === 'NAVIGATE_TAB' && (
                              <span className="text-sky-400 font-medium">Tab: {sc.targetPayload}</span>
                            )}
                            {sc.actionType === 'GLOBAL_SEARCH' && (
                              <span className="text-purple-400 font-medium">Action: Search</span>
                            )}
                            {sc.actionType === 'SYNC_CLOUD' && (
                              <span className="text-emerald-400 font-medium">Action: Sync</span>
                            )}
                            {sc.description && (
                              <span className="text-slate-500 truncate hidden sm:inline">&bull; {sc.description}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions (Toggle, Edit, Delete) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Toggle Enable/Disable */}
                        <button
                          onClick={() => updateShortcut(sc.id, { enabled: !sc.enabled })}
                          className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                            sc.enabled
                              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/80'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                          title={sc.enabled ? 'Click to Disable' : 'Click to Enable'}
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => handleStartEdit(sc)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-xs transition cursor-pointer"
                          title="Edit Shortcut"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete shortcut for "${sc.label}"?`)) {
                              deleteShortcut(sc.id);
                            }
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg text-xs transition cursor-pointer"
                          title="Delete Shortcut"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Live Test Box & Status */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono text-[10px] text-amber-300">F4-F9</kbd> anywhere in the app to open vouchers instantly.
            </span>
          </div>

          {testResult && (
            <div className="text-amber-400 font-mono font-semibold bg-amber-950/50 border border-amber-600/50 px-3 py-1 rounded-lg animate-pulse">
              {testResult}
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
