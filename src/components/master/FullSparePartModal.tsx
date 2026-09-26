import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { SparePartItem } from '../../types';
import { Wrench, X, Check, AlertTriangle, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { FullUnitMasterModal } from './FullUnitMasterModal';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullSparePartModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (part: SparePartItem) => void;
}

const SPARE_PARTS_STORAGE_KEY_PREFIX = 'bahi_khata_spare_parts_';
const SPARE_CATEGORIES_STORAGE_KEY = 'bahi_khata_spare_item_categories';

const PRESET_ITEM_CATEGORIES = [
  'Diamond Tools & Blades',
  'Bearings & Bushings',
  'Hydraulics & Lubricants',
  'Motors & Electrical',
  'Abrasives & Polishing',
  'Cables, Belts & Ropes',
  'Valves, Nozzles & Fittings',
  'Pneumatics & Cylinders',
  'Fasteners & Hardware',
  'Consumables & General',
];

const PRESET_MACHINE_CATEGORIES = [
  'Gangsaw Machine',
  'Bridge Saw Cutter',
  'Polishing Line',
  'Cranes & Gantry',
  'Hydraulics & Lubricants',
  'Slurry Pumps & Motors',
  'CNC Profiler & Edge Cutting',
  'Compressor & Air Station',
];

export const FullSparePartModal: React.FC<FullSparePartModalProps> = ({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}) => {
  const { currentCompany, showNotification } = useApp();

  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState(initialName);
  const [itemCategory, setItemCategory] = useState('Diamond Tools & Blades');
  const [customItemCategory, setCustomItemCategory] = useState('');
  const [machineCategory, setMachineCategory] = useState('Gangsaw Machine');
  const [customMachineCategory, setCustomMachineCategory] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [unit, setUnit] = useState('NOS');
  const [currentStock, setCurrentStock] = useState<number | string>(0);
  const [minStockLevel, setMinStockLevel] = useState<number | string>(10);
  const [reorderLevel, setReorderLevel] = useState<number | string>(20);
  const [unitCost, setUnitCost] = useState<number | string>(0);
  const [locationBin, setLocationBin] = useState('');
  const [supplierBrand, setSupplierBrand] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nested Unit Modal
  const [showUnitModal, setShowUnitModal] = useState(false);

  // Available existing parts and units
  const [existingParts, setExistingParts] = useState<SparePartItem[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([
    'NOS', 'PCS', 'SET', 'LTR', 'KG', 'MTR', 'BOX', 'SQFT', 'SQMT', 'TON', 'PKT', 'ROLL'
  ]);

  const partNumberInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen: isOpen && !showUnitModal,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!partNumber.trim()) {
      showNotification('Data is needed in "Part Number / Code" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => partNumberInputRef.current?.focus(), 80);
      return;
    }
    if (!name.trim()) {
      showNotification('Data is needed in "Spare Part Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => nameInputRef.current?.focus(), 80);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  // Load parts and units
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPartNumber(`SP-${Math.floor(1000 + Math.random() * 9000)}`);
      setItemCategory('Diamond Tools & Blades');
      setCustomItemCategory('');
      setMachineCategory('Gangsaw Machine');
      setCustomMachineCategory('');
      setMachineModel('');
      setUnit('NOS');
      setCurrentStock(0);
      setMinStockLevel(10);
      setReorderLevel(20);
      setUnitCost(0);
      setLocationBin('');
      setSupplierBrand('');
      setSpecifications('');
      setNotes('');
      setIsActive(true);
      setIsSubmitting(false);

      if (typeof window !== 'undefined' && currentCompany?.id) {
        try {
          const raw = localStorage.getItem(`${SPARE_PARTS_STORAGE_KEY_PREFIX}${currentCompany.id}`);
          if (raw) {
            setExistingParts(JSON.parse(raw));
          }
        } catch {
          // ignore
        }
      }

      // Load DB units
      dbStorage.getItemUnits().then((units) => {
        if (units && units.length > 0) {
          const loadedSymbols = units.map((u) => u.symbol.toUpperCase());
          setUnitOptions((prev) => Array.from(new Set([...prev, ...loadedSymbols])));
        }
      }).catch(console.error);

      const t1 = setTimeout(() => {
        partNumberInputRef.current?.focus();
        partNumberInputRef.current?.select();
      }, 70);
      return () => clearTimeout(t1);
    }
  }, [isOpen, initialName, currentCompany?.id]);

  if (!isOpen) return null;

  const duplicateName = Boolean(
    name.trim() &&
      existingParts.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
  );
  const duplicatePartNo = Boolean(
    partNumber.trim() &&
      existingParts.some((p) => p.partNumber.trim().toUpperCase() === partNumber.trim().toUpperCase())
  );

  const totalValue = (Number(currentStock) || 0) * (Number(unitCost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showNotification('Please enter Spare Part Name.', 'error');
      return;
    }
    if (!partNumber.trim()) {
      showNotification('Please enter Part Number / Code.', 'error');
      partNumberInputRef.current?.focus();
      return;
    }
    if (duplicateName) {
      showNotification(`Warning: Spare Part "${name.trim()}" already exists.`, 'error');
      return;
    }
    if (duplicatePartNo) {
      showNotification(`Warning: Part Number "${partNumber.trim().toUpperCase()}" already exists.`, 'error');
      partNumberInputRef.current?.focus();
      return;
    }

    const finalItemCategory =
      itemCategory === 'CUSTOM'
        ? (customItemCategory.trim() || 'General Spare Parts')
        : (itemCategory.trim() || 'General Spare Parts');

    const finalMachineCategory =
      machineCategory === 'CUSTOM'
        ? (customMachineCategory.trim() || 'General Machinery')
        : (machineCategory.trim() || 'General Machinery');

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const stockVal = Number(currentStock) || 0;
      const reorderVal = Number(reorderLevel) || 0;

      let computedStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (stockVal <= 0) computedStatus = 'OUT_OF_STOCK';
      else if (stockVal <= reorderVal) computedStatus = 'LOW_STOCK';

      const newPart: SparePartItem = {
        id: `sp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uuid: uuidv4(),
        companyId: currentCompany?.id || 'comp-default',
        partNumber: partNumber.trim().toUpperCase(),
        name: name.trim(),
        itemCategory: finalItemCategory,
        machineCategory: finalMachineCategory,
        machineModel: machineModel.trim(),
        unit: unit.toUpperCase() || 'NOS',
        currentStock: stockVal,
        minStockLevel: Number(minStockLevel) || 0,
        reorderLevel: reorderVal,
        unitCost: Number(unitCost) || 0,
        locationBin: locationBin.trim(),
        supplierBrand: supplierBrand.trim(),
        status: computedStatus,
        specifications: specifications.trim(),
        notes: notes.trim(),
        isActive,
        createdAt: now,
        updatedAt: now,
      };

      // Save to localStorage
      const storageKey = `${SPARE_PARTS_STORAGE_KEY_PREFIX}${currentCompany?.id || 'comp-default'}`;
      let list: SparePartItem[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) list = JSON.parse(raw);
      } catch {
        list = [];
      }
      const updatedList = [newPart, ...list];
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      // Also persist custom category if any
      if (itemCategory === 'CUSTOM' && customItemCategory.trim()) {
        try {
          const rawCats = localStorage.getItem(SPARE_CATEGORIES_STORAGE_KEY);
          const cats = rawCats ? JSON.parse(rawCats) : [];
          if (!cats.includes(customItemCategory.trim())) {
            cats.push(customItemCategory.trim());
            localStorage.setItem(SPARE_CATEGORIES_STORAGE_KEY, JSON.stringify(cats));
          }
        } catch {
          // ignore
        }
      }

      await dbStorage.logAudit(
        'CREATE',
        'SPARE_PART',
        newPart.id,
        `Created spare part: ${newPart.name} (${newPart.partNumber})`
      );

      showNotification(`Spare Part "${newPart.name}" created successfully!`, 'success');
      onCreated(newPart);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save spare part.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999999] bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF] my-auto">
        {/* Header */}
        <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">Create Spare Part (Original Master Form)</h2>
              <p className="text-[10px] text-[#7F98AE]">Plant &amp; Machinery Spares &bull; Full Specifications &amp; Stock Levels</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#7F98AE] hover:text-white hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Row 1: Part Number & Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Part Number / Code <span className="text-rose-400">*</span>
              </label>
              <input
                ref={partNumberInputRef}
                type="text"
                required
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value.toUpperCase())}
                placeholder="e.g. SP-GS-001"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
              {duplicatePartNo && (
                <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-lg text-[#fca5a5] text-[10px] flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Part No &quot;{partNumber}&quot; already in use.</span>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Spare Part Name <span className="text-rose-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diamond Gangsaw Blade Segments (4x10x20mm)"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
              {duplicateName && (
                <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-lg text-[#fca5a5] text-[10px] flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Spare Part named &quot;{name}&quot; already exists.</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Item Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                {PRESET_ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
                    {cat}
                  </option>
                ))}
                <option value="CUSTOM" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold">
                  + Add Custom Category...
                </option>
              </select>
              {itemCategory === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="Enter custom category name"
                  value={customItemCategory}
                  onChange={(e) => setCustomItemCategory(e.target.value)}
                  className="mt-1.5 w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[#2588E8] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Machinery Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={machineCategory}
                onChange={(e) => setMachineCategory(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                {PRESET_MACHINE_CATEGORIES.map((m) => (
                  <option key={m} value={m} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
                    {m}
                  </option>
                ))}
                <option value="CUSTOM" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold">
                  + Add Custom Machinery...
                </option>
              </select>
              {machineCategory === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="Enter custom machinery category"
                  value={customMachineCategory}
                  onChange={(e) => setCustomMachineCategory(e.target.value)}
                  className="mt-1.5 w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[#2588E8] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden"
                />
              )}
            </div>
          </div>

          {/* Row 3: Machine Model, Location & Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Machine Model / Application
              </label>
              <input
                type="text"
                value={machineModel}
                onChange={(e) => setMachineModel(e.target.value)}
                placeholder="e.g. Gasperi 80-Blade Gangsaw"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Storage Location / Bin
              </label>
              <input
                type="text"
                value={locationBin}
                onChange={(e) => setLocationBin(e.target.value)}
                placeholder="e.g. Rack A - Shelf 2"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Supplier / Brand
              </label>
              <input
                type="text"
                value={supplierBrand}
                onChange={(e) => setSupplierBrand(e.target.value)}
                placeholder="e.g. SKF, Diamant Boart, Castrol"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
          </div>

          {/* Row 4: Unit, Stock & Costs */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3.5 rounded-xl border border-[rgba(112,185,245,0.25)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[#7F98AE] uppercase">
                    Unit <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUnitModal(true)}
                    className="text-[10px] text-[#2588E8] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" /> +Add Unit
                  </button>
                </div>
                <select
                  value={unit}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowUnitModal(true);
                    } else {
                      setUnit(e.target.value);
                    }
                  }}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="__ADD_NEW__" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8] font-bold">
                    + Add Measurement Unit...
                  </option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                  Available Stock
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                  Unit Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                  Stock Valuation (₹)
                </label>
                <div className="w-full bg-[#0D231A] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 select-none">
                  ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Reorder & Minimum Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Minimum Safety Stock Level
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Reorder Alert Level
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
          </div>

          {/* Row 6: Specifications & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Technical Specifications
              </label>
              <textarea
                rows={2}
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder="Dimensions, grade, thread, RPM, voltage, etc."
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Notes &amp; Fitment Details
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fitment instructions, critical spare status, inspection intervals..."
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="part_is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-[#2588E8] focus:ring-[#2588E8] cursor-pointer"
            />
            <label htmlFor="part_is_active" className="text-xs font-medium text-white cursor-pointer">
              Active Spare Part (visible in purchase bills &amp; stock journals)
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(112,185,245,0.25)]">
            <button
              type="submit"
              disabled={isSubmitting || duplicateName || duplicatePartNo}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Spare Part'}</span>
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

      {/* Full Nested Unit Master Modal */}
      <FullUnitMasterModal
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
        onCreated={(newUnit) => {
          setUnitOptions((prev) => Array.from(new Set([...prev, newUnit.symbol.toUpperCase()])));
          setUnit(newUnit.symbol.toUpperCase());
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title="Save Spare Part Before Closing?"
        message={`Do you want to save "${name.trim() || 'New Spare Part'}" before closing this form?`}
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
