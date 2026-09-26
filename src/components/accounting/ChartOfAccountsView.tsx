import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { Ledger, AccountGroup, AccountType } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import {
  FolderTree,
  Folder,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Building2,
  Layers,
  CheckCircle2,
  X,
  Save,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const ChartOfAccountsView: React.FC = () => {
  const { currentCompany, accountGroups, ledgers, refreshActiveData, showNotification, cities, states, setActiveTab } = useApp();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'grp-assets': true,
    'grp-curr-assets': true,
    'grp-liabilities': true,
    'grp-curr-liab': true,
    'grp-capital': true,
    'grp-direct-exp': true,
    'grp-indirect-exp': true,
    'grp-direct-inc': true,
  });

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

  // Account Group Modal State
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [parentGroupId, setParentGroupId] = useState<string>('');
  const [groupAccountType, setGroupAccountType] = useState<AccountType | ''>('');
  const [groupNature, setGroupNature] = useState<'DEBIT' | 'CREDIT' | ''>('');

  const ledgerNameInputRef = useRef<HTMLInputElement>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ledgerModalOpen) {
      const t1 = setTimeout(() => ledgerNameInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => ledgerNameInputRef.current?.focus(), 160);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [ledgerModalOpen]);

  useEffect(() => {
    if (groupModalOpen) {
      const t1 = setTimeout(() => groupNameInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => groupNameInputRef.current?.focus(), 160);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [groupModalOpen]);

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

  // Form State
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('ASSET');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('DR');
  const [openingBalancePakka, setOpeningBalancePakka] = useState<number>(0);
  const [openingBalancePakkaType, setOpeningBalancePakkaType] = useState<'DR' | 'CR'>('DR');
  const [openingBalanceKacha, setOpeningBalanceKacha] = useState<number>(0);
  const [openingBalanceKachaType, setOpeningBalanceKachaType] = useState<'DR' | 'CR'>('DR');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');

  const isDebtorOrCreditorGroup = (gId: string): boolean => {
    const grp = accountGroups.find((g) => g.id === gId);
    if (!grp) return false;
    const nameLower = grp.name.toLowerCase();
    return (
      gId === 'grp-sundry-debtors' ||
      gId === 'grp-sundry-creditors' ||
      grp.accountType === 'SUNDRY_DEBTOR' ||
      grp.accountType === 'SUNDRY_CREDITOR' ||
      nameLower.includes('debtor') ||
      nameLower.includes('creditor') ||
      nameLower.includes('customer') ||
      nameLower.includes('supplier')
    );
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to prevent circular group hierarchy
  const getDescendantGroupIds = (startGroupId: string): Set<string> => {
    const ids = new Set<string>();
    const stack = [startGroupId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const children = accountGroups.filter((g) => g.parentGroupId === currentId);
      for (const child of children) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          stack.push(child.id);
        }
      }
    }
    return ids;
  };

  const openNewGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setParentGroupId('');
    setGroupAccountType('');
    setGroupNature('');
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (grp: AccountGroup) => {
    setEditingGroup(grp);
    setGroupName(grp.name);
    setParentGroupId(grp.parentGroupId || '');
    setGroupAccountType(grp.accountType);
    setGroupNature(grp.nature);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      showNotification('Please enter an account group name.', 'error');
      return;
    }

    if (!parentGroupId && !editingGroup?.isPrimary) {
      showNotification('Please select a Primary Group.', 'error');
      return;
    }

    const trimmedGroupName = groupName.trim().toLowerCase();
    const duplicateGroup = accountGroups.find(
      (g) => g.id !== editingGroup?.id && g.name.trim().toLowerCase() === trimmedGroupName
    );
    if (duplicateGroup) {
      showNotification(`Warning: An account group named "${groupName.trim()}" already exists. Duplicate group names are not allowed.`, 'error');
      return;
    }

    const parentGroup = accountGroups.find((g) => g.id === parentGroupId);
    const targetAccountType: AccountType = (parentGroup ? parentGroup.accountType : (groupAccountType || 'ASSET')) as AccountType;
    const targetNature: 'DEBIT' | 'CREDIT' = (parentGroup ? parentGroup.nature : (groupNature || 'DEBIT')) as 'DEBIT' | 'CREDIT';
    const isEdit = !!editingGroup;

    setConfirmModal({
      isOpen: true,
      type: isEdit ? 'EDIT' : 'ADD',
      title: isEdit ? 'Confirm Edit Account Group' : 'Confirm Add New Account Group',
      message: isEdit
        ? `Are you sure you want to update group "${groupName.trim()}"?`
        : `Are you sure you want to create a new group "${groupName.trim()}"?`,
      details: [
        { label: 'Group Name', value: groupName.trim() },
        { label: 'Primary Group', value: parentGroup?.name || (editingGroup?.isPrimary ? 'Primary Group' : 'None') },
        { label: 'Account Type', value: targetAccountType },
        { label: 'Nature', value: targetNature },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const now = new Date().toISOString();

          const newGroup: AccountGroup = {
            id: editingGroup?.id || `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            uuid: editingGroup?.uuid || uuidv4(),
            companyId: currentCompany?.id || 'comp-default',
            name: groupName.trim(),
            parentGroupId: parentGroupId || null,
            accountType: targetAccountType,
            isPrimary: !parentGroupId,
            nature: targetNature,
          };

          await dbStorage.saveAccountGroup(newGroup);

          // If updating group, ensure ledgers in this group stay in sync with the group's account type
          if (isEdit) {
            const affectedLedgers = ledgers.filter((l) => l.groupId === newGroup.id);
            for (const led of affectedLedgers) {
              if (led.accountType !== targetAccountType) {
                await dbStorage.saveLedger({
                  ...led,
                  accountType: targetAccountType,
                  updatedAt: now,
                });
              }
            }
          }

          await dbStorage.logAudit(
            isEdit ? 'EDIT' : 'CREATE',
            'ACCOUNT_GROUP',
            newGroup.id,
            `${isEdit ? 'Updated' : 'Created'} account group: ${newGroup.name}`
          );

          showNotification(`Account Group "${newGroup.name}" ${isEdit ? 'updated' : 'created'} successfully.`, 'success');
          setGroupName('');
          setParentGroupId('');
          setGroupAccountType('');
          setGroupNature('');
          setEditingGroup(null);
          setGroupModalOpen(false);
          await refreshActiveData();
          if (ledgerModalOpen) {
            setGroupId(newGroup.id);
            setAccountType(newGroup.accountType);
          }
        } catch (err: any) {
          showNotification(err.message || 'Failed to save account group.', 'error');
        }
      },
    });
  };

  const handleDeleteGroup = (group: AccountGroup) => {
    const subGroups = accountGroups.filter((g) => g.parentGroupId === group.id);
    const groupLedgers = ledgers.filter((l) => l.groupId === group.id);

    if (groupLedgers.length > 0) {
      showNotification(
        `Cannot delete group "${group.name}". It contains ${groupLedgers.length} active ledger(s). Move or delete those ledgers first.`,
        'error'
      );
      return;
    }
    if (subGroups.length > 0) {
      showNotification(
        `Cannot delete group "${group.name}". It has ${subGroups.length} sub-group(s). Delete or move those sub-groups first.`,
        'error'
      );
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Delete Account Group',
      message: `Are you sure you want to permanently delete the account group "${group.name}"?`,
      details: [
        { label: 'Group Name', value: group.name },
        { label: 'Account Type', value: group.accountType },
        { label: 'Nature', value: group.nature },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await dbStorage.deleteAccountGroup(group.id);
          await dbStorage.logAudit('CANCEL', 'ACCOUNT_GROUP', group.id, `Deleted account group: ${group.name}`);
          showNotification(`Account Group "${group.name}" deleted successfully.`, 'info');
          await refreshActiveData();
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete account group.', 'error');
        }
      },
    });
  };

  const openNewLedgerModal = (defaultGroupId?: string) => {
    refreshActiveData();
    setEditingLedger(null);
    setName('');
    const targetGId = defaultGroupId || '';
    setGroupId(targetGId);
    const grp = accountGroups.find((g) => g.id === targetGId);
    const isCreditor = targetGId === 'grp-sundry-creditors' || grp?.nature === 'CREDIT';
    setAccountType(grp?.accountType || 'ASSET');
    setOpeningBalance(0);
    setOpeningBalanceType(isCreditor ? 'CR' : 'DR');
    setOpeningBalancePakka(0);
    setOpeningBalancePakkaType(isCreditor ? 'CR' : 'DR');
    setOpeningBalanceKacha(0);
    setOpeningBalanceKachaType(isCreditor ? 'CR' : 'DR');
    setCity('');
    setState('');
    setPhone('');
    setContactPerson('');
    setNotes('');
    setLedgerModalOpen(true);
  };

  const handleCityChange = (newCityName: string) => {
    setCity(newCityName);
    const matched = cities.find(
      (c) => c.cityName.trim().toLowerCase() === newCityName.trim().toLowerCase()
    );
    if (matched) {
      setState(matched.stateName);
    }
  };

  const openEditLedgerModal = (ledger: Ledger) => {
    setEditingLedger(ledger);
    setName(ledger.name);
    setGroupId(ledger.groupId);
    setAccountType(ledger.accountType);
    setOpeningBalance(ledger.openingBalance);
    setOpeningBalanceType(ledger.openingBalanceType);
    setOpeningBalancePakka(
      ledger.openingBalancePakka !== undefined ? ledger.openingBalancePakka : 0
    );
    setOpeningBalancePakkaType(ledger.openingBalancePakkaType || 'DR');
    setOpeningBalanceKacha(ledger.openingBalanceKacha !== undefined ? ledger.openingBalanceKacha : 0);
    setOpeningBalanceKachaType(ledger.openingBalanceKachaType || 'DR');
    setCity(ledger.city || '');
    setState(ledger.state || '');
    setPhone(ledger.phone || '');
    setContactPerson(ledger.contactPerson || '');
    setNotes(ledger.notes || '');
    setLedgerModalOpen(true);
  };

  const handleSaveLedger = () => {
    if (!name.trim()) {
      showNotification('Ledger name is required.', 'error');
      return;
    }
    if (!groupId) {
      showNotification('Please select an account group.', 'error');
      return;
    }

    const trimmedName = name.trim().toLowerCase();
    const duplicateLedger = ledgers.find(
      (l) => l.id !== editingLedger?.id && l.name.trim().toLowerCase() === trimmedName
    );
    if (duplicateLedger) {
      showNotification(`Warning: A ledger named "${name.trim()}" already exists. Duplicate ledger names are not allowed.`, 'error');
      return;
    }

    const targetGroup = accountGroups.find((g) => g.id === groupId);
    const isEdit = !!editingLedger;
    const isDebtorOrCreditor = isDebtorOrCreditorGroup(groupId);

    // Calculate combined net opening balance for Debtors & Creditors
    const pDr = openingBalancePakkaType === 'DR' ? (Number(openingBalancePakka) || 0) : -(Number(openingBalancePakka) || 0);
    const kDr = openingBalanceKachaType === 'DR' ? (Number(openingBalanceKacha) || 0) : -(Number(openingBalanceKacha) || 0);
    const netCombinedDr = pDr + kDr;
    const finalOpeningBal = isDebtorOrCreditor ? Math.abs(netCombinedDr) : (Number(openingBalance) || 0);
    const finalOpeningType: 'DR' | 'CR' = isDebtorOrCreditor ? (netCombinedDr >= 0 ? 'DR' : 'CR') : openingBalanceType;

    const modalDetails = [
      { label: 'Ledger Name', value: name.trim() },
      { label: 'Group', value: targetGroup?.name || groupId },
      ...(isDebtorOrCreditor
        ? [
            { label: '1. Pakka Opening', value: `₹${(Number(openingBalancePakka) || 0).toFixed(2)} ${openingBalancePakkaType}` },
            { label: '2. Kacha Opening', value: `₹${(Number(openingBalanceKacha) || 0).toFixed(2)} ${openingBalanceKachaType}` },
            { label: 'Net Total Opening', value: `₹${finalOpeningBal.toFixed(2)} ${finalOpeningType}` },
          ]
        : [{ label: 'Opening Balance', value: `₹${Number(openingBalance).toFixed(2)} ${openingBalanceType}` }]),
      { label: 'City / State', value: [city, state].filter(Boolean).join(', ') || '-' },
    ];

    setConfirmModal({
      isOpen: true,
      type: isEdit ? 'EDIT' : 'ADD',
      title: isEdit ? 'Confirm Edit Ledger' : 'Confirm Add New Ledger',
      message: isEdit
        ? `Are you sure you want to update ledger "${name.trim()}"?`
        : `Are you sure you want to create a new ledger "${name.trim()}" in group "${targetGroup?.name}"?`,
      details: modalDetails,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const now = new Date().toISOString();
          const ledger: Ledger = {
            id: editingLedger?.id || `led-${Date.now()}`,
            uuid: editingLedger?.uuid || uuidv4(),
            companyId: currentCompany?.id || '',
            groupId,
            name: name.trim(),
            accountType: targetGroup?.accountType || accountType,
            openingBalance: finalOpeningBal,
            openingBalanceType: finalOpeningType,
            openingBalancePakka: isDebtorOrCreditor ? (Number(openingBalancePakka) || 0) : undefined,
            openingBalancePakkaType: isDebtorOrCreditor ? openingBalancePakkaType : undefined,
            openingBalanceKacha: isDebtorOrCreditor ? (Number(openingBalanceKacha) || 0) : undefined,
            openingBalanceKachaType: isDebtorOrCreditor ? openingBalanceKachaType : undefined,
            city,
            state,
            phone,
            contactPerson,
            notes,
            isActive: true,
            createdAt: editingLedger?.createdAt || now,
            updatedAt: now,
          };

          await dbStorage.saveLedger(ledger);
          await dbStorage.logAudit(
            isEdit ? 'EDIT' : 'CREATE',
            'LEDGER',
            ledger.id,
            `${isEdit ? 'Updated' : 'Created'} ledger account: ${ledger.name} under group ${targetGroup?.name}`
          );

          showNotification(`Ledger "${ledger.name}" ${isEdit ? 'updated' : 'created'} successfully.`, 'success');
          setName('');
          setGroupId('');
          setAccountType('ASSET');
          setOpeningBalance(0);
          setOpeningBalanceType('DR');
          setOpeningBalancePakka(0);
          setOpeningBalancePakkaType('DR');
          setOpeningBalanceKacha(0);
          setOpeningBalanceKachaType('DR');
          setCity('');
          setState('');
          setPhone('');
          setContactPerson('');
          setNotes('');
          setEditingLedger(null);
          setLedgerModalOpen(false);
          await refreshActiveData();
        } catch (err: any) {
          showNotification(err.message || 'Failed to save ledger.', 'error');
        }
      },
    });
  };

  const handleDeleteLedger = (ledger: Ledger) => {
    const targetGroup = accountGroups.find((g) => g.id === ledger.groupId);
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Delete Ledger',
      message: `Are you sure you want to permanently delete ledger "${ledger.name}"? This action cannot be undone.`,
      details: [
        { label: 'Ledger Name', value: ledger.name },
        { label: 'Group', value: targetGroup?.name || ledger.groupId },
        { label: 'Opening Balance', value: `₹${ledger.openingBalance.toFixed(2)} ${ledger.openingBalanceType}` },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await dbStorage.deleteLedger(ledger.id);
          await dbStorage.logAudit('CANCEL', 'LEDGER', ledger.id, `Deleted ledger: ${ledger.name}`);
          showNotification(`Ledger "${ledger.name}" deleted successfully.`, 'info');
          await refreshActiveData();
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete ledger.', 'error');
        }
      },
    });
  };

  // Render tree node
  const renderGroupTree = (group: AccountGroup, level: number = 0) => {
    const isExpanded = !!expandedGroups[group.id];
    const subGroups = accountGroups.filter((g) => g.parentGroupId === group.id);
    const groupLedgers = ledgers.filter((l) => l.groupId === group.id);

    return (
      <div key={group.id} className="space-y-1">
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-[rgba(57,167,255,0.08)] transition cursor-pointer text-xs ${
            level === 0 ? 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl font-bold text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] shadow-xs' : 'text-[#B7C9D9]'
          }`}
          style={{ paddingLeft: `${level * 16 + 10}px` }}
          onClick={() => toggleGroup(group.id)}
        >
          <div className="flex items-center gap-2">
            {subGroups.length > 0 || groupLedgers.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#2588E8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#7F98AE]" />
              )
            ) : (
              <span className="w-3.5 inline-block" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-[#2588E8]" />
            ) : (
              <Folder className="w-4 h-4 text-[#2588E8]" />
            )}
            <span className="font-semibold text-[#FFFFFF]">{group.name}</span>
            <span className="text-[10px] text-[#7F98AE] font-mono font-normal">
              ({group.accountType.replace('_', ' ')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#7F98AE] font-mono">
              {groupLedgers.length} Ledgers &bull; {subGroups.length} Sub-groups
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openNewGroupModal();
              }}
              title="Add Group"
              className="p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] hover:text-[#2588E8] cursor-pointer transition"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openNewLedgerModal(group.id);
              }}
              title="Add Ledger in this group"
              className="p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditGroupModal(group);
              }}
              title="Edit Group"
              className="p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteGroup(group);
              }}
              title="Delete Group"
              className="p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#fca5a5] cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Child Ledgers & Subgroups */}
        {isExpanded && (
          <div className="space-y-1">
            {groupLedgers.map((led) => (
              <div
                key={led.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[rgba(57,167,255,0.06)] text-xs transition ml-6 border border-transparent hover:border-[rgba(112,185,245,0.25)]"
                style={{ paddingLeft: `${(level + 1) * 16}px` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#2588E8]" />
                  <span className="text-[#FFFFFF] font-medium">{led.name}</span>
                  {led.city && <span className="text-[10px] text-[#7F98AE] font-normal">({led.city})</span>}
                </div>

                <div className="flex items-center gap-3">
                  {led.openingBalancePakka !== undefined || led.openingBalanceKacha !== undefined ? (
                    <div className="flex flex-col items-end gap-0.5 text-right font-mono">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-emerald-400 font-medium">
                          Pakka: ₹{(led.openingBalancePakka || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/30">
                            {led.openingBalancePakkaType || 'DR'}
                          </span>
                        </span>
                        <span className="text-[#7F98AE]">•</span>
                        <span className="text-amber-400 font-medium">
                          Kacha: ₹{(led.openingBalanceKacha || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-amber-500/30">
                            {led.openingBalanceKachaType || 'DR'}
                          </span>
                        </span>
                      </div>
                      <div className="text-[11px] text-[#B7C9D9]">
                        Net: ₹{led.openingBalance.toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] text-[#2588E8] font-bold">{led.openingBalanceType}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-[#B7C9D9] text-xs">
                      Op: ₹{led.openingBalance.toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-[#2588E8] font-bold">{led.openingBalanceType}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditLedgerModal(led)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer transition"
                      title="Edit Ledger"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteLedger(led)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#fca5a5] cursor-pointer transition"
                      title="Delete Ledger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {subGroups.map((sub) => renderGroupTree(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const primaryGroups = accountGroups.filter((g) => g.isPrimary || !g.parentGroupId);

  return (
    <div className="space-y-3.5 text-[#FFFFFF]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] p-3.5 sm:p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#FFFFFF] flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-[#2588E8]" />
            Chart of Accounts Hierarchy
          </h1>
          <p className="text-xs text-[#7F98AE] mt-1">
            Hierarchical ledger master grouped by Indian accounting principles (Assets, Liabilities, Capital, Direct &amp; Indirect Expenses/Incomes).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openNewGroupModal()}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] text-[#2588E8] font-semibold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Create New Group
          </button>
          <button
            onClick={() => openNewLedgerModal()}
            className="flex items-center gap-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-4 py-2 rounded-xl text-xs transition shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Ledger
          </button>
        </div>
      </div>

      {/* Tree View Container */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
        {primaryGroups.map((grp) => renderGroupTree(grp, 0))}
      </div>

      {/* Ledger Create / Edit Modal */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.54)] backdrop-blur-xl backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 sm:p-5 w-full max-w-lg max-h-[92vh] flex flex-col text-xs text-[#FFFFFF] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[rgba(112,185,245,0.25)] pb-3 shrink-0">
              <h3 className="font-bold text-[#FFFFFF] text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2588E8]" />
                {editingLedger ? 'Edit Ledger Account' : 'Create New Ledger Account'}
              </h3>
              <button onClick={() => setLedgerModalOpen(false)} className="text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer text-sm p-1">✕</button>
            </div>

            {Boolean(name.trim() && ledgers.some((l) => l.id !== editingLedger?.id && l.name.trim().toLowerCase() === name.trim().toLowerCase())) && (
              <div className="p-2.5 mt-2 bg-[#421d23] border border-rose-800/50 rounded-xl text-[#fca5a5] text-xs flex items-center gap-2 font-medium shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#fca5a5] shrink-0" />
                <span>Warning: A ledger named &quot;{name.trim()}&quot; already exists. Duplicate ledger names are not allowed.</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Ledger Name *</label>
                <input
                  ref={ledgerNameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mahadev Transport Corp or Machinery Account"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div className={isDebtorOrCreditorGroup(groupId) ? 'space-y-1' : 'grid grid-cols-2 gap-3'}>
                <div>
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Group *</label>
                  <select
                    id="coa_ledger_group_select"
                    value={groupId}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_GROUP__') {
                        openNewGroupModal();
                        e.target.value = groupId;
                        return;
                      }
                      const selectedGId = e.target.value;
                      setGroupId(selectedGId);
                      const grp = accountGroups.find((g) => g.id === selectedGId);
                      if (grp) {
                        setAccountType(grp.accountType);
                        const isCreditor = selectedGId === 'grp-sundry-creditors' || grp.nature === 'CREDIT';
                        setOpeningBalanceType(isCreditor ? 'CR' : 'DR');
                        setOpeningBalancePakkaType(isCreditor ? 'CR' : 'DR');
                        setOpeningBalanceKachaType(isCreditor ? 'CR' : 'DR');
                      }
                    }}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                  >
                    <option value="">-- Select Group --</option>
                    <option value="__ADD_GROUP__" className="text-amber-400 font-bold bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">+ Add Account Group...</option>
                    {accountGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!isDebtorOrCreditorGroup(groupId) && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Opening Balance (₹)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] font-mono focus:outline-hidden focus:border-[#2588E8]"
                      />
                      <select
                        value={openingBalanceType}
                        onChange={(e) => setOpeningBalanceType(e.target.value as 'DR' | 'CR')}
                        className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 text-[#2588E8] font-bold cursor-pointer"
                      >
                        <option value="DR">Dr</option>
                        <option value="CR">Cr</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Clean 2 Columns for Debtors & Creditors: 1. Pakka and 2. Kacha */}
              {isDebtorOrCreditorGroup(groupId) && (
                <div className="p-3 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/30 rounded-xl space-y-2.5">
                  <div className="text-[11px] font-bold text-[#2588E8] uppercase tracking-wider border-b border-[rgba(112,185,245,0.25)] pb-1.5 flex items-center justify-between">
                    <span>Opening Balance</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Column 1: 1. Pakka */}
                    <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl p-2.5 rounded-xl border border-emerald-500/40 space-y-1">
                      <label className="block text-[11px] font-bold text-emerald-300 uppercase">
                        1. Pakka
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          value={openingBalancePakka}
                          onChange={(e) => setOpeningBalancePakka(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/40 rounded-xl p-2 text-[#FFFFFF] font-mono focus:outline-hidden focus:border-emerald-400 text-xs"
                        />
                        <select
                          value={openingBalancePakkaType}
                          onChange={(e) => setOpeningBalancePakkaType(e.target.value as 'DR' | 'CR')}
                          className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-emerald-500/50 rounded-xl px-2.5 text-emerald-400 font-bold cursor-pointer text-xs focus:outline-hidden"
                        >
                          <option value="DR">Dr</option>
                          <option value="CR">Cr</option>
                        </select>
                      </div>
                    </div>

                    {/* Column 2: 2. Kacha */}
                    <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl p-2.5 rounded-xl border border-amber-500/40 space-y-1">
                      <label className="block text-[11px] font-bold text-amber-300 uppercase">
                        2. Kacha
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          value={openingBalanceKacha}
                          onChange={(e) => setOpeningBalanceKacha(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-amber-500/40 rounded-xl p-2 text-[#FFFFFF] font-mono focus:outline-hidden focus:border-amber-400 text-xs"
                        />
                        <select
                          value={openingBalanceKachaType}
                          onChange={(e) => setOpeningBalanceKachaType(e.target.value as 'DR' | 'CR')}
                          className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-amber-500/50 rounded-xl px-2.5 text-amber-400 font-bold cursor-pointer text-xs focus:outline-hidden"
                        >
                          <option value="DR">Dr</option>
                          <option value="CR">Cr</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Combined Total with final Dr. or Cr. */}
                  {(() => {
                    const pDr = openingBalancePakkaType === 'DR' ? (Number(openingBalancePakka) || 0) : -(Number(openingBalancePakka) || 0);
                    const kDr = openingBalanceKachaType === 'DR' ? (Number(openingBalanceKacha) || 0) : -(Number(openingBalanceKacha) || 0);
                    const netDr = pDr + kDr;
                    const netVal = Math.abs(netDr);
                    const netType = netDr >= 0 ? 'DR' : 'CR';
                    return (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl rounded-xl text-xs font-mono border border-[rgba(112,185,245,0.25)]">
                        <span className="text-[#7F98AE] font-sans text-[11px] font-semibold">Combined Total:</span>
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
              )}

              {/* City and State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#7F98AE] uppercase">City</label>
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerModalOpen(false);
                        setActiveTab('city_state_master');
                      }}
                      className="text-[10px] text-[#2588E8] hover:underline cursor-pointer"
                    >
                      + Master
                    </button>
                  </div>
                  <input
                    type="text"
                    list="ledger_cities_list"
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    placeholder="Kota / Kishangarh"
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                  />
                  <datalist id="ledger_cities_list">
                    {cities.map((c) => (
                      <option key={c.id} value={c.cityName}>
                        {c.stateCode} - {c.stateName} {c.district ? `(${c.district})` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] text-xs cursor-pointer focus:outline-hidden focus:border-[#2588E8]"
                  >
                    <option value="">Select</option>
                    {states.map((st) => (
                      <option key={st.code} value={st.name}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone & Contact Person - Only for Non-Debtor/Creditor General Ledgers */}
              {!isDebtorOrCreditorGroup(groupId) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Manager / Owner Name"
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(112,185,245,0.25)] shrink-0">
              <button
                onClick={handleSaveLedger}
                className="bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition"
              >
                <Save className="w-3.5 h-3.5" />
                Save Ledger
              </button>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-4 py-2 rounded-xl font-semibold border border-[rgba(112,185,245,0.25)] cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Group Create / Edit Modal */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.54)] backdrop-blur-xl backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-5 w-full max-w-md space-y-4 text-xs text-[#FFFFFF] shadow-2xl">
            <div className="flex justify-between items-center border-b border-[rgba(112,185,245,0.25)] pb-3">
              <h3 className="font-bold text-[#FFFFFF] text-sm flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#2588E8]" />
                {editingGroup ? 'Edit Account Group' : 'Create New Account Group'}
              </h3>
              <button onClick={() => setGroupModalOpen(false)} className="text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer">✕</button>
            </div>

            {Boolean(groupName.trim() && accountGroups.some((g) => g.id !== editingGroup?.id && g.name.trim().toLowerCase() === groupName.trim().toLowerCase())) && (
              <div className="p-3 bg-[#421d23] border border-rose-800/50 rounded-xl text-[#fca5a5] text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-[#fca5a5] shrink-0" />
                <span>Warning: An account group named &quot;{groupName.trim()}&quot; already exists. Duplicate group names are not allowed.</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Group Name *</label>
                <input
                  ref={groupNameInputRef}
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Quarry Machinery or Factory Overheads"
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Primary Group *</label>
                <select
                  value={parentGroupId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setParentGroupId(pid);
                    const p = accountGroups.find((g) => g.id === pid);
                    if (p) {
                      setGroupAccountType(p.accountType);
                      setGroupNature(p.nature);
                    } else {
                      setGroupAccountType('');
                      setGroupNature('');
                    }
                  }}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="">-- Select Primary Group --</option>
                  {accountGroups
                    .filter((g) => {
                      if (!editingGroup) return true;
                      if (g.id === editingGroup.id) return false;
                      const descendantIds = getDescendantGroupIds(editingGroup.id);
                      return !descendantIds.has(g.id);
                    })
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                    Account Type
                    <span className="ml-1 text-[10px] text-[#7F98AE] font-normal lowercase">(read-only)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={groupAccountType ? groupAccountType.replace(/_/g, ' ') : ''}
                    placeholder="Auto-selected from Primary Group"
                    className="w-full bg-[#0D231A] border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 text-[#B7C9D9] font-medium cursor-not-allowed select-none opacity-85 placeholder-[#55695C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">
                    Balance Nature
                    <span className="ml-1 text-[10px] text-[#7F98AE] font-normal lowercase">(read-only)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={groupNature ? (groupNature === 'DEBIT' ? 'DEBIT (Dr)' : 'CREDIT (Cr)') : ''}
                    placeholder="Auto-selected from Primary Group"
                    className={`w-full bg-[#0D231A] border border-[rgba(112,185,245,0.25)] rounded-xl p-2.5 font-bold cursor-not-allowed select-none opacity-85 placeholder-[#55695C] ${
                      groupNature === 'DEBIT' ? 'text-amber-400' : groupNature === 'CREDIT' ? 'text-emerald-400' : 'text-[#7F98AE]'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(112,185,245,0.25)]">
              <button
                onClick={handleSaveGroup}
                className="bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition"
              >
                <Save className="w-3.5 h-3.5" />
                {editingGroup ? 'Update Group' : 'Save Group'}
              </button>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-4 py-2 rounded-xl font-semibold border border-[rgba(112,185,245,0.25)] cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
