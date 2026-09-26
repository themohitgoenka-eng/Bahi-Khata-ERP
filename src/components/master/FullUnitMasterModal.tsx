import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { ItemUnit } from '../../types';
import { Scale, X, Check, AlertTriangle } from 'lucide-react';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullUnitMasterModalProps {
  isOpen: boolean;
  initialSymbol?: string;
  onClose: () => void;
  onCreated: (createdUnit: ItemUnit) => void;
}

export const FullUnitMasterModal: React.FC<FullUnitMasterModalProps> = ({
  isOpen,
  initialSymbol = '',
  onClose,
  onCreated,
}) => {
  const { showNotification, refreshActiveData } = useApp();

  const [symbol, setSymbol] = useState(initialSymbol);
  const [formalName, setFormalName] = useState('');
  const [decimalPlaces, setDecimalPlaces] = useState<number>(2);
  const [existingUnits, setExistingUnits] = useState<ItemUnit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  const symbolInputRef = useRef<HTMLInputElement>(null);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!symbol.trim()) {
      showNotification('Data is needed in "Unit Symbol" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => symbolInputRef.current?.focus(), 80);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol.toUpperCase());
      dbStorage.getItemUnits().then((units) => {
        setExistingUnits(units || []);
      });
      const t = setTimeout(() => {
        symbolInputRef.current?.focus();
        symbolInputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialSymbol]);

  if (!isOpen) return null;

  const cleanSym = symbol.trim().toUpperCase();
  const isDuplicate = Boolean(
    cleanSym && existingUnits.some((u) => u.symbol?.toUpperCase() === cleanSym || u.name?.toUpperCase() === cleanSym)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanSym) {
      showNotification('Please enter Unit Symbol / Code.', 'error');
      return;
    }
    if (isDuplicate) {
      showNotification(`Unit "${cleanSym}" already exists.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUnit: ItemUnit = {
        id: `unit-${cleanSym.toLowerCase()}-${Date.now()}`,
        name: formalName.trim() || cleanSym,
        symbol: cleanSym,
        decimalPlaces: Number(decimalPlaces) || 0,
      };

      await dbStorage.saveItemUnit(newUnit);
      await refreshActiveData();
      showNotification(`Unit "${cleanSym}" created successfully!`, 'success');
      onCreated(newUnit);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save unit.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999999] bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF]">
        {/* Header */}
        <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">Add New Measurement Unit</h2>
              <p className="text-[10px] text-[#7F98AE]">Measurement &bull; Used in Item Master, Billing &amp; Stock</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* Unit Symbol */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Unit Symbol / Code <span className="text-rose-400">*</span>
            </label>
            <input
              ref={symbolInputRef}
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. SQFT, PCS, BOX, NOS, TON, KG, MTR"
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white font-mono uppercase placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
            {isDuplicate && (
              <div className="mt-1.5 p-2 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10px] flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Unit &quot;{cleanSym}&quot; already exists in master.</span>
              </div>
            )}
          </div>

          {/* Formal Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Formal Name (Full Description)
            </label>
            <input
              type="text"
              value={formalName}
              onChange={(e) => setFormalName(e.target.value)}
              placeholder="e.g. Square Feet, Number of Pieces, Metric Ton"
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
          </div>

          {/* Decimal Places */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Decimal Places
            </label>
            <select
              value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(Number(e.target.value))}
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
            >
              <option value={0} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">0 (Whole numbers e.g. 100 PCS)</option>
              <option value={2} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">2 (Standard e.g. 100.50 SQFT)</option>
              <option value={3} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">3 (High precision e.g. 1.250 TON / KG)</option>
              <option value={4} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">4 (Ultra precision)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(112,185,245,0.25)]">
            <button
              type="submit"
              disabled={isSubmitting || isDuplicate}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Unit'}</span>
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

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title="Save Unit Before Closing?"
        message={`Do you want to save "${cleanSym || 'New Unit'}" before closing this form?`}
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
