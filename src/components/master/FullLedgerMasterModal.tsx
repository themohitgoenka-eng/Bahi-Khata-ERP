import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { Ledger, AccountGroup, CityMasterItem } from '../../types';
import { Layers, X, Check, AlertTriangle, Plus, Building2, MapPin, Phone, CreditCard, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SearchableDropdown } from '../common/SearchableDropdown';
import { FullAccountGroupModal } from './FullAccountGroupModal';
import { FullCityModal } from './FullCityModal';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullLedgerMasterModalProps {
  isOpen: boolean;
  initialName?: string;
  defaultGroupId?: string;
  onClose: () => void;
  onCreated: (createdLedger: Ledger) => void;
}

export const FullLedgerMasterModal: React.FC<FullLedgerMasterModalProps> = ({
  isOpen,
  initialName = '',
  defaultGroupId,
  onClose,
  onCreated,
}) => {
  const { currentCompany, accountGroups, ledgers, cities, states, showNotification, refreshActiveData } = useApp();

  const [name, setName] = useState(initialName);
  const [groupId, setGroupId] = useState(defaultGroupId || 'grp-sundry-debtors');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('DR');

  // 2-Column Opening Balance for Pakka and Kacha
  const [openingBalancePakka, setOpeningBalancePakka] = useState<string>('0');
  const [openingBalancePakkaType, setOpeningBalancePakkaType] = useState<'DR' | 'CR'>('DR');
  const [openingBalanceKacha, setOpeningBalanceKacha] = useState<string>('0');
  const [openingBalanceKachaType, setOpeningBalanceKachaType] = useState<'DR' | 'CR'>('DR');

  // Contact & Statutory Details
  const [city, setCity] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Bank Details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');

  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-modals for inline "+ Add"
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen: isOpen && !isGroupModalOpen && !isCityModalOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!name.trim()) {
      showNotification('Data is needed in "Ledger Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => nameInputRef.current?.focus(), 80);
      return;
    }
    if (!groupId) {
      showNotification('Data is needed in "Account Group" field.', 'error');
      setShowEscapeConfirm(false);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  const isDebtorOrCreditor = useMemo(() => {
    const grp = accountGroups.find((g) => g.id === groupId);
    const grpName = (grp?.name || '').toLowerCase();
    const grpType = (grp?.accountType || '').toLowerCase();
    return (
      groupId === 'grp-sundry-debtors' ||
      groupId === 'grp-sundry-creditors' ||
      grpName.includes('debtor') ||
      grpName.includes('creditor') ||
      grpName.includes('customer') ||
      grpName.includes('supplier') ||
      grpType.includes('debtor') ||
      grpType.includes('creditor')
    );
  }, [groupId, accountGroups]);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      if (defaultGroupId) {
        setGroupId(defaultGroupId);
      } else if (accountGroups.length > 0 && !groupId) {
        setGroupId(accountGroups[0].id);
      }
      const t = setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialName, defaultGroupId]);

  // Auto-set DR/CR default based on group nature
  useEffect(() => {
    const grp = accountGroups.find((g) => g.id === groupId);
    if (grp) {
      const isCredit = groupId === 'grp-sundry-creditors' || grp.nature === 'CREDIT';
      const defType = isCredit ? 'CR' : 'DR';
      setOpeningBalanceType(defType);
      setOpeningBalancePakkaType(defType);
      setOpeningBalanceKachaType(defType);
    }
  }, [groupId, accountGroups]);

  if (!isOpen) return null;

  const cleanName = name.trim();
  const isDuplicate = Boolean(
    cleanName && ledgers.some((l) => l.name.trim().toLowerCase() === cleanName.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName) {
      showNotification('Please enter a Ledger Name.', 'error');
      return;
    }
    if (isDuplicate) {
      showNotification(`Warning: A ledger named "${cleanName}" already exists.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedGroup = accountGroups.find((g) => g.id === groupId);

      // Compute combined net opening balance
      const pDr = openingBalancePakkaType === 'DR' ? (parseFloat(openingBalancePakka) || 0) : -(parseFloat(openingBalancePakka) || 0);
      const kDr = openingBalanceKachaType === 'DR' ? (parseFloat(openingBalanceKacha) || 0) : -(parseFloat(openingBalanceKacha) || 0);
      const netCombinedDr = pDr + kDr;
      const finalBal = isDebtorOrCreditor ? Math.abs(netCombinedDr) : (parseFloat(openingBalance) || 0);
      const finalType: 'DR' | 'CR' = isDebtorOrCreditor ? (netCombinedDr >= 0 ? 'DR' : 'CR') : openingBalanceType;

      const now = new Date().toISOString();
      const newLedger: Ledger = {
        id: `led-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uuid: uuidv4(),
        companyId: currentCompany?.id || 'comp-default',
        groupId: groupId,
        name: cleanName,
        accountType: selectedGroup?.accountType || 'SUNDRY_CREDITOR',
        openingBalance: finalBal,
        openingBalanceType: finalType,
        openingBalancePakka: isDebtorOrCreditor ? (parseFloat(openingBalancePakka) || 0) : undefined,
        openingBalancePakkaType: isDebtorOrCreditor ? openingBalancePakkaType : undefined,
        openingBalanceKacha: isDebtorOrCreditor ? (parseFloat(openingBalanceKacha) || 0) : undefined,
        openingBalanceKachaType: isDebtorOrCreditor ? openingBalanceKachaType : undefined,
        city: city.trim(),
        state: state.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        bankDetails: (accountNumber || bankName || ifscCode) ? {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifscCode.trim().toUpperCase(),
          branch: branch.trim(),
        } : undefined,
        isActive,
        createdAt: now,
        updatedAt: now,
      };

      await dbStorage.saveLedger(newLedger);
      await refreshActiveData();
      showNotification(`Ledger "${newLedger.name}" created successfully!`, 'success');
      onCreated(newLedger);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create ledger.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999999] bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF]">
        {/* Header */}
        <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">Create New Ledger Master</h2>
              <p className="text-[10px] text-[#7F98AE]">Original Master Form &bull; Complete balances, contact &amp; statutory details</p>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Basic Info: Name & Group */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Ledger Name <span className="text-rose-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mahadev Marble &amp; Granite Corp / State Bank of India"
                className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8] font-semibold"
              />
              {isDuplicate && (
                <div className="mt-1.5 p-2 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10px] flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>A ledger named &quot;{cleanName}&quot; already exists.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Account Group <span className="text-rose-400">*</span>
              </label>
              <SearchableDropdown
                id="full_ledger_group_select"
                value={groupId}
                onChange={(selectedGId) => setGroupId(selectedGId)}
                options={accountGroups.map((g) => ({
                  value: g.id,
                  label: g.name,
                  badge: g.nature,
                }))}
                placeholder="-- Select Group --"
                addOptionLabel="+ Add Account Group..."
                onAddOption={() => setIsGroupModalOpen(true)}
                buttonClassName="h-[34px] text-xs font-semibold"
              />
            </div>
          </div>

          {/* 2. Opening Balance Section */}
          {isDebtorOrCreditor ? (
            <div className="p-3.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/30 rounded-xl space-y-2.5">
              <div className="text-[11px] font-bold text-[#2588E8] uppercase tracking-wider border-b border-[rgba(112,185,245,0.25)] pb-1.5 flex items-center justify-between">
                <span>Opening Balance Breakdown</span>
                <span className="text-[10px] text-[#7F98AE] font-normal lowercase">(pakka + kacha)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Pakka */}
                <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-2.5 rounded-xl border border-emerald-500/30 space-y-1">
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase">
                    1. Pakka (Official)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      value={openingBalancePakka}
                      onChange={(e) => setOpeningBalancePakka(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/40 rounded-lg p-1.5 text-xs text-white font-mono focus:outline-hidden"
                    />
                    <select
                      value={openingBalancePakkaType}
                      onChange={(e) => setOpeningBalancePakkaType(e.target.value as 'DR' | 'CR')}
                      className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/40 rounded-lg px-2 text-xs font-bold text-emerald-400 cursor-pointer"
                    >
                      <option value="DR">Dr</option>
                      <option value="CR">Cr</option>
                    </select>
                  </div>
                </div>

                {/* 2. Kacha */}
                <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-2.5 rounded-xl border border-amber-500/30 space-y-1">
                  <label className="block text-[10px] font-bold text-amber-300 uppercase">
                    2. Kacha (Internal)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      value={openingBalanceKacha}
                      onChange={(e) => setOpeningBalanceKacha(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-amber-500/40 rounded-lg p-1.5 text-xs text-white font-mono focus:outline-hidden"
                    />
                    <select
                      value={openingBalanceKachaType}
                      onChange={(e) => setOpeningBalanceKachaType(e.target.value as 'DR' | 'CR')}
                      className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-amber-500/40 rounded-lg px-2 text-xs font-bold text-amber-400 cursor-pointer"
                    >
                      <option value="DR">Dr</option>
                      <option value="CR">Cr</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Combined Total */}
              {(() => {
                const p = openingBalancePakkaType === 'DR' ? (Number(openingBalancePakka) || 0) : -(Number(openingBalancePakka) || 0);
                const k = openingBalanceKachaType === 'DR' ? (Number(openingBalanceKacha) || 0) : -(Number(openingBalanceKacha) || 0);
                const net = p + k;
                const netVal = Math.abs(net);
                const netType = net >= 0 ? 'DR' : 'CR';
                return (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-xl text-xs font-mono border border-[rgba(112,185,245,0.25)]">
                    <span className="text-[#7F98AE] font-semibold text-[10px]">Net Total Balance:</span>
                    <span className="font-bold text-[#FFFFFF]">
                      ₹{netVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                      <span className={netType === 'DR' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {netType === 'DR' ? 'Dr.' : 'Cr.'}
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-1">
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase">Opening Balance</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-[#2588E8]"
                />
                <select
                  value={openingBalanceType}
                  onChange={(e) => setOpeningBalanceType(e.target.value as 'DR' | 'CR')}
                  className="bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 text-xs font-bold text-[#2588E8] cursor-pointer"
                >
                  <option value="DR">Dr</option>
                  <option value="CR">Cr</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. City, State & PIN */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2.5">
            <div className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider">
              Location &amp; Address
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  City / Town
                </label>
                <SearchableDropdown
                  id="full_ledger_city_select"
                  value={city}
                  onChange={(selectedCity) => {
                    setCity(selectedCity);
                    const foundCity = cities.find((c) => c.cityName === selectedCity);
                    if (foundCity?.stateName) {
                      setState(foundCity.stateName);
                    }
                  }}
                  options={cities.map((c) => ({
                    value: c.cityName,
                    label: c.cityName,
                    subLabel: c.stateName,
                  }))}
                  placeholder="Select City"
                  addOptionLabel="+ Add City..."
                  onAddOption={() => setIsCityModalOpen(true)}
                  buttonClassName="h-[32px] text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-[32px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  {states.map((st) => (
                    <option key={st.code} value={st.name} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  PIN Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 326519"
                  className="w-full h-[32px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 text-xs text-white font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                Full Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, Industrial Area, Quarry Plot No..."
                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>
          </div>

          {/* 4. Contact, GSTIN & PAN */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2.5">
            <div className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider">
              Statutory &amp; Contact Details
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  Mobile / Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9829012345"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="office@example.com"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="08AAAAA0000A1Z5"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  PAN
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>
            </div>
          </div>

          {/* 5. Bank Account Details */}
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2.5">
            <div className="text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider">
              Bank Details (Optional)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="SBIN0001234"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7F98AE] uppercase mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch Name"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(112,185,245,0.25)]">
            <button
              type="submit"
              disabled={isSubmitting || isDuplicate}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Select Ledger'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#7F98AE] hover:text-white hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Inline Group Modal */}
      <FullAccountGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreated={(newGroup) => {
          setGroupId(newGroup.id);
          setIsGroupModalOpen(false);
          setTimeout(() => {
            document.getElementById('full_ledger_group_select')?.focus();
          }, 60);
        }}
      />

      {/* Inline City Modal */}
      <FullCityModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
        onCreated={(newCity) => {
          setCity(newCity.cityName);
          setState(newCity.stateName);
          setIsCityModalOpen(false);
          setTimeout(() => {
            document.getElementById('full_ledger_city_select')?.focus();
          }, 60);
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title="Save Ledger Before Closing?"
        message={`Do you want to save "${cleanName || 'New Ledger'}" before closing this form?`}
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
