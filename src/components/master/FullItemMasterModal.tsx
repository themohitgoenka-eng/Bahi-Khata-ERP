import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { InventoryItem, ItemLocationBalance, ItemUnit } from '../../types';
import { inventoryEngine } from '../../services/inventoryEngine';
import {
  Boxes,
  X,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  MapPin,
  Calculator,
  Save,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { FullUnitMasterModal } from './FullUnitMasterModal';
import { FullLedgerMasterModal } from './FullLedgerMasterModal';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullItemMasterModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (createdItem: InventoryItem) => void;
}

const BASE_CATEGORIES = [
  'Kota Stone',
  'Granite Slabs',
  'Marble Slabs',
  'Sandstone',
  'Raw Material Blocks',
  'Finished Tiles',
];

export const FullItemMasterModal: React.FC<FullItemMasterModalProps> = ({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}) => {
  const {
    currentCompany,
    inventoryItems,
    ledgers,
    locations,
    showNotification,
    refreshActiveData,
  } = useApp();

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState(initialName);
  const [taxPercent, setTaxPercent] = useState<number | string>(() => {
    try {
      const last = localStorage.getItem('bahi_khata_last_item_tax');
      return last !== null && last !== '' ? last : '18';
    } catch {
      return '18';
    }
  });
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [salesAc, setSalesAc] = useState('');
  const [purchaseAc, setPurchaseAc] = useState('');
  const [primaryUnit, setPrimaryUnit] = useState('SQFT');
  const [alternateUnit, setAlternateUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState<number | string>('');
  const [conversionDirection, setConversionDirection] = useState<'PRIMARY_TO_ALT' | 'ALT_TO_PRIMARY'>('PRIMARY_TO_ALT');
  const [decimalPlaces, setDecimalPlaces] = useState<number | string>('2');
  const [locationRows, setLocationRows] = useState<
    { id: string; locationId: string; qty: number | string; rate: number | string; amount: number | string }[]
  >([{ id: '1', locationId: '', qty: '', rate: '', amount: '' }]);
  const [valuationMethod, setValuationMethod] = useState<'FIFO' | 'WEIGHTED_AVG' | 'MOVING_AVG' | ''>('WEIGHTED_AVG');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-modals for inline "+ Add"
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitTarget, setUnitTarget] = useState<'primary' | 'alternate'>('primary');
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerTarget, setLedgerTarget] = useState<'sales' | 'purchase'>('sales');

  // Loaded DB units
  const [dbUnits, setDbUnits] = useState<ItemUnit[]>([]);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen: isOpen && !isUnitModalOpen && !isLedgerModalOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!name.trim()) {
      showNotification('Data is needed in "Item Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => nameInputRef.current?.focus(), 80);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  // Load units & initialize form on open
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setCode(`ITM-${Math.floor(1000 + Math.random() * 9000)}`);
      try {
        const lastTax = localStorage.getItem('bahi_khata_last_item_tax');
        setTaxPercent(lastTax !== null && lastTax !== '' ? lastTax : '18');
      } catch {
        setTaxPercent('18');
      }
      setCategory('');
      setCustomCategory('');
      setSalesAc('');
      setPurchaseAc('');
      setPrimaryUnit('SQFT');
      setAlternateUnit('');
      setConversionFactor('');
      setConversionDirection('PRIMARY_TO_ALT');
      setDecimalPlaces('2');
      setValuationMethod('WEIGHTED_AVG');
      setIsActive(true);
      setIsSubmitting(false);

      if (locations.length > 0) {
        const defaultLoc = locations.find((l) => l.isDefault)?.id || locations[0].id;
        setLocationRows([{ id: '1', locationId: defaultLoc, qty: '', rate: '', amount: '' }]);
      } else {
        setLocationRows([{ id: '1', locationId: '', qty: '', rate: '', amount: '' }]);
      }

      dbStorage.getItemUnits().then((u) => {
        if (u && u.length > 0) setDbUnits(u);
      }).catch(console.error);

      const t1 = setTimeout(() => {
        const sel = categorySelectRef.current;
        if (sel) {
          try {
            // Chromium/modern browsers: programmatically open the native dropdown
            (sel as any).showPicker?.();
            sel.focus();
          } catch {
            sel.focus();
          }
        } else {
          nameInputRef.current?.focus();
        }
      }, 120);
      const t2 = setTimeout(() => {
        const sel = categorySelectRef.current;
        if (sel && document.activeElement !== sel) {
          try {
            (sel as any).showPicker?.();
            sel.focus();
          } catch {
            sel.focus();
          }
        }
      }, 260);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen, initialName, locations]);

  // Categories list
  const categories = useMemo(() => {
    let savedCustom: string[] = [];
    try {
      const saved = localStorage.getItem('bahi_khata_item_categories');
      if (saved) savedCustom = JSON.parse(saved);
    } catch {
      // ignore
    }
    return Array.from(
      new Set([
        ...BASE_CATEGORIES,
        ...inventoryItems.map((i) => i.category || '').filter(Boolean),
        ...savedCustom,
      ])
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [inventoryItems]);

  // Ledger Options
  const salesLedgerOptions = useMemo(() => {
    const list = [
      'GST Sales 18%',
      'GST Sales 12%',
      'GST Sales 5%',
      'Kota Stone Sales A/c',
      'Marble Sales A/c',
      'Granite Sales A/c',
      'Interstate Sales (IGST 18%)',
      'Nil-Rated / Exempted Sales',
    ];
    ledgers.forEach((l) => {
      if (l.accountType === 'DIRECT_INCOME' || l.accountType === 'INDIRECT_INCOME' || l.name.toLowerCase().includes('sale')) {
        if (!list.includes(l.name)) list.push(l.name);
      }
    });
    return list;
  }, [ledgers]);

  const purchaseLedgerOptions = useMemo(() => {
    const list = [
      'GST Purchase 18%',
      'GST Purchase 12%',
      'GST Purchase 5%',
      'Purchase Account',
      'Raw Blocks Purchase A/c',
      'Interstate Purchase A/c',
    ];
    ledgers.forEach((l) => {
      if (l.accountType === 'DIRECT_EXPENSES' || l.name.toLowerCase().includes('purchase')) {
        if (!list.includes(l.name)) list.push(l.name);
      }
    });
    return list;
  }, [ledgers]);

  // Measurement Units list
  const unitList = useMemo(() => {
    const base = ['SQFT', 'PCS', 'SQMT', 'TON', 'BOX', 'NOS', 'KG', 'LTR', 'MTR'];
    const loaded = dbUnits.map((u) => u.symbol.toUpperCase());
    return Array.from(new Set([...base, ...loaded]));
  }, [dbUnits]);

  // Location Rows Logic
  const handleLocationRowChange = (index: number, field: 'locationId' | 'qty' | 'rate' | 'amount', value: string) => {
    setLocationRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      const q = parseFloat(String(row.qty)) || 0;
      const r = parseFloat(String(row.rate)) || 0;
      const a = parseFloat(String(row.amount)) || 0;

      if (field === 'qty') {
        if (!isNaN(q) && !isNaN(r) && q > 0 && r > 0) {
          row.amount = Math.round(q * r * 100) / 100;
        } else if (!isNaN(q) && q > 0 && !isNaN(a) && a > 0) {
          row.rate = Math.round((a / q) * 100) / 100;
        }
      } else if (field === 'rate') {
        if (!isNaN(q) && !isNaN(r) && q > 0) {
          row.amount = Math.round(q * r * 100) / 100;
        }
      } else if (field === 'amount') {
        if (!isNaN(a) && !isNaN(q) && q > 0) {
          row.rate = Math.round((a / q) * 100) / 100;
        }
      }
      updated[index] = row;
      return updated;
    });
  };

  const addLocationRow = () => {
    const usedIds = locationRows.map((r) => r.locationId);
    const unusedLoc = locations.find((l) => !usedIds.includes(l.id));
    const nextLocId = unusedLoc?.id || locations.find((l) => l.isDefault)?.id || locations[0]?.id || '';
    const lastRate = locationRows[locationRows.length - 1]?.rate || '';

    setLocationRows((prev) => [
      ...prev,
      {
        id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
        locationId: nextLocId,
        qty: '',
        rate: lastRate,
        amount: '',
      },
    ]);
  };

  const removeLocationRow = (index: number) => {
    if (locationRows.length <= 1) {
      setLocationRows([{ id: '1', locationId: locations[0]?.id || '', qty: '', rate: '', amount: '' }]);
      return;
    }
    setLocationRows((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const cleanName = name.trim();
  const isDuplicate = Boolean(
    cleanName && inventoryItems.some((i) => i.name.trim().toLowerCase() === cleanName.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName) {
      showNotification('Please enter Item Name.', 'error');
      nameInputRef.current?.focus();
      return;
    }
    if (isDuplicate) {
      showNotification(`Warning: An item named "${cleanName}" already exists.`, 'error');
      nameInputRef.current?.focus();
      return;
    }

    const finalCategory = category === 'CUSTOM' ? (customCategory.trim() || 'General') : (category || 'General');

    setIsSubmitting(true);
    try {
      // Auto-generate item code if empty
      let finalCode = (code && code.trim()) ? code.trim().toUpperCase() : '';
      if (!finalCode) {
        const cleanPrefix = cleanName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'ITM') || 'ITM';
        finalCode = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const activeRows = locationRows.filter((r) => (parseFloat(String(r.qty)) || 0) > 0 || r.locationId);
      const finalBalances: ItemLocationBalance[] = activeRows.map((r) => {
        const q = parseFloat(String(r.qty)) || 0;
        const rt = parseFloat(String(r.rate)) || 0;
        let am = parseFloat(String(r.amount)) || 0;
        if (am === 0 && q > 0 && rt > 0) {
          am = Math.round(q * rt * 100) / 100;
        }
        const locObj = locations.find((l) => l.id === r.locationId);
        return {
          id: r.id,
          locationId: r.locationId,
          locationName: locObj?.name,
          qty: q,
          rate: rt > 0 ? rt : (q > 0 ? Math.round((am / q) * 100) / 100 : 0),
          amount: am,
        };
      });

      const totalQty = finalBalances.reduce((sum, b) => sum + Number(b.qty || 0), 0);
      const totalVal = finalBalances.reduce((sum, b) => sum + Number(b.amount || 0), 0);
      const avgRate = totalQty > 0 ? Math.round((totalVal / totalQty) * 100) / 100 : 0;

      const newItem: InventoryItem = {
        id: `itm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uuid: uuidv4(),
        companyId: currentCompany?.id || 'comp-default',
        code: finalCode,
        name: cleanName,
        taxPercent: taxPercent !== '' && !isNaN(Number(taxPercent)) ? Number(taxPercent) : undefined,
        category: finalCategory,
        primaryUnit: primaryUnit.toUpperCase(),
        alternateUnit: alternateUnit ? alternateUnit.toUpperCase() : undefined,
        conversionFactor: alternateUnit && conversionFactor !== '' ? Number(conversionFactor) : undefined,
        conversionDirection: alternateUnit ? conversionDirection : undefined,
        decimalPlaces: decimalPlaces !== '' ? Number(decimalPlaces) : 2,
        salesAccountId: salesAc || undefined,
        purchaseAccountId: purchaseAc || undefined,
        locationBalances: finalBalances,
        openingStock: totalQty,
        openingRate: avgRate,
        openingValue: totalVal,
        closingStock: totalQty,
        closingRate: avgRate,
        closingValue: totalVal,
        valuationMethod: valuationMethod || 'WEIGHTED_AVG',
        isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbStorage.saveInventoryItem(newItem);
      await dbStorage.logAudit(
        'CREATE',
        'INVENTORY_ITEM',
        newItem.id,
        `Created inventory item: ${newItem.name} (${newItem.code})`
      );

      // Persist custom category if newly added
      if (category === 'CUSTOM' && customCategory.trim()) {
        try {
          const raw = localStorage.getItem('bahi_khata_item_categories');
          const cats = raw ? JSON.parse(raw) : [];
          if (!cats.includes(customCategory.trim())) {
            cats.push(customCategory.trim());
            localStorage.setItem('bahi_khata_item_categories', JSON.stringify(cats));
          }
        } catch {
          // ignore
        }
      }

      // Persist last-used tax % so next new item inherits it (settings-like)
      try {
        if (taxPercent !== '' && !isNaN(Number(taxPercent))) {
          localStorage.setItem('bahi_khata_last_item_tax', String(taxPercent));
        }
      } catch {
        // ignore
      }

      await refreshActiveData();
      showNotification(`Item "${newItem.name}" saved successfully!`, 'success');
      onCreated(newItem);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save item.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md z-[9999999] flex items-center justify-center p-1.5 sm:p-3">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF] my-auto">
        {/* Modal Header */}
        <div className="px-5 py-2.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">
                Add New Inventory Item
              </h2>
              <p className="text-[10px] text-[#7F98AE]">
                Define product details, units, conversions, valuation &amp; opening stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#7F98AE] hover:text-[#FFFFFF] p-1.5 rounded-lg hover:bg-[rgba(37, 136, 232, 0.10)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="px-4 py-2 sm:px-5 sm:py-2.5 space-y-2 flex-1 max-h-[calc(96vh-85px)] overflow-y-auto scrollbar-thin text-xs">
          {/* Hidden Item Code */}
          <input type="hidden" value={code} />

          {/* Row 1: Category, Item Name & Tax Percent */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                Category <span className="text-[#2588E8]">*</span>
              </label>
              <div className="space-y-1.5">
                <select
                  ref={categorySelectRef}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                      {c}
                    </option>
                  ))}
                  <option value="CUSTOM" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold">
                    + Add Custom Category
                  </option>
                </select>

                {category === 'CUSTOM' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Enter custom category name"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[#2588E8] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden"
                    />
                    {Boolean(
                      customCategory.trim() &&
                        categories.some((c) => c.trim().toLowerCase() === customCategory.trim().toLowerCase())
                    ) && (
                      <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10.5px] flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Warning: Category &quot;{customCategory.trim()}&quot; already exists.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                Item Name <span className="text-[#fca5a5]">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                autoFocus
                placeholder="e.g. Kota Stone Blue 22x22 (Hand Cut)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
              {isDuplicate && (
                <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10.5px] flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Warning: Item &quot;{cleanName}&quot; already exists. Duplicate item names not allowed.</span>
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                Tax Percent (%) <span className="text-emerald-400 font-semibold">GST</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  list="full_modal_item_tax_list"
                  placeholder="e.g. 18"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 pr-7 text-xs text-emerald-400 font-semibold placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 pointer-events-none">
                  %
                </span>
                <datalist id="full_modal_item_tax_list">
                  <option value="0" label="0% (Nil)" />
                  <option value="0.1" label="0.1%" />
                  <option value="0.25" label="0.25%" />
                  <option value="1.5" label="1.5%" />
                  <option value="3" label="3%" />
                  <option value="5" label="5%" />
                  <option value="6" label="6%" />
                  <option value="12" label="12%" />
                  <option value="18" label="18%" />
                  <option value="28" label="28%" />
                </datalist>
              </div>
            </div>
          </div>

          {/* Row 2: Sales A/c & Purchase A/c */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold uppercase text-[#7F98AE]">
                  Sales A/c
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLedgerTarget('sales');
                    setIsLedgerModalOpen(true);
                  }}
                  className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  + Add Ledger
                </button>
              </div>
              <select
                value={salesAc}
                title="Default ledger credited for sales invoices"
                onChange={(e) => {
                  if (e.target.value === '__ADD_LEDGER__') {
                    setLedgerTarget('sales');
                    setIsLedgerModalOpen(true);
                  } else {
                    setSalesAc(e.target.value);
                  }
                }}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#2588E8] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">-- Select Sales A/c --</option>
                <option value="__ADD_LEDGER__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">+ Add Account Ledger...</option>
                {salesLedgerOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold uppercase text-[#7F98AE]">
                  Purchase A/c
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLedgerTarget('purchase');
                    setIsLedgerModalOpen(true);
                  }}
                  className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  + Add Ledger
                </button>
              </div>
              <select
                value={purchaseAc}
                title="Default ledger debited for purchase vouchers"
                onChange={(e) => {
                  if (e.target.value === '__ADD_LEDGER__') {
                    setLedgerTarget('purchase');
                    setIsLedgerModalOpen(true);
                  } else {
                    setPurchaseAc(e.target.value);
                  }
                }}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#2588E8] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">-- Select Purchase A/c --</option>
                <option value="__ADD_LEDGER__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">+ Add Account Ledger...</option>
                {purchaseLedgerOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Units & Multi-Unit Conversion with Formula, Valuation & Status */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-4 py-2 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F98AE]">
                    Primary Unit (Base)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitTarget('primary');
                      setIsUnitModalOpen(true);
                    }}
                    className="text-[9px] text-[#2588E8] hover:underline font-semibold cursor-pointer"
                  >
                    +Add Unit
                  </button>
                </div>
                <select
                  value={primaryUnit}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_UNIT__') {
                      setUnitTarget('primary');
                      setIsUnitModalOpen(true);
                    } else {
                      setPrimaryUnit(e.target.value);
                    }
                  }}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="__ADD_UNIT__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">
                    + Add Measurement Unit...
                  </option>
                  {unitList.map((u) => (
                    <option key={u} value={u} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F98AE]">
                    Alternate Unit
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitTarget('alternate');
                      setIsUnitModalOpen(true);
                    }}
                    className="text-[9px] text-[#2588E8] hover:underline font-semibold cursor-pointer"
                  >
                    +Add Unit
                  </button>
                </div>
                <select
                  value={alternateUnit}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_UNIT__') {
                      setUnitTarget('alternate');
                      setIsUnitModalOpen(true);
                    } else {
                      const val = e.target.value;
                      setAlternateUnit(val);
                      if (!val) setConversionFactor('');
                    }
                  }}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="">-- None (Single Unit) --</option>
                  <option value="__ADD_UNIT__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">
                    + Add Measurement Unit...
                  </option>
                  {unitList.filter((u) => u !== primaryUnit).map((u) => (
                    <option key={u} value={u} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1">
                  Formula Basis
                </label>
                <select
                  value={conversionDirection}
                  disabled={!alternateUnit}
                  onChange={(e) => setConversionDirection(e.target.value as any)}
                  className={`w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] ${
                    !alternateUnit ? 'opacity-40 cursor-not-allowed bg-[#0B1E16] text-[#7F98AE]' : 'cursor-pointer'
                  }`}
                >
                  {!alternateUnit ? (
                    <option value="">-- No Alternate Unit --</option>
                  ) : (
                    <>
                      <option value="PRIMARY_TO_ALT">
                        1 {primaryUnit || 'Primary Unit'} = X {alternateUnit}
                      </option>
                      <option value="ALT_TO_PRIMARY">
                        1 {alternateUnit} = X {primaryUnit || 'Primary Unit'}
                      </option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1 truncate" title="Conversion Factor">
                    Factor
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    disabled={!alternateUnit}
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                    placeholder={!alternateUnit ? '--' : (conversionDirection === 'PRIMARY_TO_ALT' ? `1 ${primaryUnit} = ?` : `1 ${alternateUnit} = ?`)}
                    className={`w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1.5 text-xs font-mono text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] ${
                      !alternateUnit ? 'opacity-40 cursor-not-allowed bg-[#0B1E16] placeholder-[#55695C]' : ''
                    }`}
                  />
                </div>
                <div className="w-16 shrink-0">
                  <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1 truncate" title="Decimal Places">
                    Decimal
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="1"
                    value={decimalPlaces}
                    onChange={(e) => setDecimalPlaces(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="0-4"
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1.5 text-xs font-mono text-center text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8]"
                  />
                </div>
              </div>
            </div>

            {/* Formula Bar + Valuation Method + Item Active in same line */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[rgba(112,185,245,0.25)]">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Compact Formula Field */}
                <div className="w-fit inline-flex items-center text-[10.5px] font-mono text-[#FFFFFF] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] whitespace-nowrap">
                  {!alternateUnit ? (
                    <span className="text-[#7F98AE] italic">
                      Formula: Single Unit ({primaryUnit || 'No Unit Selected'})
                    </span>
                  ) : conversionDirection === 'PRIMARY_TO_ALT' ? (
                    <>
                      Formula: 1 {primaryUnit || 'Base'} = <span className="text-[#2588E8] font-bold mx-1">{conversionFactor !== '' ? conversionFactor : 'X'}</span> {alternateUnit}
                    </>
                  ) : (
                    <>
                      Formula: 1 {alternateUnit} = <span className="text-[#2588E8] font-bold mx-1">{conversionFactor !== '' ? conversionFactor : 'X'}</span> {primaryUnit || 'Base'}
                    </>
                  )}
                </div>

                {/* Valuation Method */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-[#7F98AE] whitespace-nowrap">
                    Valuation:
                  </label>
                  <select
                    value={valuationMethod}
                    onChange={(e) => setValuationMethod(e.target.value as any)}
                    className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                  >
                    <option value="WEIGHTED_AVG">Weighted Average (Standard)</option>
                    <option value="FIFO">First-In First-Out (FIFO)</option>
                    <option value="MOVING_AVG">Moving Average</option>
                  </select>
                </div>
              </div>

              {/* Item Active Toggle */}
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#2588E8]"></div>
                  <span className="ml-1.5 text-xs font-bold uppercase text-[#B7C9D9] whitespace-nowrap">
                    {isActive ? 'Item Active' : 'Item Inactive'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Row 4: Opening Stock by Location */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-3.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-[#FFFFFF] flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-[#2588E8]" />
                <span>Opening Stock by Location</span>
              </div>
            </div>

            <div className="space-y-1.5">
              {locationRows.map((row, idx) => (
                <div
                  key={row.id || idx}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                    {/* 1. Opening Qty */}
                    <div className="w-full sm:w-24 shrink-0">
                      <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                        Qty ({primaryUnit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={row.qty}
                        onChange={(e) => handleLocationRowChange(idx, 'qty', e.target.value)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 py-1 text-xs font-mono text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                      />
                      {alternateUnit && Number(conversionFactor) > 0 && Number(row.qty) > 0 && (
                        <div className="mt-0.5 text-[8.5px] text-[#2588E8] font-mono">
                          ≈ {inventoryEngine.convertUnits(Number(row.qty), 'PRIMARY', Number(conversionFactor) || 1, conversionDirection).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {alternateUnit}
                        </div>
                      )}
                    </div>

                    {/* 2. Opening Rate */}
                    <div className="w-full sm:w-24 shrink-0">
                      <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                        Rate (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-xs font-mono text-[#7F98AE]">₹</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={row.rate}
                          onChange={(e) => handleLocationRowChange(idx, 'rate', e.target.value)}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-4 pr-1.5 py-1 text-xs font-mono text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                        />
                      </div>
                    </div>

                    {/* 3. Total Amount */}
                    <div className="w-full sm:w-28 shrink-0">
                      <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                        Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-xs font-mono text-[#7F98AE]">₹</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(e) => handleLocationRowChange(idx, 'amount', e.target.value)}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-4 pr-1.5 py-1 text-xs font-mono font-bold text-[#2588E8] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                        />
                      </div>
                    </div>

                    {/* 4. Location Dropdown */}
                    <div className="w-full sm:w-44 shrink-0">
                      <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#2588E8]" />
                        Location
                      </label>
                      <select
                        value={row.locationId}
                        onChange={(e) => handleLocationRowChange(idx, 'locationId', e.target.value)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 py-1 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                      >
                        <option value="">-- Select Godown / Location --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                            {loc.name} {loc.code ? `(${loc.code})` : ''} - {loc.type}
                            {loc.isDefault ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Plus (+) and Delete (-) */}
                    <div className="flex items-center gap-1 shrink-0 sm:pb-0.5">
                      <button
                        type="button"
                        onClick={addLocationRow}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-[rgba(57,167,255,0.15)] text-[#2588E8] hover:bg-[#2588E8] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] transition-colors cursor-pointer"
                        title="Add Next Location Line (+)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLocationRow(idx)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#421d23] text-[#fca5a5] hover:bg-rose-600 hover:text-white border border-rose-800/40 transition-colors cursor-pointer"
                        title={locationRows.length > 1 ? 'Delete this location row' : 'Clear this location row'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Combined Total Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-lg border border-[rgba(112,185,245,0.25)] text-[10.5px] font-mono">
              <div className="text-[#7F98AE] flex items-center gap-1">
                <span>Total across</span>
                <span className="text-[#FFFFFF] font-bold">{locationRows.length}</span>
                <span>location{locationRows.length > 1 ? 's' : ''}:</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[#B7C9D9]">
                  Qty:{' '}
                  <strong className="text-[#2588E8]">
                    {locationRows
                      .reduce((sum, r) => sum + (parseFloat(String(r.qty)) || 0), 0)
                      .toLocaleString('en-IN', {
                        minimumFractionDigits: decimalPlaces !== '' ? Number(decimalPlaces) : 2,
                        maximumFractionDigits: decimalPlaces !== '' ? Number(decimalPlaces) : 2,
                      })}
                  </strong>{' '}
                  {primaryUnit}
                </div>
                <div className="text-[#B7C9D9]">
                  Value:{' '}
                  <strong className="text-[#2588E8]">
                    ₹
                    {locationRows
                      .reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)
                      .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-1 py-1.5 flex items-center justify-end gap-2.5 border-t border-[rgba(112,185,245,0.25)] shrink-0">
            <button
              type="submit"
              disabled={isSubmitting || !cleanName || isDuplicate}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Item'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs text-[#7F98AE] hover:text-white hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Sub-Modal: Full Unit Master Modal */}
      <FullUnitMasterModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onCreated={(newUnit) => {
          const sym = newUnit.symbol.toUpperCase();
          setDbUnits((prev) => [...prev, newUnit]);
          if (unitTarget === 'primary') {
            setPrimaryUnit(sym);
          } else {
            setAlternateUnit(sym);
          }
        }}
      />

      {/* Sub-Modal: Full Ledger Master Modal */}
      <FullLedgerMasterModal
        isOpen={isLedgerModalOpen}
        initialName=""
        defaultGroupId={ledgerTarget === 'sales' ? 'grp-sales-accounts' : 'grp-purchase-accounts'}
        onClose={() => setIsLedgerModalOpen(false)}
        onCreated={(createdLedger) => {
          if (ledgerTarget === 'sales') {
            setSalesAc(createdLedger.name);
          } else {
            setPurchaseAc(createdLedger.name);
          }
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title="Save Item Before Closing?"
        message={`Do you want to save "${name.trim() || 'New Item'}" before closing this form?`}
        onConfirmSave={handleEscapeSave}
        onDiscard={() => {
          setShowEscapeConfirm(false);
          onClose();
        }}
        onCancel={() => setShowEscapeConfirm(false)}
      />
    </div>,
    document.body
  );
};
