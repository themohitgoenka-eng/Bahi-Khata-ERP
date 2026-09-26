import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { CityMasterItem } from '../../types';
import { MapPin, X, Check, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullCityModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (createdCity: CityMasterItem) => void;
}

export const FullCityModal: React.FC<FullCityModalProps> = ({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}) => {
  const { currentCompany, cities, states, saveCity, showNotification } = useApp();

  const [cityName, setCityName] = useState(initialName);
  const [stateName, setStateName] = useState('Rajasthan');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  const cityInputRef = useRef<HTMLInputElement>(null);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!cityName.trim()) {
      showNotification('Data is needed in "City / Town Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => cityInputRef.current?.focus(), 80);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  useEffect(() => {
    if (isOpen) {
      setCityName(initialName);
      const t = setTimeout(() => {
        cityInputRef.current?.focus();
        cityInputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const isDuplicate = Boolean(
    cityName.trim() &&
    cities.some(
      (c) =>
        c.cityName.trim().toLowerCase() === cityName.trim().toLowerCase() &&
        c.stateName.trim().toLowerCase() === stateName.trim().toLowerCase()
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCity = cityName.trim();
    if (!cleanCity) {
      showNotification('Please enter City / Town Name.', 'error');
      return;
    }
    if (isDuplicate) {
      showNotification(`City "${cleanCity}" already exists in ${stateName}.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedStateObj = states.find((s) => s.name === stateName);
      const now = new Date().toISOString();

      const newCity: CityMasterItem = {
        id: `city-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        cityName: cleanCity,
        stateName: stateName,
        stateCode: selectedStateObj?.code || '',
        district: district.trim() || undefined,
        pincode: pincode.trim() || undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await saveCity(newCity);
      showNotification(`City "${cleanCity}" saved successfully!`, 'success');
      onCreated(newCity);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save city.', 'error');
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
            <div className="w-8 h-8 rounded-xl bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">Add New City / Town</h2>
              <p className="text-[10px] text-[#7F98AE]">Master configuration &bull; Auto-links into Ledgers &amp; Locations</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* City Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              City / Town Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={cityInputRef}
              type="text"
              required
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="e.g. Ramganj Mandi, Kota, Udaipur"
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
            {isDuplicate && (
              <div className="mt-1.5 p-2 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10px] flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>This city already exists in {stateName}.</span>
              </div>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              State / Union Territory <span className="text-rose-400">*</span>
            </label>
            <select
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
            >
              {states.map((st) => (
                <option key={st.code} value={st.name} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-white">
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>

          {/* District & PIN Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                District (Optional)
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Kota"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                PIN Code (Optional)
              </label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 326519"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(112,185,245,0.25)]">
            <button
              type="submit"
              disabled={isSubmitting || isDuplicate}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save City'}</span>
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
        title="Save City Before Closing?"
        message={`Do you want to save "${cityName.trim() || 'New City'}" before closing this form?`}
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
