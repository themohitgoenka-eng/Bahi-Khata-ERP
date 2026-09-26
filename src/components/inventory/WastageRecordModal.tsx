import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryEngine } from '../../services/inventoryEngine';
import { InventoryItem } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { DateInput } from '../common/DateInput';
import { getTodayISO } from '../../utils/dateUtils';
import {
  Scissors,
  X,
  AlertTriangle,
  Layers,
  Save,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

interface WastageRecordModalProps {
  item?: InventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WastageRecordModal: React.FC<WastageRecordModalProps> = ({
  item: initialItem,
  onClose,
  onSuccess,
}) => {
  const { currentCompany, currentFiscalYear, inventoryItems, locations, showNotification, refreshActiveData } = useApp();

  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItem?.id || ''
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayISO());
  const [wastageType, setWastageType] = useState<any>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [createVoucher, setCreateVoucher] = useState<boolean>(true);

  // Confirmation Modal State
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

  const selectedItem = inventoryItems.find((i) => i.id === selectedItemId);
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  const handleRecordWastage = () => {
    if (!currentCompany || !currentFiscalYear) return;
    if (!selectedItemId || quantity <= 0) {
      showNotification('Please select an item and enter valid wastage quantity.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Stock Wastage / Write-off',
      message: `Are you sure you want to write off ${quantity} ${selectedItem?.primaryUnit || 'units'} of "${selectedItem?.name}" as ${wastageType.replace('_', ' ')}?`,
      details: [
        { label: 'Item', value: `${selectedItem?.name} (${selectedItem?.code})` },
        { label: 'Godown / Location', value: selectedLocation ? `${selectedLocation.name} (${selectedLocation.code})` : 'Factory Yard / Default' },
        { label: 'Loss Nature', value: wastageType.replace('_', ' ') },
        { label: 'Loss Qty', value: `${quantity} ${selectedItem?.primaryUnit}` },
        { label: 'Loss Voucher', value: createVoucher ? 'ENABLED (Auto Dr Loss / Cr Stock)' : 'DISABLED' },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await inventoryEngine.recordWastage({
            companyId: currentCompany.id,
            fiscalYearId: currentFiscalYear.id,
            itemId: selectedItemId,
            date,
            wastageType,
            quantity: Number(quantity),
            locationId: selectedLocationId,
            godown: selectedLocation ? selectedLocation.name : undefined,
            reason: reason.trim() || `Wastage due to ${wastageType.replace('_', ' ')}`,
            createAccountingVoucher: createVoucher,
          });

          showNotification(`Wastage of ${quantity} ${selectedItem?.primaryUnit} recorded successfully.`, 'success');
          // Reset form on save
          setSelectedItemId('');
          setSelectedLocationId('');
          setWastageType('');
          setQuantity('');
          setReason('');
          await refreshActiveData();
          onSuccess();
          onClose();
        } catch (err: any) {
          showNotification(err.message || 'Failed to record wastage.', 'error');
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-5 w-full max-w-md space-y-4 text-xs text-[#FFFFFF] shadow-2xl">
        <div className="flex justify-between items-center border-b border-[rgba(112,185,245,0.25)] pb-3">
          <h3 className="font-bold text-[#FFFFFF] text-sm flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#fca5a5]" />
            Record Inventory Wastage / Breakage
          </h3>
          <button onClick={onClose} className="text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer">✕</button>
        </div>

        <div className="space-y-3">
          {/* Select Item */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Select Stone / Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] font-semibold focus:outline-hidden focus:border-[#2588E8]"
            >
              <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">Select</option>
              {inventoryItems.map((itm) => (
                <option key={itm.id} value={itm.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                  {itm.name} ({itm.code}) - {itm.primaryUnit}
                </option>
              ))}
            </select>
          </div>

          {/* Location / Godown */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#2588E8]" />
              Source Godown / Yard
            </label>
            {locations.length > 0 ? (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] font-semibold focus:outline-hidden focus:border-[#2588E8]"
              >
                <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">Select</option>
                {locations.filter((l) => l.isActive).map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                    {loc.name} ({loc.code}) - {loc.type}{loc.isDefault ? ' ★ (Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[#7F98AE] italic p-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-xl border border-[rgba(112,185,245,0.25)]">
                Default Location (Main Factory / Yard)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Wastage Type */}
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Wastage Nature</label>
              <select
                value={wastageType}
                onChange={(e) => setWastageType(e.target.value)}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8]"
              >
                <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">Select</option>
                <option value="BREAKAGE" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">Slab Breakage</option>
                <option value="CUTTING_LOSS" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">Edge / Cutting Loss</option>
                <option value="DEFECTIVE_CRACK" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">Crack / Surface Defect</option>
                <option value="HANDLING_LOSS" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">Transit / Handling Loss</option>
                <option value="OTHER" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">Other Adjustment</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Date</label>
              <DateInput
                value={date}
                onChange={setDate}
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)] text-[#FFFFFF]"
              />
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Wastage Quantity ({selectedItem?.primaryUnit || 'SQFT'}) *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 font-mono text-base font-bold text-[#fca5a5] focus:outline-hidden focus:border-[#2588E8]"
            />
            {selectedItem?.conversionFactor && selectedItem?.alternateUnit && (
              <span className="text-[11px] text-[#7F98AE] mt-1 block">
                Approx equivalent: {(quantity / selectedItem.conversionFactor).toFixed(2)} {selectedItem.alternateUnit}
              </span>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Notes / Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unloading forklift impact damage"
              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
          </div>

          {/* Auto Post Accounting Voucher */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <div>
              <div className="font-semibold text-[#FFFFFF]">Create Stock Loss Voucher</div>
              <div className="text-[10px] text-[#7F98AE]">
                Dr: Factory Wastage &amp; Breakage Loss / Cr: Stock in Hand
              </div>
            </div>
            <input
              type="checkbox"
              checked={createVoucher}
              onChange={(e) => setCreateVoucher(e.target.checked)}
              className="w-4 h-4 rounded text-[#2588E8] focus:ring-[#2588E8] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)] cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(112,185,245,0.25)]">
          <button
            onClick={handleRecordWastage}
            className="bg-[#421d23] hover:bg-rose-900 text-[#fca5a5] border border-rose-800/60 font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer text-xs transition"
          >
            <Scissors className="w-3.5 h-3.5" />
            Commit Wastage Record
          </button>
          <button
            onClick={onClose}
            className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-4 py-2 rounded-xl text-xs font-semibold border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Reusable Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        itemDetails={confirmModal.details}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
