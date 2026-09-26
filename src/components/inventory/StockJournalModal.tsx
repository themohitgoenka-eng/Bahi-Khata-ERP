import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  InventoryItem,
  StockJournalEntry,
  StockJournalItem,
  StockJournalType,
} from '../../types';
import { inventoryEngine } from '../../services/inventoryEngine';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';
import { FullItemMasterModal } from '../master/FullItemMasterModal';
import { SearchableDropdown } from '../common/SearchableDropdown';
import {
  Layers,
  Plus,
  Trash2,
  Save,
  X,
  ArrowRight,
  Calculator,
  AlertCircle,
  HelpCircle,
  MapPin,
  Building2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay } from '../../utils/dateUtils';

interface StockJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  journalToEdit?: StockJournalEntry | null;
}

export const StockJournalModal: React.FC<StockJournalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  journalToEdit,
}) => {
  const { currentCompany, currentFiscalYear, inventoryItems, locations, showNotification, refreshActiveData } = useApp();

  const [journalType, setJournalType] = useState<StockJournalType>('MANUFACTURING');
  const [voucherNo, setVoucherNo] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [additionalCost, setAdditionalCost] = useState<number>(0);

  // Quick Create Item state
  const [quickItemModal, setQuickItemModal] = useState<{ open: boolean; listType: 'source' | 'destination'; rowIdx: number | null }>({ open: false, listType: 'source', rowIdx: null });

  // Source (Issue / Consumption) Items
  const [sourceItems, setSourceItems] = useState<StockJournalItem[]>([]);

  // Destination (Production / Inward) Items
  const [destinationItems, setDestinationItems] = useState<StockJournalItem[]>([]);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    details?: { label: string; value: string | number }[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form close confirmation on Escape
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  useFormEscapeClose({
    isOpen: isOpen && !quickItemModal.open && !confirmModal.isOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const createBlankItem = (initialLocationId?: string, initialGodown?: string): StockJournalItem => {
    return {
      id: uuidv4(),
      itemId: '',
      itemCode: '',
      itemName: '',
      quantity: '' as any,
      unit: '',
      rate: '' as any,
      amount: 0,
      locationId: initialLocationId || '',
      godown: initialGodown || '',
    };
  };

  const handleItemLocationChange = (
    listType: 'source' | 'destination',
    index: number,
    locationId: string
  ) => {
    const loc = locations.find((l) => l.id === locationId);
    if (listType === 'source') {
      setSourceItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          locationId: loc?.id || '',
          godown: loc ? loc.name : '',
        };
        return copy;
      });
    } else {
      setDestinationItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          locationId: loc?.id || '',
          godown: loc ? loc.name : '',
        };
        return copy;
      });
    }
  };

  const handleBulkSetSourceLocation = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    setSourceItems((prev) =>
      prev.map((item) => ({ ...item, locationId: loc.id, godown: loc.name }))
    );
  };

  const handleBulkSetDestinationLocation = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    setDestinationItems((prev) =>
      prev.map((item) => ({ ...item, locationId: loc.id, godown: loc.name }))
    );
  };

  // Initialize data
  useEffect(() => {
    if (!isOpen) return;

    if (journalToEdit) {
      setJournalType(journalToEdit.journalType);
      setVoucherNo(journalToEdit.voucherNo);
      setDate(journalToEdit.date);
      setReferenceNo(journalToEdit.referenceNo || '');
      setNarration(journalToEdit.narration || '');
      setAdditionalCost(journalToEdit.additionalCost || 0);
      setSourceItems(
        (journalToEdit.sourceItems || []).map((s) => ({ ...s, id: s.id || uuidv4() }))
      );
      setDestinationItems(
        (journalToEdit.destinationItems || []).map((d) => ({ ...d, id: d.id || uuidv4() }))
      );
    } else {
      // New Voucher - all data fields start completely blank
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setReferenceNo('');
      setNarration('');
      setAdditionalCost(0);
      setJournalType('MANUFACTURING');

      // Fetch next voucher number safely
      inventoryEngine
        .getNextStockJournalVoucherNumber()
        .then((no) => setVoucherNo(no))
        .catch(() => setVoucherNo(`STKJ/26-27/${Date.now().toString().slice(-4)}`));

      // Blank source and destination rows
      setSourceItems([createBlankItem()]);
      setDestinationItems([createBlankItem()]);
    }

    const focusFirst = () => {
      document.getElementById('sj_journal_type_select')?.focus();
    };
    const t1 = setTimeout(focusFirst, 60);
    const t2 = setTimeout(focusFirst, 160);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, journalToEdit]);

  if (!isOpen) return null;

  // --- Source Item Handlers ---
  const handleAddSourceRow = () => {
    const newIdx = sourceItems.length;
    setSourceItems((prev) => [...prev, createBlankItem()]);
    setTimeout(() => {
      document.getElementById(`sj_source_item_${newIdx}`)?.focus();
    }, 60);
  };

  const handleSourceItemChange = (
    index: number,
    field: keyof StockJournalItem,
    value: any
  ) => {
    setSourceItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'itemId') {
        const found = inventoryItems.find((i) => i.id === value);
        if (found) {
          row.itemId = found.id;
          row.itemCode = found.code;
          row.itemName = found.name;
          row.unit = found.primaryUnit || '';
          row.rate = found.openingRate || 0;
          const qty = Number(row.quantity) || 0;
          row.amount = Math.round(qty * Number(row.rate) * 100) / 100;
        } else {
          row.itemId = '';
          row.itemCode = '';
          row.itemName = '';
          row.unit = '';
          row.rate = '' as any;
          row.amount = 0;
        }
      } else if (field === 'quantity' || field === 'rate') {
        (row as any)[field] = value === '' ? ('' as any) : Number(value);
        const qty = Number(field === 'quantity' ? value : row.quantity) || 0;
        const rate = Number(field === 'rate' ? value : row.rate) || 0;
        row.amount = Math.round(qty * rate * 100) / 100;
      } else {
        (row as any)[field] = value;
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleRemoveSourceRow = (index: number) => {
    setSourceItems((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Destination Item Handlers ---
  const handleAddDestinationRow = () => {
    const newIdx = destinationItems.length;
    setDestinationItems((prev) => [...prev, createBlankItem()]);
    setTimeout(() => {
      document.getElementById(`sj_dest_item_${newIdx}`)?.focus();
    }, 60);
  };

  const handleDestinationItemChange = (
    index: number,
    field: keyof StockJournalItem,
    value: any
  ) => {
    setDestinationItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'itemId') {
        const found = inventoryItems.find((i) => i.id === value);
        if (found) {
          row.itemId = found.id;
          row.itemCode = found.code;
          row.itemName = found.name;
          row.unit = found.primaryUnit || '';
          row.rate = found.openingRate || 0;
          const qty = Number(row.quantity) || 0;
          row.amount = Math.round(qty * Number(row.rate) * 100) / 100;
        } else {
          row.itemId = '';
          row.itemCode = '';
          row.itemName = '';
          row.unit = '';
          row.rate = '' as any;
          row.amount = 0;
        }
      } else if (field === 'quantity' || field === 'rate') {
        (row as any)[field] = value === '' ? ('' as any) : Number(value);
        const qty = Number(field === 'quantity' ? value : row.quantity) || 0;
        const rate = Number(field === 'rate' ? value : row.rate) || 0;
        row.amount = Math.round(qty * rate * 100) / 100;
      } else {
        (row as any)[field] = value;
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleRemoveDestinationRow = (index: number) => {
    setDestinationItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totalSourceAmount = sourceItems.reduce(
    (sum, itm) => sum + (Number(itm.amount) || Number(itm.quantity || 0) * Number(itm.rate || 0)),
    0
  );
  const totalSourceQty = sourceItems.reduce((sum, itm) => sum + Number(itm.quantity || 0), 0);

  const totalEffectiveCost = totalSourceAmount + Number(additionalCost || 0);

  const totalDestinationQty = destinationItems.reduce(
    (sum, itm) => sum + Number(itm.quantity || 0),
    0
  );
  const totalDestinationAmount = destinationItems.reduce(
    (sum, itm) => sum + (Number(itm.amount) || Number(itm.quantity || 0) * Number(itm.rate || 0)),
    0
  );

  // Auto-allocate cost tool: distribute Total Source Amount + Additional Overheads into Destination Items
  const handleAutoDistributeCost = () => {
    if (destinationItems.length === 0 || totalDestinationQty <= 0) {
      showNotification('Please add destination items and quantities first.', 'error');
      return;
    }

    setDestinationItems((prev) => {
      return prev.map((dest) => {
        const proportion = Number(dest.quantity || 0) / totalDestinationQty;
        const allocatedAmount = Math.round(totalEffectiveCost * proportion * 100) / 100;
        const calculatedRate =
          dest.quantity && dest.quantity > 0
            ? Math.round((allocatedAmount / dest.quantity) * 100) / 100
            : 0;

        return {
          ...dest,
          amount: allocatedAmount,
          rate: calculatedRate,
        };
      });
    });

    showNotification(
      `Distributed ₹${totalEffectiveCost.toFixed(2)} total cost across ${destinationItems.length} destination items.`,
      'success'
    );
  };

  const handleSubmit = () => {
    if (!currentCompany || !currentFiscalYear) {
      showNotification('Company or Fiscal Year context is missing.', 'error');
      return;
    }

    if (!voucherNo.trim()) {
      showNotification('Please provide a Voucher Number.', 'error');
      return;
    }

    const validSource = sourceItems
      .filter((s) => s.itemId && Number(s.quantity) > 0)
      .map((s) => ({
        ...s,
        quantity: Number(s.quantity),
        rate: Number(s.rate) || 0,
        amount: Number(s.amount) || Math.round(Number(s.quantity) * (Number(s.rate) || 0) * 100) / 100,
      }));
    const validDest = destinationItems
      .filter((d) => d.itemId && Number(d.quantity) > 0)
      .map((d) => ({
        ...d,
        quantity: Number(d.quantity),
        rate: Number(d.rate) || 0,
        amount: Number(d.amount) || Math.round(Number(d.quantity) * (Number(d.rate) || 0) * 100) / 100,
      }));

    if (validSource.length === 0 && validDest.length === 0) {
      showNotification('Stock journal must have at least one source (issue) or destination (production) item.', 'error');
      return;
    }

    const isEdit = Boolean(journalToEdit);

    setConfirmModal({
      isOpen: true,
      type: isEdit ? 'EDIT' : 'ADD',
      title: isEdit ? 'Confirm Update Stock Journal' : 'Confirm Save Stock Journal',
      message: isEdit
        ? `Are you sure you want to update stock journal voucher "${voucherNo}"? Stock movements will be recalculated.`
        : `Are you sure you want to post stock journal "${voucherNo}" for ${journalType.replace('_', ' ')}?`,
      details: [
        { label: 'Voucher No', value: voucherNo },
        { label: 'Date', value: formatDateDisplay(date) },
        { label: 'Type', value: journalType },
        { label: 'Source (Issue) Items', value: `${validSource.length} item(s) • ₹${totalSourceAmount.toFixed(2)}` },
        { label: 'Destination (Output) Items', value: `${validDest.length} item(s) • ₹${totalDestinationAmount.toFixed(2)}` },
        { label: 'Additional Overheads', value: `₹${Number(additionalCost || 0).toFixed(2)}` },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await inventoryEngine.recordStockJournal({
            id: journalToEdit?.id,
            uuid: journalToEdit?.uuid,
            voucherNo: voucherNo.trim(),
            date,
            companyId: currentCompany.id,
            fiscalYearId: currentFiscalYear.id,
            journalType,
            narration: narration.trim(),
            referenceNo: referenceNo.trim(),
            additionalCost: Number(additionalCost || 0),
            sourceItems: validSource,
            destinationItems: validDest,
          });

          showNotification(
            `Stock Journal "${voucherNo}" ${isEdit ? 'updated' : 'posted'} successfully.`,
            'success'
          );
          // Reset form state on save
          setDate(new Date().toISOString().split('T')[0]);
          setReferenceNo('');
          setNarration('');
          setAdditionalCost(0);
          setSourceItems([createBlankItem()]);
          setDestinationItems([createBlankItem()]);
          onSuccess();
          onClose();
        } catch (err: any) {
          showNotification(err.message || 'Failed to save stock journal.', 'error');
        }
      },
    });
  };

  const handleEscapeSave = () => {
    if (!voucherNo || !voucherNo.trim()) {
      showNotification('Data is needed in "Voucher Number" field.', 'error');
      setShowEscapeConfirm(false);
      return;
    }
    const validSource = sourceItems.filter((s) => s.itemId && Number(s.quantity) > 0);
    const validDest = destinationItems.filter((d) => d.itemId && Number(d.quantity) > 0);

    if (validSource.length === 0 && validDest.length === 0) {
      showNotification('Data is needed in "Stock Item (Issue or Production)" field.', 'error');
      setShowEscapeConfirm(false);
      return;
    }

    setShowEscapeConfirm(false);
    handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
      <div className="bg-[#0f111a] border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#090a0f] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold text-sm text-white tracking-wide">
              {journalToEdit ? 'EDIT STOCK JOURNAL VOUCHER' : 'NEW STOCK JOURNAL VOUCHER'}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold">
              Manufacturing, Repacking & Inter-Godown Transfers
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Meta Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#090a0f] p-3 rounded-lg border border-slate-800">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Journal Type
              </label>
              <select
                id="sj_journal_type_select"
                value={journalType}
                onChange={(e) => setJournalType(e.target.value as StockJournalType)}
                className="w-full bg-[#131722] border border-slate-700 rounded px-2.5 py-1.5 text-white font-medium focus:border-amber-500 outline-none cursor-pointer"
              >
                <option value="MANUFACTURING">Manufacturing / Processing</option>
                <option value="INTER_LOCATION">Inter-Godown Transfer</option>
                <option value="CONSUMPTION_PRODUCTION">Consumption & Production</option>
                <option value="GENERAL_TRANSFER">General Stock Transfer</option>
                <option value="STOCK_ADJUSTMENT">Repacking / Conversion</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Voucher No <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="STKJ/26-27/001"
                className="w-full bg-[#131722] border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Date <span className="text-rose-400">*</span>
              </label>
              <DateInput
                required
                value={date}
                onChange={(val) => setDate(val)}
                size="sm"
                className="w-full !h-[34px] !bg-[#131722] !border-slate-700 rounded text-white focus-within:!border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Reference / Batch No
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. BATCH-2026-A1"
                className="w-full bg-[#131722] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Quick Godown Assignment Bar (especially helpful for Inter-Godown Transfers) */}
          {locations.length > 0 && (
            <div className="bg-[#090a0f] border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-slate-300">
                  Quick Godown Allocation:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-400 font-medium">Source Godown:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleBulkSetSourceLocation(e.target.value);
                    }}
                    defaultValue=""
                    className="bg-[#131722] border border-slate-700 rounded px-2 py-1 text-white text-[11px] outline-none focus:border-rose-500"
                  >
                    <option value="">Select</option>
                    {locations.filter((l) => l.isActive).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code}){loc.isDefault ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-medium">Destination Godown:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleBulkSetDestinationLocation(e.target.value);
                    }}
                    defaultValue=""
                    className="bg-[#131722] border border-slate-700 rounded px-2 py-1 text-white text-[11px] outline-none focus:border-emerald-500"
                  >
                    <option value="">Select</option>
                    {locations.filter((l) => l.isActive).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code}){loc.isDefault ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Two-Column Side by Side: Source (Issue) vs Destination (Production) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* SOURCE (CONSUMPTION / ISSUE / RAW MATERIALS) */}
            <div className="bg-[#090a0f] border border-rose-900/40 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-rose-900/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  <span className="font-bold text-xs text-rose-300">
                    Source (Consumption / Issue)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    (Deducts Raw Material Stock)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSourceRow}
                  className="flex items-center gap-1 bg-rose-900/40 hover:bg-rose-900 text-rose-200 px-2 py-1 rounded text-[11px] border border-rose-800 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add Issue Item
                </button>
              </div>

              {sourceItems.length === 0 ? (
                <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No source items added. Click "Add Issue Item" to add consumed materials.
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {sourceItems.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="bg-[#121520] border border-slate-800 rounded p-2 space-y-2 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500">Item</label>
                          <SearchableDropdown
                            id={`sj_source_item_${idx}`}
                            value={row.itemId}
                            onChange={(val) => handleSourceItemChange(idx, 'itemId', val)}
                            options={inventoryItems.map((itm) => ({
                              value: itm.id,
                              label: itm.name,
                              subLabel: itm.code ? `Code: ${itm.code}` : undefined,
                              badge: itm.primaryUnit,
                            }))}
                            placeholder="Select Item"
                            addOptionLabel="+ Add Item (Item Master)..."
                            onAddOption={() => {
                              setQuickItemModal({ open: true, listType: 'source', rowIdx: idx });
                            }}
                            buttonClassName="h-[28px] text-[11px]"
                          />
                        </div>
                        <div className="w-36">
                          <label className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-rose-400" />
                            Godown / Location
                          </label>
                          {locations.length > 0 ? (
                            <select
                              value={row.locationId || locations.find((l) => l.name === row.godown)?.id || ''}
                              onChange={(e) => handleItemLocationChange('source', idx, e.target.value)}
                              className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-white text-[11px] focus:border-rose-500 outline-none"
                            >
                              <option value="">Select</option>
                              {locations.filter((l) => l.isActive).map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.code}){loc.isDefault ? ' ★' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.godown || ''}
                              onChange={(e) => handleSourceItemChange(idx, 'godown', e.target.value)}
                              placeholder="e.g. Godown / Yard"
                              className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSourceRow(idx)}
                          className="mt-4 p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">
                            Quantity {row.unit ? `(${row.unit})` : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity || ''}
                            onChange={(e) => handleSourceItemChange(idx, 'quantity', e.target.value)}
                            placeholder="0"
                            className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-right text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">
                            Rate (₹) {row.unit ? `/ ${row.unit}` : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.rate || ''}
                            onChange={(e) => handleSourceItemChange(idx, 'rate', e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-right text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Amount (₹)</label>
                          <div className="w-full bg-[#090a0f]/60 border border-slate-800 rounded px-2 py-1 text-right text-rose-300 font-bold">
                            ₹{Number(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Source Summary */}
              <div className="flex justify-between items-center bg-[#131722] p-2.5 rounded-lg border border-slate-800 text-xs font-bold">
                <span className="text-slate-400">Total Issue Cost:</span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 text-[10px] mr-2">Qty: {totalSourceQty}</span>
                  <span className="text-rose-400">
                    ₹{totalSourceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* DESTINATION (PRODUCTION / RECEIPT / FINISHED GOODS) */}
            <div className="bg-[#090a0f] border border-emerald-900/40 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="font-bold text-xs text-emerald-300">
                    Destination (Production / Receipt)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    (Adds Finished Good Stock)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAutoDistributeCost}
                    title="Auto-calculate cost per unit based on source materials + overheads"
                    className="flex items-center gap-1 bg-amber-950/60 hover:bg-amber-900 text-amber-300 px-2 py-1 rounded text-[10px] border border-amber-800 transition cursor-pointer"
                  >
                    <Calculator className="w-3 h-3" />
                    Auto Cost
                  </button>
                  <button
                    type="button"
                    onClick={handleAddDestinationRow}
                    className="flex items-center gap-1 bg-emerald-900/40 hover:bg-emerald-900 text-emerald-200 px-2 py-1 rounded text-[11px] border border-emerald-800 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Output Item
                  </button>
                </div>
              </div>

              {destinationItems.length === 0 ? (
                <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No destination items added. Click "Add Output Item" to add produced or transferred goods.
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {destinationItems.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="bg-[#121520] border border-slate-800 rounded p-2 space-y-2 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500">Output Item</label>
                          <SearchableDropdown
                            id={`sj_dest_item_${idx}`}
                            value={row.itemId}
                            onChange={(val) => handleDestinationItemChange(idx, 'itemId', val)}
                            options={inventoryItems.map((itm) => ({
                              value: itm.id,
                              label: itm.name,
                              subLabel: itm.code ? `Code: ${itm.code}` : undefined,
                              badge: itm.primaryUnit,
                            }))}
                            placeholder="Select Item"
                            addOptionLabel="+ Add Item (Item Master)..."
                            onAddOption={() => {
                              setQuickItemModal({ open: true, listType: 'destination', rowIdx: idx });
                            }}
                            buttonClassName="h-[28px] text-[11px]"
                          />
                        </div>
                        <div className="w-36">
                          <label className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                            Godown / Location
                          </label>
                          {locations.length > 0 ? (
                            <select
                              value={row.locationId || locations.find((l) => l.name === row.godown)?.id || ''}
                              onChange={(e) => handleItemLocationChange('destination', idx, e.target.value)}
                              className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-white text-[11px] focus:border-emerald-500 outline-none"
                            >
                              <option value="">Select</option>
                              {locations.filter((l) => l.isActive).map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.code}){loc.isDefault ? ' ★' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.godown || ''}
                              onChange={(e) => handleDestinationItemChange(idx, 'godown', e.target.value)}
                              placeholder="e.g. Godown / Store"
                              className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDestinationRow(idx)}
                          className="mt-4 p-1 text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">
                            Produced Qty {row.unit ? `(${row.unit})` : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity || ''}
                            onChange={(e) => handleDestinationItemChange(idx, 'quantity', e.target.value)}
                            placeholder="0"
                            className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-right text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">
                            Calculated Rate (₹) {row.unit ? `/ ${row.unit}` : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.rate || ''}
                            onChange={(e) => handleDestinationItemChange(idx, 'rate', e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-[#090a0f] border border-slate-700 rounded px-2 py-1 text-right text-slate-200 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Total Value (₹)</label>
                          <div className="w-full bg-[#090a0f]/60 border border-slate-800 rounded px-2 py-1 text-right text-emerald-300 font-bold">
                            ₹{Number(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Destination Summary */}
              <div className="flex justify-between items-center bg-[#131722] p-2.5 rounded-lg border border-slate-800 text-xs font-bold">
                <span className="text-slate-400">Total Output Value:</span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 text-[10px] mr-2">Qty: {totalDestinationQty}</span>
                  <span className="text-emerald-400">
                    ₹{totalDestinationAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Overheads, Processing Costs & Narration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#090a0f] p-3 rounded-lg border border-slate-800">
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Narration / Manufacturing Notes
              </label>
              <textarea
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Enter job work details, operator name, batch loss remarks, or transfer notes..."
                className="w-full bg-[#131722] border border-slate-700 rounded p-2 text-white focus:border-amber-500 outline-none resize-none text-[11px]"
              />
            </div>

            <div className="space-y-2 bg-[#121520] p-2.5 rounded border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Additional Overheads / Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={additionalCost || ''}
                  onChange={(e) => setAdditionalCost(Number(e.target.value))}
                  placeholder="e.g. Labor, Cutting, Freight"
                  className="w-full bg-[#090a0f] border border-slate-700 rounded px-2.5 py-1 text-white font-bold text-right"
                />
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800">
                <span className="text-slate-400">Total Production Cost:</span>
                <span className="font-bold text-amber-300 font-mono">
                  ₹{totalEffectiveCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#090a0f] border-t border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Click <strong>Auto Cost</strong> to allocate total material & overhead costs to output items.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {journalToEdit ? 'Update Stock Journal' : 'Save & Post Stock Journal'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        itemDetails={confirmModal.details}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Full Original Item Master Modal */}
      <FullItemMasterModal
        isOpen={quickItemModal.open}
        initialName=""
        onClose={() => setQuickItemModal({ open: false, listType: 'source', rowIdx: null })}
        onCreated={async (newItem) => {
          await refreshActiveData();
          if (quickItemModal.rowIdx !== null) {
            if (quickItemModal.listType === 'source') {
              handleSourceItemChange(quickItemModal.rowIdx, 'itemId', newItem.id);
              setTimeout(() => document.getElementById(`sj_source_item_${quickItemModal.rowIdx}`)?.focus(), 60);
            } else {
              handleDestinationItemChange(quickItemModal.rowIdx, 'itemId', newItem.id);
              setTimeout(() => document.getElementById(`sj_dest_item_${quickItemModal.rowIdx}`)?.focus(), 60);
            }
          }
          setQuickItemModal({ open: false, listType: 'source', rowIdx: null });
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title="Save Stock Journal Before Closing?"
        message={`Do you want to save Stock Journal "${voucherNo.trim() || 'this voucher'}" (${journalType.replace('_', ' ')}) before closing this form?`}
        onConfirmSave={handleEscapeSave}
        onDiscard={() => {
          setShowEscapeConfirm(false);
          onClose();
        }}
        onCancel={() => setShowEscapeConfirm(false)}
      />
    </div>
  );
};
