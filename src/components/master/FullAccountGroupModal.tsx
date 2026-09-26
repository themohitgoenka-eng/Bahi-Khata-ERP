import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { AccountGroup } from '../../types';
import { FolderPlus, X, Check, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';

interface FullAccountGroupModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (createdGroup: AccountGroup) => void;
}

export const FullAccountGroupModal: React.FC<FullAccountGroupModalProps> = ({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}) => {
  const { currentCompany, accountGroups, showNotification, refreshActiveData } = useApp();

  const [groupName, setGroupName] = useState(initialName);
  const [parentGroupId, setParentGroupId] = useState('');
  const [accountType, setAccountType] = useState('CURRENT_ASSET');
  const [nature, setNature] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  const groupNameInputRef = useRef<HTMLInputElement>(null);

  // Intercept Escape key
  useFormEscapeClose({
    isOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!groupName.trim()) {
      showNotification('Data is needed in "Group Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => groupNameInputRef.current?.focus(), 80);
      return;
    }
    setShowEscapeConfirm(false);
    handleSubmit(new Event('submit') as any);
  };

  useEffect(() => {
    if (isOpen) {
      setGroupName(initialName);
      if (accountGroups.length > 0) {
        const defaultParent = accountGroups[0];
        setParentGroupId(defaultParent.id);
        setAccountType(defaultParent.accountType);
        setNature(defaultParent.nature);
      }
      const t = setTimeout(() => {
        groupNameInputRef.current?.focus();
        groupNameInputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialName, accountGroups]);

  if (!isOpen) return null;

  const cleanName = groupName.trim();
  const isDuplicate = Boolean(
    cleanName && accountGroups.some((g) => g.name.trim().toLowerCase() === cleanName.toLowerCase())
  );

  const handleParentGroupChange = (pid: string) => {
    setParentGroupId(pid);
    const p = accountGroups.find((g) => g.id === pid);
    if (p) {
      setAccountType(p.accountType);
      setNature(p.nature);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName) {
      showNotification('Please enter Group Name.', 'error');
      return;
    }
    if (isDuplicate) {
      showNotification(`Account Group "${cleanName}" already exists.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const parent = accountGroups.find((g) => g.id === parentGroupId);
      const targetAccountType = parent?.accountType || accountType;
      const targetNature = parent?.nature || nature;

      const newGroup: AccountGroup = {
        id: `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uuid: uuidv4(),
        companyId: currentCompany?.id || 'comp-default',
        name: cleanName,
        parentGroupId: parentGroupId || null,
        accountType: targetAccountType,
        isPrimary: !parentGroupId,
        nature: targetNature,
      };

      await dbStorage.saveAccountGroup(newGroup);
      await dbStorage.logAudit(
        'CREATE',
        'ACCOUNT_GROUP',
        newGroup.id,
        `Created account group: ${newGroup.name}`
      );

      await refreshActiveData();
      showNotification(`Account Group "${newGroup.name}" created successfully!`, 'success');
      onCreated(newGroup);
      onClose();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save account group.', 'error');
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
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF]">Create New Account Group</h2>
              <p className="text-[10px] text-[#7F98AE]">Chart of Accounts &bull; Hierarchical Ledger Classification</p>
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
          {/* Group Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Group Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={groupNameInputRef}
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Quarry Machinery, Factory Overheads, Sundry Creditors (Kota)"
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
            {isDuplicate && (
              <div className="mt-1.5 p-2 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10px] flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>An account group named &quot;{cleanName}&quot; already exists.</span>
              </div>
            )}
          </div>

          {/* Primary / Parent Group */}
          <div>
            <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
              Primary / Parent Group <span className="text-rose-400">*</span>
            </label>
            <select
              value={parentGroupId}
              onChange={(e) => handleParentGroupChange(e.target.value)}
              className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
            >
              <option value="">-- Direct Primary Group --</option>
              {accountGroups.map((g) => (
                <option key={g.id} value={g.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Read-Only Account Type and Nature Derived from Parent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Account Type <span className="text-[10px] font-normal text-[#7F98AE]">(auto)</span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={accountType ? accountType.replace(/_/g, ' ') : ''}
                className="w-full bg-[#0D231A] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-[#B7C9D9] font-medium cursor-not-allowed select-none opacity-85"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                Balance Nature <span className="text-[10px] font-normal text-[#7F98AE]">(auto)</span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={nature === 'DEBIT' ? 'DEBIT (Dr.)' : 'CREDIT (Cr.)'}
                className={`w-full bg-[#0D231A] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs font-bold cursor-not-allowed select-none opacity-85 ${
                  nature === 'DEBIT' ? 'text-amber-400' : 'text-emerald-400'
                }`}
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
              <span>{isSubmitting ? 'Saving...' : 'Save Group'}</span>
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
        title="Save Account Group Before Closing?"
        message={`Do you want to save "${cleanName || 'New Group'}" before closing this form?`}
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
