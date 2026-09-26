import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage, IsolatedStorageService } from '../../services/storage/indexedDbStorage';
import { FiscalYear } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  ArrowRight,
  X,
  Clock,
  ShieldAlert,
  Edit2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay } from '../../utils/dateUtils';

interface FiscalYearManagerModalProps {
  onClose: () => void;
}

export const FiscalYearManagerModal: React.FC<FiscalYearManagerModalProps> = ({ onClose }) => {
  const {
    currentCompany,
    currentFiscalYear,
    fiscalYears,
    switchFiscalYear,
    createFiscalYear,
    updateFiscalYear,
    deleteFiscalYear,
    refreshFiscalYears,
    showNotification,
    refreshActiveData,
  } = useApp();

  const [localFiscalYears, setLocalFiscalYears] = useState<FiscalYear[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Edit FY State
  const [editingFy, setEditingFy] = useState<FiscalYear | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editFyName, setEditFyName] = useState('');

  // New FY Form
  const [startDate, setStartDate] = useState('2027-04-01');
  const [endDate, setEndDate] = useState('2028-03-31');
  const [fyName, setFyName] = useState('FY 2027-2028');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    confirmLabel?: string;
    details?: { label: string; value: string | number }[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadFiscalYears = async () => {
    if (!currentCompany) return;
    try {
      const list = await refreshFiscalYears(currentCompany.id);
      setLocalFiscalYears(list);
    } catch (err: any) {
      showNotification('Failed to load fiscal years', 'error');
    }
  };

  const handleCleanDuplicates = async () => {
    if (!currentCompany) return;
    try {
      const cleaned = await dbStorage.deduplicateFiscalYears(currentCompany.id);
      await refreshFiscalYears(currentCompany.id);
      setLocalFiscalYears(cleaned);
      await refreshActiveData();
      setConfirmModal({
        isOpen: true,
        type: 'INFO',
        title: 'Deduplication Complete',
        message: `Financial year datasets have been checked and deduplicated. Active distinct financial years: ${cleaned.map((f) => f.name).join(', ')}.`,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    } catch (err: any) {
      showNotification('Failed to clean duplicates: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    if (fiscalYears) {
      setLocalFiscalYears(fiscalYears);
    }
  }, [fiscalYears]);

  useEffect(() => {
    if (currentCompany?.id) {
      refreshFiscalYears(currentCompany.id);
    }
  }, [currentCompany?.id, refreshFiscalYears]);

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    const startYear = parseInt(date.split('-')[0], 10) || new Date().getFullYear();
    const endYear = startYear + 1;
    const computedEndDate = `${endYear}-03-31`;
    setEndDate(computedEndDate);
    setFyName(`FY ${startYear}-${endYear}`);
  };

  const validateAndPromptCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCompany) return;

    // 1. Strict Format Check: FY XXXX-YYYY
    const fyRegex = /^FY \d{4}-\d{4}$/;
    const formattedName = fyName.trim();

    if (!fyRegex.test(formattedName)) {
      setConfirmModal({
        isOpen: true,
        type: 'DUPLICATE_ERROR',
        title: 'Invalid Financial Year Format',
        message: `Financial Year label must follow the standard "FY XXXX-YYYY" format (e.g. FY 2027-2028). You entered: "${formattedName}".`,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // 2. Duplicate Validation Check
    const isDuplicate = localFiscalYears.some(
      (fy) =>
        fy.name.trim().toUpperCase() === formattedName.toUpperCase() ||
        (fy.startDate === startDate && fy.endDate === endDate)
    );

    if (isDuplicate) {
      setConfirmModal({
        isOpen: true,
        type: 'DUPLICATE_ERROR',
        title: 'Duplicate Financial Year Blocked',
        message: `A Financial Year with name "${formattedName}" or date period (${startDate} to ${endDate}) already exists for ${currentCompany.name}. Duplicate financial years cannot be created.`,
        details: [
          { label: 'Company', value: currentCompany.name },
          { label: 'Requested FY', value: formattedName },
          { label: 'Period', value: `${startDate} to ${endDate}` },
          { label: 'Status', value: 'BLOCKED (Duplicate Violation)' },
        ],
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // 3. Valid -> Show Confirmation Dialog for ADD
    setConfirmModal({
      isOpen: true,
      type: 'ADD',
      title: 'Confirm Create Financial Year',
      message: `Are you sure you want to initialize a new isolated dataset for financial year "${formattedName}"?`,
      details: [
        { label: 'Company', value: currentCompany.name },
        { label: 'Financial Year', value: formattedName },
        { label: 'Start Date', value: startDate },
        { label: 'End Date', value: endDate },
        { label: 'Storage Dataset', value: `BahiKhata-ERP_Dataset_${currentCompany.id}_${formattedName.replace(/\s+/g, '_')}` },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await executeCreateFiscalYear();
      },
    });
  };

  const executeCreateFiscalYear = async () => {
    if (!currentCompany) return;
    try {
      const now = new Date().toISOString();
      const fyId = `fy-${Date.now()}`;

      const newFY: FiscalYear = {
        id: fyId,
        uuid: uuidv4(),
        companyId: currentCompany.id,
        name: fyName.trim(),
        startDate,
        endDate,
        isClosed: false,
        isLocked: false,
        isTransferred: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await dbStorage.createFiscalYear(newFY);
      await dbStorage.logAudit(
        'CREATE',
        'FISCAL_YEAR',
        fyId,
        `Created Financial Year: ${newFY.name} (${startDate} to ${endDate})`
      );

      showNotification(`Financial Year "${newFY.name}" initialized successfully.`, 'success');
      setIsAdding(false);
      // Immediately refresh global AppContext fiscalYears so it reflects in the Header dropdown list instantly!
      const updatedList = await refreshFiscalYears(currentCompany.id);
      setLocalFiscalYears(updatedList);
      await refreshActiveData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create financial year.', 'error');
    }
  };

  const handleStartEdit = (fy: FiscalYear) => {
    setEditingFy(fy);
    setEditStartDate(fy.startDate);
    setEditEndDate(fy.endDate);
    setEditFyName(fy.name);
    setIsAdding(false);
  };

  const handleEditStartDateChange = (date: string) => {
    setEditStartDate(date);
    const startYear = parseInt(date.split('-')[0], 10) || new Date().getFullYear();
    const endYear = startYear + 1;
    const computedEndDate = `${endYear}-03-31`;
    setEditEndDate(computedEndDate);
    setEditFyName(`FY ${startYear}-${endYear}`);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFy || !currentCompany) return;

    const fyRegex = /^FY \d{4}-\d{4}$/;
    const formattedName = editFyName.trim();

    if (!fyRegex.test(formattedName)) {
      setConfirmModal({
        isOpen: true,
        type: 'DUPLICATE_ERROR',
        title: 'Invalid Financial Year Format',
        message: `Financial Year label must follow standard "FY XXXX-YYYY" format (e.g. FY 2027-2028). You entered: "${formattedName}".`,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    try {
      const updatedFy: FiscalYear = {
        ...editingFy,
        name: formattedName,
        startDate: editStartDate,
        endDate: editEndDate,
        updatedAt: new Date().toISOString(),
      };
      const updatedList = await updateFiscalYear(updatedFy);
      setLocalFiscalYears(updatedList);
      setEditingFy(null);
      await refreshActiveData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update financial year.', 'error');
    }
  };

  const promptDeleteFiscalYear = (fy: FiscalYear) => {
    const isSole = localFiscalYears.length <= 1;
    const isActive = currentFiscalYear?.id === fy.id;
    const remainingFys = localFiscalYears.filter(
      (f) =>
        f.id !== fy.id &&
        f.uuid !== fy.id &&
        f.name.trim().toUpperCase() !== fy.name.trim().toUpperCase()
    );

    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: isSole
        ? 'Delete Financial Year'
        : isActive
        ? 'Delete Active Financial Year'
        : 'Confirm Delete Financial Year',
      message: isSole
        ? `Are you sure you want to permanently delete "${fy.name}"? All transactions, ledgers, vouchers, and accounts in this financial year will be permanently removed.`
        : isActive
        ? `"${fy.name}" is currently active. Deleting it will permanently remove this financial year and automatically switch active year to "${remainingFys[0]?.name}". Are you sure you want to proceed?`
        : `Are you sure you want to permanently delete "${fy.name}"? All ledgers, vouchers, and transactions in this financial year will be removed.`,
      details: [
        { label: 'Financial Year', value: fy.name },
        { label: 'Period', value: `${formatDateDisplay(fy.startDate)} to ${formatDateDisplay(fy.endDate)}` },
        { label: 'Company', value: currentCompany?.name || '' },
        ...(isActive && !isSole ? [{ label: 'Next Active Financial Year', value: remainingFys[0]?.name || '' }] : []),
        { label: 'Action', value: 'Permanent Deletion' },
      ],
      confirmLabel: 'Yes, Delete Financial Year',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        // Immediate optimistic UI update so the user sees the deletion instantaneously
        setLocalFiscalYears((prev) =>
          prev.filter(
            (f) =>
              f.id !== fy.id &&
              f.uuid !== fy.id &&
              f.name.trim().toUpperCase() !== fy.name.trim().toUpperCase()
          )
        );
        try {
          const updatedList = await deleteFiscalYear(
            fy.id,
            fy.companyId,
            fy.name,
            fy.startDate,
            fy.endDate
          );
          setLocalFiscalYears(updatedList);
          if (updatedList.length === 0) {
            setIsAdding(true);
          }
        } catch (err: any) {
          const refreshed = await refreshFiscalYears();
          setLocalFiscalYears(refreshed);
          showNotification(err.message || 'Failed to delete fiscal year.', 'error');
        }
      },
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono animate-in fade-in duration-150">
        <div className="bg-[#0d0f17] border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#090a0f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded border border-sky-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800 uppercase">
                  Dataset Master
                </span>
                <span className="text-[10px] text-slate-400">{currentCompany?.name}</span>
              </div>
              <h2 className="font-bold text-white text-base tracking-tight">Financial Year Management</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Rules Banner */}
          <div className="p-3 bg-[#090a0f] border border-slate-800 rounded text-xs space-y-1">
            <div className="text-amber-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Standard Fiscal Format: FY XXXX-YYYY
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Every Financial Year represents an independent, isolated dataset (1st April to 31st March). Duplicate financial years for the same period are strictly prevented to maintain audit compliance.
            </p>
          </div>

          {/* Action to Toggle Add Form */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Configured Financial Years ({localFiscalYears.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCleanDuplicates}
                title="Remove any redundant duplicate financial year entries"
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold px-2.5 py-1.5 rounded transition font-mono cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                DEDUPLICATE / CLEAN
              </button>
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow font-mono cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAdding ? 'CANCEL FORM' : 'ADD NEW FINANCIAL YEAR'}
              </button>
            </div>
          </div>

          {/* Add New FY Form */}
          {isAdding && (
            <form onSubmit={validateAndPromptCreate} className="bg-[#090a0f] border border-emerald-800/60 rounded p-4 space-y-3 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Plus className="w-3.5 h-3.5" />
                Initialize New Financial Year
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Start Date (1st April)
                  </label>
                  <DateInput
                    value={startDate}
                    onChange={handleStartDateChange}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    End Date (31st March)
                  </label>
                  <DateInput
                    value={endDate}
                    onChange={setEndDate}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Label (FY XXXX-YYYY)
                  </label>
                  <input
                    type="text"
                    required
                    value={fyName}
                    onChange={(e) => setFyName(e.target.value)}
                    placeholder="FY 2027-2028"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 outline-hidden uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-4 py-1 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded transition flex items-center gap-1.5 shadow font-mono cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save &amp; Initialize
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Edit Financial Year Inline Form */}
          {editingFy && (
            <form
              onSubmit={handleSaveEdit}
              className="mb-4 p-3.5 bg-slate-950 border border-amber-500/40 rounded space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Financial Year ({editingFy.name})
                </span>
                <button
                  type="button"
                  onClick={() => setEditingFy(null)}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Start Date (1st April)
                  </label>
                  <DateInput
                    value={editStartDate}
                    onChange={handleEditStartDateChange}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    End Date (31st March)
                  </label>
                  <DateInput
                    value={editEndDate}
                    onChange={setEditEndDate}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Label (FY XXXX-YYYY)
                  </label>
                  <input
                    type="text"
                    required
                    value={editFyName}
                    onChange={(e) => setEditFyName(e.target.value)}
                    placeholder="FY 2027-2028"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:border-amber-500 outline-hidden uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-4 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition flex items-center gap-1.5 shadow font-mono cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Update Financial Year
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFy(null)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* List of Financial Years */}
          <div className="border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#090a0f] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">FY Name</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {localFiscalYears.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-slate-300">No Financial Years configured</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        There are no active financial years for {currentCompany?.name}.
                      </p>
                      {!isAdding && !editingFy && (
                        <button
                          type="button"
                          onClick={() => setIsAdding(true)}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Financial Year Now
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  localFiscalYears.map((fy) => {
                  const isActive = currentFiscalYear?.id === fy.id;
                  return (
                    <tr
                      key={fy.id}
                      onClick={() => {
                        if (!isActive) {
                          switchFiscalYear(fy.id);
                          onClose();
                        }
                      }}
                      className={`hover:bg-slate-800/40 transition cursor-pointer ${
                        isActive ? 'bg-sky-500/10' : ''
                      }`}
                      title={isActive ? 'Currently active financial year' : `Click to switch to ${fy.name}`}
                    >
                      <td className="py-2.5 px-3 font-bold">
                        <div className="flex items-center gap-2">
                          <span className={isActive ? 'text-sky-300 font-extrabold' : 'text-white'}>
                            {fy.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-700">
                              ACTIVE DATASET
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px]">
                        {formatDateDisplay(fy.startDate)} &rarr; {formatDateDisplay(fy.endDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {fy.isClosed ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            CLOSED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            OPEN / ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isActive ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                switchFiscalYear(fy.id);
                                onClose();
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-700/50 rounded flex items-center gap-1 transition cursor-pointer"
                            >
                              <span>Switch</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-sky-400 font-bold px-2 py-1">
                              Current
                            </span>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(fy);
                            }}
                            title="Edit Financial Year"
                            className="p-1 rounded border transition cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              promptDeleteFiscalYear(fy);
                            }}
                            title={
                              localFiscalYears.length <= 1
                                ? 'Delete this financial year'
                                : isActive
                                ? 'Delete active financial year (will switch to another year)'
                                : 'Delete financial year'
                            }
                            className="p-1 rounded border transition cursor-pointer bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between bg-[#090a0f] text-xs">
          <span className="text-slate-500 text-[11px]">
            Database: IndexedDB / BahiKhata-ERP_Dataset
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition cursor-pointer font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    {/* Confirmation Modal Rendered Outside Backdrop Container */}
    <ConfirmationModal
      isOpen={confirmModal.isOpen}
      type={confirmModal.type}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmLabel={confirmModal.confirmLabel}
      itemDetails={confirmModal.details}
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
    />
  </>
);
};
