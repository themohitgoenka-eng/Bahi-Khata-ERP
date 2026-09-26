import React, { useState, useEffect, useMemo } from 'react';
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
  Receipt,
  Sparkles,
  ArrowRight,
  BookOpen,
  Edit2,
} from 'lucide-react';
import { VoucherSeriesConfig, Ledger, SeriesBillSundryConfig } from '../../types';
import { voucherSeriesService } from '../../services/voucherSeriesService';
import { db } from '../../db';

interface SalesSeriesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYearShort: string;
  ledgers: Ledger[];
  onSeriesConfigUpdated: (activeSeriesName?: string) => void;
  focusSeriesName?: string;
}

export const SalesSeriesSettingsModal: React.FC<SalesSeriesSettingsModalProps> = ({
  isOpen,
  onClose,
  fiscalYearShort,
  ledgers,
  onSeriesConfigUpdated,
  focusSeriesName,
}) => {
  const [allConfigs, setAllConfigs] = useState<VoucherSeriesConfig[]>(() =>
    voucherSeriesService.getStoredSeriesConfigs()
  );

  // Sales series only
  const salesSeriesList = useMemo(() => {
    return allConfigs.filter((c) => c.voucherType === 'SALES');
  }, [allConfigs]);

  // Selected series ID
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(() => {
    const list = voucherSeriesService.getSeriesForVoucherType('SALES');
    if (focusSeriesName) {
      const match = list.find((s) => s.seriesName.toLowerCase() === focusSeriesName.toLowerCase());
      if (match) return match.id;
    }
    const def = list.find((c) => c.isDefault) || list[0];
    return def?.id || '';
  });

  // Selected config object
  const activeConfig = useMemo(() => {
    return salesSeriesList.find((c) => c.id === selectedSeriesId) || salesSeriesList[0];
  }, [salesSeriesList, selectedSeriesId]);

  // Form states for active config
  const [seriesName, setSeriesName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [nextNumber, setNextNumber] = useState<number>(1001);
  const [numberPadding, setNumberPadding] = useState<number>(4);
  const [useDefaultPattern, setUseDefaultPattern] = useState<boolean>(true);
  const [defaultSundries, setDefaultSundries] = useState<SeriesBillSundryConfig[]>([]);

  // State for new series creation dialog
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [newSeriesNameInput, setNewSeriesNameInput] = useState('');
  const [newSeriesPrefixInput, setNewSeriesPrefixInput] = useState('');

  // Track which sundry row is in custom text mode (if not selecting from dropdown)
  const [customTextRows, setCustomTextRows] = useState<{ [index: number]: boolean }>({});

  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Sync state when activeConfig changes
  useEffect(() => {
    if (activeConfig) {
      setSeriesName(activeConfig.seriesName);
      setPrefix(activeConfig.prefix || '');
      setSuffix(activeConfig.suffix || '');
      setNextNumber(Number(activeConfig.nextNumber) || 1001);
      setNumberPadding(activeConfig.numberPadding !== undefined ? activeConfig.numberPadding : 4);
      setUseDefaultPattern(activeConfig.useDefaultPattern !== false);
      setDefaultSundries(activeConfig.defaultSundries || []);
      setCustomTextRows({});
    }
  }, [activeConfig?.id]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If an inner dropdown is open, let it close first
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

  // Helper to get preview
  const previewVoucherNumber = useMemo(() => {
    if (!activeConfig) return '';
    const tempConfig: VoucherSeriesConfig = {
      ...activeConfig,
      seriesName,
      prefix,
      suffix,
      nextNumber,
      numberPadding,
    };
    return voucherSeriesService.formatVoucherNumber(tempConfig, fiscalYearShort, nextNumber);
  }, [activeConfig, seriesName, prefix, suffix, nextNumber, numberPadding, fiscalYearShort]);

  // Categorized Ledgers for Bill Sundries
  const taxLedgers = useMemo(() => {
    return ledgers.filter(
      (l) =>
        l.groupId === 'grp-duties-taxes' ||
        l.accountType === 'LIABILITY' ||
        l.name.toUpperCase().includes('GST') ||
        l.name.toUpperCase().includes('TAX') ||
        l.name.toUpperCase().includes('TCS') ||
        l.name.toUpperCase().includes('TDS')
    );
  }, [ledgers]);

  const expenseAndChargesLedgers = useMemo(() => {
    return ledgers.filter(
      (l) =>
        (l.accountType === 'DIRECT_EXPENSE' ||
          l.accountType === 'INDIRECT_EXPENSE' ||
          l.name.toUpperCase().includes('FREIGHT') ||
          l.name.toUpperCase().includes('CARTAGE') ||
          l.name.toUpperCase().includes('LOADING') ||
          l.name.toUpperCase().includes('PACKING') ||
          l.name.toUpperCase().includes('DISCOUNT') ||
          l.name.toUpperCase().includes('ROUND') ||
          l.name.toUpperCase().includes('INSURANCE') ||
          l.name.toUpperCase().includes('COMMISSION')) &&
        !taxLedgers.some((t) => t.id === l.id)
    );
  }, [ledgers, taxLedgers]);

  const otherLedgers = useMemo(() => {
    const existingIds = new Set([...taxLedgers.map((l) => l.id), ...expenseAndChargesLedgers.map((l) => l.id)]);
    return ledgers.filter((l) => !existingIds.has(l.id));
  }, [ledgers, taxLedgers, expenseAndChargesLedgers]);

  // Predefined standard sundry options if ledgers don't have them yet
  const standardSundryPresets = [
    { name: 'CGST 9%', amount: 9, type: 'ADD' as const, isPercentage: true },
    { name: 'SGST 9%', amount: 9, type: 'ADD' as const, isPercentage: true },
    { name: 'IGST 18%', amount: 18, type: 'ADD' as const, isPercentage: true },
    { name: 'FREIGHT / TRANSPORT CHARGES', amount: 0, type: 'ADD' as const, isPercentage: false },
    { name: 'DISCOUNT', amount: 0, type: 'SUBTRACT' as const, isPercentage: false },
    { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS' as const, isPercentage: false },
  ];

  // Quick add sundry preset
  const handleAddPresetSundry = (preset: { name: string; amount: number; type: 'ADD' | 'SUBTRACT' | 'ADD_LESS'; isPercentage: boolean }) => {
    if (defaultSundries.some((s) => s.name.toUpperCase() === preset.name.toUpperCase())) {
      showNotification(`${preset.name} is already in the list`, 'info');
      return;
    }
    setDefaultSundries((prev) => [...prev, { ...preset }]);
    showNotification(`Added ${preset.name} to series default bill sundries`, 'success');
  };

  // Add custom sundry row
  const handleAddNewSundryRow = () => {
    setDefaultSundries((prev) => [
      ...prev,
      {
        name: taxLedgers[0]?.name || 'CGST 9%',
        amount: 9,
        type: 'ADD',
        isPercentage: true,
      },
    ]);
  };

  // Remove sundry row
  const handleRemoveSundryRow = (idx: number) => {
    setDefaultSundries((prev) => prev.filter((_, i) => i !== idx));
  };

  // Update sundry row field
  const handleSundryChange = (idx: number, updates: Partial<SeriesBillSundryConfig>) => {
    setDefaultSundries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  // When an Account Ledger is chosen from dropdown
  const handleLedgerSelectForSundry = (idx: number, ledgerName: string) => {
    const upper = ledgerName.toUpperCase();
    let detectedType: 'ADD' | 'SUBTRACT' | 'ADD_LESS' = 'ADD';
    let isPercent = false;
    let defAmount = 0;

    if (upper.includes('DISCOUNT') || upper.includes('REBATE') || upper.includes('LESS')) {
      detectedType = 'SUBTRACT';
    } else if (upper.includes('ROUND')) {
      detectedType = 'ADD_LESS';
    } else if (upper.includes('9%')) {
      defAmount = 9;
      isPercent = true;
    } else if (upper.includes('18%')) {
      defAmount = 18;
      isPercent = true;
    } else if (upper.includes('28%')) {
      defAmount = 28;
      isPercent = true;
    } else if (upper.includes('5%')) {
      defAmount = 5;
      isPercent = true;
    } else if (upper.includes('12%')) {
      defAmount = 12;
      isPercent = true;
    }

    handleSundryChange(idx, {
      name: ledgerName,
      type: detectedType,
      isPercentage: isPercent,
      amount: defAmount > 0 ? defAmount : defaultSundries[idx]?.amount || 0,
    });
  };

  // Create new series
  const handleCreateNewSeries = () => {
    const trimmed = newSeriesNameInput.trim().toUpperCase();
    if (!trimmed) {
      showNotification('Please enter a series name', 'error');
      return;
    }
    if (salesSeriesList.some((s) => s.seriesName.toUpperCase() === trimmed)) {
      showNotification(`Series '${trimmed}' already exists for Sales`, 'error');
      return;
    }

    const created = voucherSeriesService.createSeries(
      'SALES',
      trimmed,
      newSeriesPrefixInput.trim() ? newSeriesPrefixInput.trim() : `${trimmed.slice(0, 3)}/`,
      '/{FY}',
      1001,
      4
    );

    const fresh = voucherSeriesService.getStoredSeriesConfigs();
    setAllConfigs(fresh);
    setSelectedSeriesId(created.id);
    setIsCreatingSeries(false);
    setNewSeriesNameInput('');
    setNewSeriesPrefixInput('');
    showNotification(`Sales Series '${trimmed}' created successfully!`, 'success');
  };

  // Delete series
  const handleDeleteSeries = (id: string, name: string) => {
    if (salesSeriesList.length <= 1) {
      showNotification('Cannot delete the only remaining Sales series', 'error');
      return;
    }
    const target = salesSeriesList.find((s) => s.id === id);
    if (target?.isDefault) {
      showNotification('Cannot delete the default Sales series. Set another series as default first.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Sales Series '${name}'?`)) {
      return;
    }

    const updated = voucherSeriesService.deleteSeries(id);
    setAllConfigs(updated);
    const nextSeries = updated.filter((s) => s.voucherType === 'SALES')[0];
    if (nextSeries) {
      setSelectedSeriesId(nextSeries.id);
    }
    showNotification(`Sales Series '${name}' deleted`, 'info');
  };

  // Set default series
  const handleSetDefaultSeries = (id: string) => {
    const updated = voucherSeriesService.setDefaultSeries(id);
    setAllConfigs(updated);
    showNotification('Set as default Sales series', 'success');
  };

  // Save current series configuration
  const handleSaveCurrentConfig = async () => {
    if (!activeConfig) return;

    const trimmedName = seriesName.trim().toUpperCase() || activeConfig.seriesName;

    // Check duplicate name if renamed
    if (
      trimmedName !== activeConfig.seriesName &&
      salesSeriesList.some((s) => s.id !== activeConfig.id && s.seriesName.toUpperCase() === trimmedName)
    ) {
      showNotification(`Another Sales series named '${trimmedName}' already exists`, 'error');
      return;
    }

    const updatedConfig: VoucherSeriesConfig = {
      ...activeConfig,
      seriesName: trimmedName,
      prefix: prefix.trim(),
      suffix: suffix.trim(),
      nextNumber: Number(nextNumber) || 1001,
      numberPadding: Number(numberPadding) || 4,
      useDefaultPattern: useDefaultPattern,
      defaultSundries: defaultSundries,
    };

    const savedList = voucherSeriesService.saveSeriesConfig(updatedConfig);
    setAllConfigs(savedList);

    // If DEFAULT toggle is ON, optionally sync standard prefix to other default series if needed
    if (useDefaultPattern) {
      voucherSeriesService.syncDefaultPatternForVoucherType('SALES', prefix.trim(), suffix.trim(), Number(numberPadding) || 4);
      setAllConfigs(voucherSeriesService.getStoredSeriesConfigs());
    }

    // Also sync to Dexie IndexedDB seriesList for maximum cross-module consistency
    try {
      await db.seriesList.put({
        name: trimmedName,
        prefix: prefix.trim(),
        seriesType: 'sales',
        sundries: defaultSundries.map((s) => ({
          name: s.name,
          defaultAmount: Number(s.amount) || 0,
          type: s.type,
          isPercentage: s.isPercentage,
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Sync to db.seriesList failed:', err);
    }

    showNotification(`Sales Series '${trimmedName}' saved successfully!`, 'success');
    onSeriesConfigUpdated(trimmedName);
  };

  // Reset to factory defaults for Sales
  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Reset Sales Series to default configuration (MAIN, GST SALES, RETAIL)? Any custom sales series will be restored to defaults.'
      )
    ) {
      const resetList = voucherSeriesService.resetToFactoryDefaults();
      setAllConfigs(resetList);
      const defSales = resetList.filter((s) => s.voucherType === 'SALES').find((s) => s.isDefault);
      if (defSales) {
        setSelectedSeriesId(defSales.id);
      }
      showNotification('Sales Series reset to standard defaults', 'info');
      onSeriesConfigUpdated('MAIN');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      id="sales_series_settings_backdrop"
      className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="sales_series_settings_modal"
        className="bg-[#121214] border border-white/15 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-100"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#18181B]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Sales Series &amp; Invoicing Settings
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  SALES ONLY
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure Sales series prefix, suffix, starting number, digits and default bill sundries (Taxes, Freight, Round-off)
              </p>
            </div>
          </div>
          <button
            type="button"
            id="sales_series_settings_close_btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NOTIFICATION TOAST */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
              notification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{notification.text}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MAIN BODY: 2 COLUMNS (LEFT: SALES SERIES LIST, RIGHT: ACTIVE SERIES CONFIGURATION) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* LEFT SIDEBAR: SALES SERIES LIST */}
          <div className="md:col-span-4 bg-[#141417] p-4 flex flex-col justify-between overflow-y-auto max-h-[75vh]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Sales Series
                  </span>
                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-white/10 text-gray-300 font-mono">
                    {salesSeriesList.length}
                  </span>
                </div>
                {!isCreatingSeries && (
                  <button
                    type="button"
                    id="sales_add_series_btn"
                    onClick={() => setIsCreatingSeries(true)}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Series</span>
                  </button>
                )}
              </div>

              {/* Quick Create Series Form */}
              {isCreatingSeries && (
                <div className="p-3 bg-[#1F1F24] border border-amber-500/30 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Sales Series
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSeries(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      Series Name *
                    </label>
                    <input
                      type="text"
                      id="sales_new_series_name_input"
                      placeholder="e.g. WHOLESALE, EXPORT, BRANCH"
                      value={newSeriesNameInput}
                      onChange={(e) => setNewSeriesNameInput(e.target.value.toUpperCase())}
                      className="w-full bg-[#121214] border border-white/15 rounded px-2 py-1 text-xs text-white focus:border-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      Bill Prefix (Optional)
                    </label>
                    <input
                      type="text"
                      id="sales_new_series_prefix_input"
                      placeholder="e.g. WS/ or EXP/"
                      value={newSeriesPrefixInput}
                      onChange={(e) => setNewSeriesPrefixInput(e.target.value.toUpperCase())}
                      className="w-full bg-[#121214] border border-white/15 rounded px-2 py-1 text-xs text-white focus:border-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSeries(false)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="sales_confirm_add_series_btn"
                      onClick={handleCreateNewSeries}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs cursor-pointer shadow-xs"
                    >
                      Create Series
                    </button>
                  </div>
                </div>
              )}

              {/* Sales Series Cards */}
              <div className="space-y-1.5">
                {salesSeriesList.map((series) => {
                  const isSelected = series.id === selectedSeriesId;
                  const isDefaultSeries = series.isDefault;
                  const preview = voucherSeriesService.formatVoucherNumber(
                    series,
                    fiscalYearShort,
                    series.nextNumber
                  );

                  return (
                    <div
                      key={series.id}
                      onClick={() => setSelectedSeriesId(series.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-sm'
                          : 'bg-[#19191D] hover:bg-[#202026] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {series.seriesName}
                          </span>
                          {isDefaultSeries && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              DEFAULT
                            </span>
                          )}
                          {series.useDefaultPattern === false ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              CUSTOM
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-400 bg-white/5 border border-white/10">
                              SHARED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {!isDefaultSeries && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultSeries(series.id)}
                              title="Set as Default Series"
                              className="text-[10px] text-gray-400 hover:text-amber-300 px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded transition"
                            >
                              Make Default
                            </button>
                          )}
                          {!isDefaultSeries && salesSeriesList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSeries(series.id, series.seriesName)}
                              title="Delete this series"
                              className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>Format: {series.prefix}####{series.suffix}</span>
                        <span className="text-amber-400 font-semibold">{preview}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Series Info */}
            <div className="pt-3 border-t border-white/10 text-[11px] text-gray-400 space-y-1">
              <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Sales Invoicing Tip</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Sales invoices automatically adopt the selected series bill number format. In Sales, party accounts are chosen on the invoice directly.
              </p>
            </div>
          </div>

          {/* RIGHT PANEL: CONFIGURATION FOR ACTIVE SALES SERIES */}
          <div className="md:col-span-8 bg-[#121214] p-5 overflow-y-auto max-h-[75vh] space-y-5">
            {activeConfig ? (
              <>
                {/* TOP BAR: SERIES NAME & DEFAULT TOGGLE */}
                <div className="bg-[#18181C] p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] uppercase font-bold text-gray-400 mb-1">
                        Series Name
                      </label>
                      <input
                        type="text"
                        id="sales_active_series_name"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value.toUpperCase())}
                        className="w-full sm:w-64 bg-[#202024] border border-white/15 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>

                    {/* DEFAULT PATTERN TOGGLE */}
                    <div className="flex items-center gap-2 bg-[#202024] p-2 rounded-lg border border-white/10">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">Default Pattern</span>
                        <span className="text-[10px] text-gray-400">
                          {useDefaultPattern ? 'Shared (Standard)' : 'Custom (Independent)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        id="sales_series_default_toggle_btn"
                        onClick={() => setUseDefaultPattern(!useDefaultPattern)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          useDefaultPattern
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
                        }`}
                      >
                        {useDefaultPattern ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>DEFAULT: ON</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>CUSTOM: ON</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    {useDefaultPattern
                      ? '✓ Default ON: This series adheres to standard company sales numbering pattern and syncs changes.'
                      : '★ Custom ON: This series uses an independent numbering scheme decoupled from default series.'}
                  </p>
                </div>

                {/* NUMBERING PATTERN & PREVIEW */}
                <div className="bg-[#18181C] p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-amber-400" />
                      <span>Numbering Pattern &amp; Formatting</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      FY token: <code className="text-amber-300 font-bold">{'{FY}'}</code> = {fiscalYearShort}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* PREFIX */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Prefix
                      </label>
                      <input
                        type="text"
                        id="sales_series_prefix_input"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. INV/ or SAL/"
                        className="w-full bg-[#202024] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>

                    {/* SUFFIX */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Suffix
                      </label>
                      <input
                        type="text"
                        id="sales_series_suffix_input"
                        value={suffix}
                        onChange={(e) => setSuffix(e.target.value)}
                        placeholder="e.g. /{FY}"
                        className="w-full bg-[#202024] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>

                    {/* STARTING / NEXT NO */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Starting / Next No
                      </label>
                      <input
                        type="number"
                        id="sales_series_next_number_input"
                        value={nextNumber}
                        onChange={(e) => setNextNumber(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#202024] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>

                    {/* NUMBER DIGITS */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Digits (Padding)
                      </label>
                      <select
                        id="sales_series_padding_select"
                        value={numberPadding}
                        onChange={(e) => setNumberPadding(parseInt(e.target.value) || 4)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2 py-1.5 text-xs text-white focus:border-[#2588E8] focus:outline-hidden cursor-pointer"
                      >
                        <option value={1}>1 (e.g. 1, 10, 100)</option>
                        <option value={2}>2 (e.g. 01, 10)</option>
                        <option value={3}>3 (e.g. 001, 100)</option>
                        <option value={4}>4 (e.g. 0001, 1001)</option>
                        <option value={5}>5 (e.g. 00001, 10001)</option>
                        <option value={6}>6 (e.g. 000001)</option>
                      </select>
                    </div>
                  </div>

                  {/* LIVE PREVIEW CARD */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-[#202026] to-[#18181C] border border-amber-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        Live Generated Bill Number Preview
                      </span>
                      <span className="text-lg font-mono font-extrabold text-white mt-0.5 tracking-wide block">
                        {previewVoucherNumber}
                      </span>
                    </div>
                    <div className="text-right text-[10px] text-gray-400 font-mono">
                      <span>[{prefix || '∅'}]</span> + <span>[{String(nextNumber).padStart(numberPadding, '0')}]</span> + <span>[{suffix ? suffix.replace('{FY}', fiscalYearShort) : '∅'}]</span>
                    </div>
                  </div>
                </div>

                {/* SERIES-WISE DEFAULT BILL SUNDRIES WITH ACCOUNT LEDGER DROPDOWN */}
                <div className="bg-[#18181C] p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <span>Default Bill Sundries for Series: {seriesName}</span>
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Select from Company Account Ledgers. When this series is picked in Sales Invoice, these sundries load automatically.
                      </p>
                    </div>

                    <button
                      type="button"
                      id="sales_add_sundry_row_btn"
                      onClick={handleAddNewSundryRow}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Bill Sundry</span>
                    </button>
                  </div>

                  {/* QUICK ADD PRESETS */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold mr-1">Quick Add:</span>
                    {standardSundryPresets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleAddPresetSundry(preset)}
                        className="px-2 py-0.5 bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 rounded text-[10px] font-semibold transition cursor-pointer"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>

                  {/* SUNDRY ROWS WITH ACCOUNT LEDGER DROPDOWN */}
                  <div className="space-y-2 mt-2">
                    {defaultSundries.length === 0 ? (
                      <div className="p-4 rounded-lg bg-[#202024] border border-dashed border-white/15 text-center text-gray-400 text-xs">
                        No default bill sundries added for this series yet. Click &quot;Add Bill Sundry&quot; or select a Quick Add preset above.
                      </div>
                    ) : (
                      defaultSundries.map((sundry, sIdx) => {
                        const isCustomMode = customTextRows[sIdx];

                        return (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-lg bg-[#202024] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs"
                          >
                            {/* ACCOUNT LEDGER DROPDOWN OR CUSTOM INPUT */}
                            <div className="flex-1 w-full sm:w-auto flex items-center gap-1.5">
                              {isCustomMode ? (
                                <input
                                  type="text"
                                  value={sundry.name}
                                  onChange={(e) => handleSundryChange(sIdx, { name: e.target.value })}
                                  placeholder="Type Custom Sundry Name..."
                                  className="w-full bg-[#141417] border border-white/15 rounded px-2.5 py-1 text-white text-xs focus:border-amber-500 focus:outline-hidden"
                                />
                              ) : (
                                <select
                                  value={sundry.name}
                                  onChange={(e) => {
                                    if (e.target.value === '__CUSTOM__') {
                                      setCustomTextRows((prev) => ({ ...prev, [sIdx]: true }));
                                    } else {
                                      handleLedgerSelectForSundry(sIdx, e.target.value);
                                    }
                                  }}
                                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2.5 py-1 text-white text-xs focus:border-[#2588E8] focus:outline-hidden cursor-pointer"
                                >
                                  <option value="">-- Select Account Ledger --</option>

                                  {/* Custom current value if not in standard list */}
                                  {sundry.name &&
                                    !taxLedgers.some((l) => l.name === sundry.name) &&
                                    !expenseAndChargesLedgers.some((l) => l.name === sundry.name) &&
                                    !otherLedgers.some((l) => l.name === sundry.name) && (
                                      <option value={sundry.name}>{sundry.name}</option>
                                    )}

                                  {/* DUTIES & TAXES / GST */}
                                  <optgroup label="Duties & Taxes (GST)">
                                    {taxLedgers.length > 0 ? (
                                      taxLedgers.map((l) => (
                                        <option key={l.id} value={l.name}>
                                          {l.name}
                                        </option>
                                      ))
                                    ) : (
                                      <>
                                        <option value="CGST 9%">CGST 9%</option>
                                        <option value="SGST 9%">SGST 9%</option>
                                        <option value="IGST 18%">IGST 18%</option>
                                      </>
                                    )}
                                  </optgroup>

                                  {/* EXPENSES & CHARGES */}
                                  <optgroup label="Direct / Indirect Expenses & Charges">
                                    <option value="FREIGHT / TRANSPORT CHARGES">FREIGHT / TRANSPORT CHARGES</option>
                                    <option value="LOADING & PACKING CHARGES">LOADING & PACKING CHARGES</option>
                                    <option value="INSURANCE CHARGES">INSURANCE CHARGES</option>
                                    <option value="DISCOUNT">DISCOUNT</option>
                                    <option value="ROUND OFF">ROUND OFF</option>
                                    {expenseAndChargesLedgers.map((l) => (
                                      <option key={l.id} value={l.name}>
                                        {l.name}
                                      </option>
                                    ))}
                                  </optgroup>

                                  {/* ALL OTHER ACCOUNT LEDGERS */}
                                  {otherLedgers.length > 0 && (
                                    <optgroup label="All Company Ledgers">
                                      {otherLedgers.map((l) => (
                                        <option key={l.id} value={l.name}>
                                          {l.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}

                                  <option value="__CUSTOM__">+ Type Custom Name...</option>
                                </select>
                              )}

                              {/* Toggle between dropdown & custom text */}
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomTextRows((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                                }
                                title={isCustomMode ? 'Switch to Ledger Dropdown' : 'Switch to Custom Name'}
                                className="p-1 text-gray-400 hover:text-amber-300 hover:bg-white/10 rounded transition cursor-pointer shrink-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* TYPE SELECTOR */}
                            <select
                              value={sundry.type || 'ADD'}
                              onChange={(e) =>
                                handleSundryChange(sIdx, {
                                  type: e.target.value as 'ADD' | 'SUBTRACT' | 'ADD_LESS',
                                })
                              }
                              className="bg-[#141417] border border-white/15 rounded px-2 py-1 text-xs text-gray-200 cursor-pointer"
                            >
                              <option value="ADD">+ Add to Bill</option>
                              <option value="SUBTRACT">- Less / Subtract</option>
                              <option value="ADD_LESS">± Add / Less (Round-off)</option>
                            </select>

                            {/* RATE / AMOUNT */}
                            <div className="flex items-center gap-1 w-28">
                              <input
                                type="number"
                                value={sundry.amount}
                                onChange={(e) =>
                                  handleSundryChange(sIdx, {
                                    amount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                placeholder="0"
                                className="w-16 bg-[#141417] border border-white/15 rounded px-2 py-1 text-right text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSundryChange(sIdx, {
                                    isPercentage: !sundry.isPercentage,
                                  })
                                }
                                title="Toggle Percentage / Fixed Amount"
                                className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                  sundry.isPercentage
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-white/5 text-gray-400 border border-white/10'
                                }`}
                              >
                                {sundry.isPercentage ? '%' : '₹'}
                              </button>
                            </div>

                            {/* DELETE BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleRemoveSundryRow(sIdx)}
                              className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                              title="Remove Sundry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                Please select or create a Sales series from the left sidebar.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#18181B] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            id="sales_series_reset_defaults_btn"
            onClick={handleResetDefaults}
            className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Sales Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="sales_series_settings_cancel_btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="sales_series_settings_save_btn"
              onClick={handleSaveCurrentConfig}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/30"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
