import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Settings,
  Plus,
  Trash2,
  Check,
  Save,
  Layers,
  Info,
  RefreshCw,
} from 'lucide-react';
import { VoucherType, VoucherSeriesConfig, Ledger } from '../../types';
import { voucherSeriesService } from '../../services/voucherSeriesService';
import { db } from '../../db';

interface VoucherSeriesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVoucherType: VoucherType;
  fiscalYearShort: string;
  ledgers: Ledger[];
  onSeriesConfigUpdated: (activeSeriesName?: string) => void;
  focusSeriesName?: string;
}

const VOUCHER_TYPE_OPTIONS: { type: VoucherType; label: string }[] = [
  { type: 'PAYMENT', label: 'Payment (F5)' },
  { type: 'RECEIPT', label: 'Receipt (F6)' },
  { type: 'CONTRA', label: 'Contra (F4)' },
  { type: 'JOURNAL', label: 'Journal (F7)' },
  { type: 'PURCHASE_RETURN', label: 'Debit Note (F10)' },
  { type: 'SALES_RETURN', label: 'Credit Note (F11)' },
];

export const VoucherSeriesSettingsModal: React.FC<VoucherSeriesSettingsModalProps> = ({
  isOpen,
  onClose,
  currentVoucherType,
  fiscalYearShort,
  ledgers,
  onSeriesConfigUpdated,
  focusSeriesName,
}) => {
  const getEffectiveVoucherType = (type: VoucherType): VoucherType => {
    return type === 'PURCHASE' ? 'PAYMENT' : type;
  };

  const [selectedType, setSelectedType] = useState<VoucherType>(() =>
    getEffectiveVoucherType(currentVoucherType)
  );
  const [allConfigs, setAllConfigs] = useState<VoucherSeriesConfig[]>(() =>
    voucherSeriesService.getStoredSeriesConfigs()
  );

  // Selected series ID for the active voucher type
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(() => {
    const configs = voucherSeriesService.getStoredSeriesConfigs();
    const effectiveType = getEffectiveVoucherType(currentVoucherType);
    const active = configs.filter((c) => c.voucherType === effectiveType);
    const def = active.find((c) => c.isDefault) || active[0];
    return def?.id || '';
  });

  // Series save feedback message
  const [seriesSavedMsg, setSeriesSavedMsg] = useState<string>('');

  // Reset confirmation modal state
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // New series creation state
  const [isAddingSeries, setIsAddingSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');

  // Starting No interactive input states
  const [startingNoInput, setStartingNoInput] = useState<string>('');
  const [isStartingNoFocused, setIsStartingNoFocused] = useState<boolean>(false);

  // Auto-sync active voucher type and series whenever modal is opened or currentVoucherType changes
  useEffect(() => {
    setIsStartingNoFocused(false);
    setStartingNoInput('');
  }, [selectedSeriesId, selectedType]);
  useEffect(() => {
    if (isOpen) {
      const effectiveType = getEffectiveVoucherType(currentVoucherType);
      setSelectedType(effectiveType);
      const configs = voucherSeriesService.getStoredSeriesConfigs();
      setAllConfigs(configs);
      const active = configs.filter((c) => c.voucherType === effectiveType);
      const target = (focusSeriesName && active.find((c) => c.seriesName === focusSeriesName)) ||
        active.find((c) => c.isDefault) ||
        active[0];
      if (target) {
        setSelectedSeriesId(target.id);
      }
    }
  }, [isOpen, currentVoucherType, focusSeriesName]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hasOpenDropdown = document.querySelector('[data-dropdown-open="true"]');
        if (hasOpenDropdown) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter series for active voucher type
  const activeSeriesList = allConfigs.filter((c) => c.voucherType === selectedType);

  // Active selected series
  const selectedSeries =
    activeSeriesList.find((c) => c.id === selectedSeriesId) ||
    activeSeriesList.find((c) => c.isDefault) ||
    activeSeriesList[0];

  // Handle switching voucher type
  const handleSelectType = (newType: VoucherType) => {
    setSelectedType(newType);
    const typeSeries = allConfigs.filter((c) => c.voucherType === newType);
    const def = typeSeries.find((c) => c.isDefault) || typeSeries[0];
    if (def) {
      setSelectedSeriesId(def.id);
    }
  };

  // Toggle Default Pattern for a series
  const handleToggleDefaultPattern = (seriesId: string) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const willBeDefault = s.useDefaultPattern === false;
        if (willBeDefault) {
          // Sync with the shared default pattern of this voucher type
          const defaultSeries =
            prev.find((item) => item.voucherType === s.voucherType && item.isDefault) ||
            prev.find((item) => item.voucherType === s.voucherType && item.useDefaultPattern !== false) ||
            s;
          return {
            ...s,
            useDefaultPattern: true,
            prefix: defaultSeries.prefix,
            suffix: defaultSeries.suffix,
            nextNumber: defaultSeries.nextNumber,
            numberPadding: defaultSeries.numberPadding,
          };
        } else {
          return {
            ...s,
            useDefaultPattern: false,
          };
        }
      })
    );
  };

  // Update a specific field for a series
  // If useDefaultPattern is ON: changes to prefix, suffix, nextNumber, numberPadding apply to all series of this voucher type with Default ON
  // If useDefaultPattern is OFF: changes apply ONLY to this specific series
  const handleUpdateSeriesField = (
    id: string,
    field: keyof VoucherSeriesConfig,
    value: any
  ) => {
    const current = allConfigs.find((c) => c.id === id);
    const isShared = current?.useDefaultPattern !== false;

    if (['prefix', 'suffix', 'nextNumber', 'numberPadding'].includes(field)) {
      if (isShared) {
        setAllConfigs((prev) =>
          prev.map((item) =>
            item.voucherType === selectedType && item.useDefaultPattern !== false
              ? { ...item, [field]: value }
              : item
          )
        );
      } else {
        setAllConfigs((prev) =>
          prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        );
      }
    } else {
      setAllConfigs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    }
  };

  // Multiple Fixed DR ledgers management
  const handleUpdateDrLedger = (seriesId: string, idx: number, value: string) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = s.defaultDrLedgerIds && s.defaultDrLedgerIds.length > 0
          ? [...s.defaultDrLedgerIds]
          : [s.defaultDrLedgerId || ''];
        current[idx] = value;
        const valid = current.filter(Boolean);
        return {
          ...s,
          defaultDrLedgerIds: current,
          defaultDrLedgerId: valid[0] || undefined,
        };
      })
    );
  };

  const handleAddDrLedger = (seriesId: string) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = s.defaultDrLedgerIds && s.defaultDrLedgerIds.length > 0
          ? [...s.defaultDrLedgerIds]
          : [s.defaultDrLedgerId || ''];
        current.push('');
        return {
          ...s,
          defaultDrLedgerIds: current,
          defaultDrLedgerId: current.find(Boolean) || undefined,
        };
      })
    );
  };

  const handleRemoveDrLedger = (seriesId: string, idx: number) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = (s.defaultDrLedgerIds && s.defaultDrLedgerIds.length > 0
          ? [...s.defaultDrLedgerIds]
          : [s.defaultDrLedgerId || '']
        ).filter((_, i) => i !== idx);
        const finalArr = current.length > 0 ? current : [''];
        const valid = finalArr.filter(Boolean);
        return {
          ...s,
          defaultDrLedgerIds: finalArr,
          defaultDrLedgerId: valid[0] || undefined,
        };
      })
    );
  };

  // Multiple Fixed CR ledgers management
  const handleUpdateCrLedger = (seriesId: string, idx: number, value: string) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = s.defaultCrLedgerIds && s.defaultCrLedgerIds.length > 0
          ? [...s.defaultCrLedgerIds]
          : [s.defaultCrLedgerId || ''];
        current[idx] = value;
        const valid = current.filter(Boolean);
        return {
          ...s,
          defaultCrLedgerIds: current,
          defaultCrLedgerId: valid[0] || undefined,
        };
      })
    );
  };

  const handleAddCrLedger = (seriesId: string) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = s.defaultCrLedgerIds && s.defaultCrLedgerIds.length > 0
          ? [...s.defaultCrLedgerIds]
          : [s.defaultCrLedgerId || ''];
        current.push('');
        return {
          ...s,
          defaultCrLedgerIds: current,
          defaultCrLedgerId: current.find(Boolean) || undefined,
        };
      })
    );
  };

  const handleRemoveCrLedger = (seriesId: string, idx: number) => {
    setAllConfigs((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const current = (s.defaultCrLedgerIds && s.defaultCrLedgerIds.length > 0
          ? [...s.defaultCrLedgerIds]
          : [s.defaultCrLedgerId || '']
        ).filter((_, i) => i !== idx);
        const finalArr = current.length > 0 ? current : [''];
        const valid = finalArr.filter(Boolean);
        return {
          ...s,
          defaultCrLedgerIds: finalArr,
          defaultCrLedgerId: valid[0] || undefined,
        };
      })
    );
  };

  // Set default series for this voucher type
  const handleSetDefaultSeries = (id: string) => {
    setAllConfigs((prev) =>
      prev.map((item) => {
        if (item.voucherType === selectedType) {
          return { ...item, isDefault: item.id === id };
        }
        return item;
      })
    );
  };

  // Delete a series
  const handleDeleteSeries = (id: string) => {
    if (activeSeriesList.length <= 1) {
      alert('At least one series must remain configured for this voucher type.');
      return;
    }
    const remaining = activeSeriesList.filter((item) => item.id !== id);
    setAllConfigs((prev) => prev.filter((item) => item.id !== id));
    if (selectedSeriesId === id && remaining.length > 0) {
      setSelectedSeriesId(remaining[0].id);
    }
  };

  // Add new series
  const handleAddNewSeries = () => {
    const trimmed = newSeriesName.trim().toUpperCase();
    if (!trimmed) return;

    if (activeSeriesList.some((s) => s.seriesName === trimmed)) {
      alert(`Series "${trimmed}" already exists for this voucher type.`);
      return;
    }

    const currentSample = activeSeriesList[0];
    const newConfig: VoucherSeriesConfig = {
      id: `ser-${selectedType.toLowerCase()}-${trimmed.toLowerCase()}-${Date.now()}`,
      voucherType: selectedType,
      seriesName: trimmed,
      prefix: currentSample?.prefix ?? '',
      suffix: currentSample?.suffix ?? '',
      nextNumber: currentSample?.nextNumber ?? 1,
      numberPadding: currentSample?.numberPadding ?? 4,
      isDefault: false,
      useDefaultPattern: true,
      defaultSundries: currentSample?.defaultSundries
        ? JSON.parse(JSON.stringify(currentSample.defaultSundries))
        : [
            { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
            { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
            { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
          ],
    };

    setAllConfigs((prev) => [...prev, newConfig]);
    setSelectedSeriesId(newConfig.id);
    setNewSeriesName('');
    setIsAddingSeries(false);
  };

  // Save all configurations
  const handleSave = () => {
    voucherSeriesService.saveSeriesConfigs(allConfigs);

    // Sync sales & purchase series with db.seriesList so all modules share the exact configs
    try {
      allConfigs
        .filter((c) => c.voucherType === 'SALES' || c.voucherType === 'PURCHASE')
        .forEach((c) => {
          db.seriesList.put({
            name: c.seriesName,
            prefix: c.prefix || (c.seriesName === 'MAIN' ? 'INV' : c.seriesName.slice(0, 3)),
            seriesType: c.voucherType === 'SALES' ? 'sales' : 'purchase',
            sundries: (c.defaultSundries || []).map((s) => ({
              name: s.name,
              defaultAmount: Number(s.amount) || 0,
              type: s.type,
              isPercentage: s.isPercentage,
            })),
            updatedAt: Date.now(),
          });
        });
    } catch (e) {
      console.error('Failed to sync series to db.seriesList', e);
    }

    const currentDefault = allConfigs.find(
      (c) => c.voucherType === currentVoucherType && c.isDefault
    );
    const targetSeriesName = selectedSeries?.seriesName || currentDefault?.seriesName;
    onSeriesConfigUpdated(targetSeriesName);
    onClose();
  };

  // Reset to default settings for selected voucher type only
  const selectedTypeLabel =
    VOUCHER_TYPE_OPTIONS.find((o) => o.type === selectedType)?.label.replace(/\s*\(F\d+\)/, '') ||
    selectedType;

  const handleResetToDefault = () => {
    setShowResetConfirm(true);
  };

  const performReset = () => {
    const updated = voucherSeriesService.resetVoucherTypeToDefaults(selectedType);
    setAllConfigs(updated);
    const active = updated.filter((c) => c.voucherType === selectedType);
    const def = active.find((c) => c.isDefault) || active[0];
    if (def) setSelectedSeriesId(def.id);
    setShowResetConfirm(false);
    setSeriesSavedMsg(`${selectedTypeLabel} series settings restored to defaults!`);
    setTimeout(() => setSeriesSavedMsg(''), 4000);
    const currentDefault = updated.find(
      (c) => c.voucherType === currentVoucherType && c.isDefault
    );
    onSeriesConfigUpdated(currentDefault?.seriesName);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col text-[#FFFFFF] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between bg-[rgba(18,48,76,0.48)] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
                VOUCHER SERIES & NUMBERING CONFIGURATION
                <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-2 py-0.5 rounded-lg border border-[rgba(112,185,245,0.25)] font-semibold">
                  Prefix, Suffix & Fixed Ledgers
                </span>
              </h2>
              <p className="text-[11px] text-[#7F98AE] font-mono">
                Series-wise numbering format and default Debit/Credit Account Ledger fixator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefault}
              type="button"
              className="px-2.5 py-1 text-[11px] font-medium text-[#7F98AE] hover:text-[#2588E8] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-xl transition flex items-center gap-1 cursor-pointer border border-[rgba(112,185,245,0.25)]"
              title={`Reset ${selectedTypeLabel} series settings to defaults`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset ({selectedTypeLabel})</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="text-[#7F98AE] hover:text-[#FFFFFF] p-1 rounded-lg hover:bg-[rgba(37, 136, 232, 0.10)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Voucher Type Tabs */}
        <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mr-1">
            Voucher Type:
          </span>
          {VOUCHER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleSelectType(opt.type)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedType === opt.type
                  ? 'bg-[#2588E8] text-[#FFFFFF] font-bold shadow-sm'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:bg-[rgba(37, 136, 232, 0.12)] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              {opt.label}
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                  selectedType === opt.type ? 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold' : 'bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#7F98AE]'
                }`}
              >
                {allConfigs.filter((c) => c.voucherType === opt.type).length}
              </span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs text-[#FFFFFF]">
          {/* Series Configuration Header with Dropdown */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(112,185,245,0.25)] pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2588E8]" />
                  <h3 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">
                    {voucherSeriesService.getVoucherTypeLabel(selectedType)} Series Configurations
                  </h3>
                </div>

                {/* Dropdown containing all series for this voucher type */}
                <div className="flex items-center gap-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-1 rounded-xl border border-[rgba(112,185,245,0.25)]">
                  <label className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider whitespace-nowrap">
                    Series:
                  </label>
                  <select
                    id="modal_selected_series_dropdown"
                    value={selectedSeries?.id || ''}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1 text-xs text-[#2588E8] font-bold focus:outline-hidden focus:border-[#2588E8] cursor-pointer h-[28px] min-w-[140px]"
                  >
                    {activeSeriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seriesName} {s.isDefault ? '★ (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSeries(true)}
                  className="bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer h-[32px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Series</span>
                </button>
              </div>
            </div>

            {/* Inline Add New Series Form */}
            {isAddingSeries && (
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-3 flex items-end gap-2.5 animate-in fade-in duration-100">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-[#2588E8] uppercase tracking-wider mb-1">
                    New Series Name (e.g. BRANCH-1, EXPORT, PETTY-CASH)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter series name..."
                    value={newSeriesName}
                    onChange={(e) => setNewSeriesName(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewSeries()}
                    autoFocus
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1.5 text-xs text-[#FFFFFF] font-mono font-bold focus:outline-hidden focus:border-[#2588E8]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddNewSeries}
                  className="px-3.5 py-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 h-[34px] shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Series</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSeries(false);
                    setNewSeriesName('');
                  }}
                  className="px-3 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(37, 136, 232, 0.12)] text-[#B7C9D9] font-medium rounded-xl text-xs transition cursor-pointer border border-[rgba(112,185,245,0.25)] h-[34px]"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Selected Series Configuration Panel */}
            {selectedSeries ? (
              <div
                key={selectedSeries.id}
                className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 transition space-y-3.5 shadow-sm"
              >
                {/* Top Bar: Series Name, Default status, Preview, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[rgba(112,185,245,0.25)] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1 rounded-xl border border-[rgba(112,185,245,0.25)]">
                      {selectedSeries.seriesName}
                    </span>
                    {selectedSeries.isDefault ? (
                      <span className="text-[10px] font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        DEFAULT SERIES
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultSeries(selectedSeries.id)}
                        className="text-[11px] font-semibold text-[#B7C9D9] hover:text-[#2588E8] hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
                      >
                        Make Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Delete Series Button */}
                    {selectedSeries.seriesName !== 'MAIN' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSeries(selectedSeries.id)}
                        className="text-[#fca5a5] hover:bg-[#421d23] p-1.5 rounded-lg transition cursor-pointer"
                        title="Delete this series"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Feedback message if user clicked save */}
                {seriesSavedMsg && (
                  <div className="text-xs font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1.5 rounded-xl border border-[rgba(112,185,245,0.25)] flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4" />
                    <span>{seriesSavedMsg}</span>
                  </div>
                )}

                {/* Grid for Numbering Configuration */}
                {(() => {
                  const displayStartingNo =
                    selectedSeries.numberPadding && selectedSeries.numberPadding > 0
                      ? String(selectedSeries.nextNumber ?? 1).padStart(selectedSeries.numberPadding, '0')
                      : String(selectedSeries.nextNumber ?? 1);

                  const liveVoucherNo = voucherSeriesService.formatVoucherNumber(
                    selectedSeries,
                    fiscalYearShort,
                    selectedSeries.nextNumber
                  );

                  const isDefaultPattern = selectedSeries.useDefaultPattern !== false;

                  return (
                    <div className="space-y-3">
                      {/* DEFAULT Button & Pattern Mode Indicator */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">
                              Series Numbering Pattern:
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                                isDefaultPattern
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {isDefaultPattern ? 'DEFAULT PATTERN (ON)' : 'CUSTOM PATTERN (OFF)'}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[#7F98AE]">
                            {isDefaultPattern ? (
                              <span>
                                💡 <strong className="text-[#2588E8]">Default button is ON:</strong> Saari Default series me same prefix, suffix, start no & digits share honge.
                              </span>
                            ) : (
                              <span>
                                ⚡ <strong className="text-amber-400">Default button is OFF:</strong> Is series ({selectedSeries.seriesName}) ke lie custom prefix, suffix, start no & digits set kar sakte hain.
                              </span>
                            )}
                          </p>
                        </div>

                        {/* DEFAULT Toggle Button */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleDefaultPattern(selectedSeries.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm border ${
                              isDefaultPattern
                                ? 'bg-[#2588E8] text-[#FFFFFF] border-[#2588E8] hover:bg-[#39A7FF]'
                                : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(37, 136, 232, 0.12)] border-[rgba(112,185,245,0.25)]'
                            }`}
                            title="Toggle between shared default pattern and custom independent pattern"
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isDefaultPattern ? 'bg-[#FFFFFF]' : 'bg-gray-400'
                              }`}
                            />
                            <span>DEFAULT: {isDefaultPattern ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-start">
                        {/* Prefix */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1.5 h-4 flex items-center">
                            Prefix
                          </label>
                          <input
                            type="text"
                            value={selectedSeries.prefix}
                            onChange={(e) =>
                              handleUpdateSeriesField(selectedSeries.id, 'prefix', e.target.value.toUpperCase())
                            }
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] font-mono font-bold focus:outline-hidden focus:border-[#2588E8] h-[36px]"
                          />
                          {/* Live Preview directly below Prefix field in a single line */}
                          <div className="mt-2 px-2.5 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl shadow-xs flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2588E8] inline-block animate-pulse shrink-0"></span>
                            <span className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider whitespace-nowrap">
                              Preview :
                            </span>
                            <span className="font-mono text-xs font-bold text-[#2588E8] tracking-wider break-all">
                              {liveVoucherNo}
                            </span>
                          </div>
                        </div>

                        {/* Suffix */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1.5 h-4 flex items-center">
                            Suffix
                          </label>
                          <input
                            type="text"
                            value={selectedSeries.suffix}
                            onChange={(e) =>
                              handleUpdateSeriesField(selectedSeries.id, 'suffix', e.target.value)
                            }
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] font-mono focus:outline-hidden focus:border-[#2588E8] h-[36px]"
                          />
                        </div>

                        {/* Starting No. */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1.5 h-4 flex items-center">
                            Starting No.
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={isStartingNoFocused ? startingNoInput : displayStartingNo}
                            onFocus={() => {
                              setIsStartingNoFocused(true);
                              setStartingNoInput(String(selectedSeries.nextNumber ?? 1));
                            }}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              setStartingNoInput(raw);
                              const val = parseInt(raw || '1', 10);
                              handleUpdateSeriesField(selectedSeries.id, 'nextNumber', val);
                            }}
                            onBlur={() => {
                              setIsStartingNoFocused(false);
                            }}
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#2588E8] font-mono font-bold focus:outline-hidden focus:border-[#2588E8] h-[36px]"
                          />
                        </div>

                        {/* Digits */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1.5 h-4 flex items-center">
                            Digits
                          </label>
                          <select
                            value={selectedSeries.numberPadding ?? 4}
                            onChange={(e) =>
                              handleUpdateSeriesField(selectedSeries.id, 'numberPadding', Number(e.target.value))
                            }
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] font-mono focus:outline-hidden focus:border-[#2588E8] h-[36px] cursor-pointer"
                          >
                            <option value="0">0 (No Zero Padding)</option>
                            <option value="1">1 Digit (e.g. 1)</option>
                            <option value="2">2 Digits (e.g. 01)</option>
                            <option value="3">3 Digits (e.g. 001)</option>
                            <option value="4">4 Digits (e.g. 0001)</option>
                            <option value="5">5 Digits (e.g. 00001)</option>
                            <option value="6">6 Digits (e.g. 000001)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Section for Series-wise Fixed Debit & Credit Account Ledgers */}
                {(() => {
                  const currentDrList: string[] =
                    selectedSeries.defaultDrLedgerIds && selectedSeries.defaultDrLedgerIds.length > 0
                      ? selectedSeries.defaultDrLedgerIds
                      : selectedSeries.defaultDrLedgerId
                      ? [selectedSeries.defaultDrLedgerId]
                      : [''];

                  const currentCrList: string[] =
                    selectedSeries.defaultCrLedgerIds && selectedSeries.defaultCrLedgerIds.length > 0
                      ? selectedSeries.defaultCrLedgerIds
                      : selectedSeries.defaultCrLedgerId
                      ? [selectedSeries.defaultCrLedgerId]
                      : [''];

                  const hasFixedActive =
                    currentDrList.some(Boolean) ||
                    currentCrList.some(Boolean) ||
                    Boolean(selectedSeries.defaultDrLedgerId) ||
                    Boolean(selectedSeries.defaultCrLedgerId);

                  return (
                    <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3.5 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2588E8] uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5 text-[#2588E8]" />
                          <span>Series-wise Fixed Account Ledgers (Auto Pre-fill on Voucher Entry)</span>
                        </div>
                        {hasFixedActive && (
                          <span className="text-[10px] text-[#2588E8] font-mono font-semibold">
                            ✓ Fixed Active
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Fixed Debit Ledger(s) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider">
                              Fixed Debit (Dr) Account Ledger(s):
                            </label>
                            {currentDrList.filter(Boolean).length > 0 && (
                              <span className="text-[9px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                                {currentDrList.filter(Boolean).length} selected
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {currentDrList.map((drLedgerId, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <select
                                  value={drLedgerId || ''}
                                  onChange={(e) => handleUpdateDrLedger(selectedSeries.id, idx, e.target.value)}
                                  className="flex-1 min-w-0 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1 text-xs text-[#FFFFFF] font-medium focus:outline-hidden focus:border-[#2588E8] h-[34px] cursor-pointer"
                                >
                                  <option value="">[ None - Manual Selection / Smart Default ]</option>
                                  {ledgers.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </select>

                                {idx === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAddDrLedger(selectedSeries.id)}
                                    className="h-[34px] w-[34px] shrink-0 bg-[rgba(57,167,255,0.15)] hover:bg-[#2588E8] hover:text-[#FFFFFF] text-[#2588E8] border border-[rgba(112,185,245,0.25)] rounded-xl flex items-center justify-center transition cursor-pointer"
                                    title="Add another Debit Ledger"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDrLedger(selectedSeries.id, idx)}
                                    className="h-[34px] w-[34px] shrink-0 bg-[#421d23] hover:bg-rose-600 hover:text-white text-[#fca5a5] border border-rose-800/40 rounded-xl flex items-center justify-center transition cursor-pointer"
                                    title="Remove this Debit Ledger"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <span className="text-[9px] text-[#7F98AE] mt-1 block">
                            Whenever this series is picked, Debit line(s) auto-fix to selected ledger(s).
                          </span>
                        </div>

                        {/* Fixed Credit Ledger(s) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider">
                              Fixed Credit (Cr) Account Ledger(s):
                            </label>
                            {currentCrList.filter(Boolean).length > 0 && (
                              <span className="text-[9px] font-mono text-[#2588E8] bg-[rgba(18,48,76,0.48)] px-1.5 py-0.5 rounded border border-[rgba(112,185,245,0.25)]">
                                {currentCrList.filter(Boolean).length} selected
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {currentCrList.map((crLedgerId, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <select
                                  value={crLedgerId || ''}
                                  onChange={(e) => handleUpdateCrLedger(selectedSeries.id, idx, e.target.value)}
                                  className="flex-1 min-w-0 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1 text-xs text-[#FFFFFF] font-medium focus:outline-hidden focus:border-[#2588E8] h-[34px] cursor-pointer"
                                >
                                  <option value="">[ None - Manual Selection / Smart Default ]</option>
                                  {ledgers.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </select>

                                {idx === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAddCrLedger(selectedSeries.id)}
                                    className="h-[34px] w-[34px] shrink-0 bg-[rgba(57,167,255,0.15)] hover:bg-[#2588E8] hover:text-[#FFFFFF] text-[#2588E8] border border-[rgba(112,185,245,0.25)] rounded-xl flex items-center justify-center transition cursor-pointer"
                                    title="Add another Credit Ledger"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCrLedger(selectedSeries.id, idx)}
                                    className="h-[34px] w-[34px] shrink-0 bg-[#421d23] hover:bg-rose-600 hover:text-white text-[#fca5a5] border border-rose-800/40 rounded-xl flex items-center justify-center transition cursor-pointer"
                                    title="Remove this Credit Ledger"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <span className="text-[9px] text-[#7F98AE] mt-1 block">
                            Whenever this series is picked, Credit line(s) auto-fix to selected ledger(s).
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-6 text-[#7F98AE]">
                No series available for this voucher type. Click "Add New Series" above.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#7F98AE]">
            <Info className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
            <span>
              Tip: Use token <code className="text-[#2588E8] font-mono font-bold">{'{FY}'}</code> in Suffix to auto-insert current financial year.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] text-xs font-semibold border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Apply Configurations</span>
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-[100001] bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#421d23] text-[#fca5a5] border border-rose-800/50 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#FFFFFF]">Reset {selectedTypeLabel} Settings?</h3>
                  <p className="text-xs text-[#7F98AE] mt-1">
                    This will restore prefix, suffix, starting number, digits, and series for <strong className="text-[#2588E8] font-semibold">{selectedTypeLabel}</strong> to factory defaults. Other voucher types will not be affected.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[rgba(112,185,245,0.25)]">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] text-xs font-semibold border border-[rgba(112,185,245,0.25)] cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performReset}
                  className="px-4 py-2 rounded-xl bg-[#421d23] hover:bg-[#5c242e] text-[#fca5a5] border border-rose-800/50 font-bold text-xs cursor-pointer shadow-md transition"
                >
                  Yes, Reset {selectedTypeLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
