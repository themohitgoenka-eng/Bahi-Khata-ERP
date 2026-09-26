import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { VoucherType, VoucherLine, InventoryItemLine, Voucher, VoucherSeriesConfig } from '../../types';
import { accountingEngine } from '../../services/accountingEngine';
import { inventoryEngine } from '../../services/inventoryEngine';
import { voucherSeriesService } from '../../services/voucherSeriesService';
import { VoucherSeriesSettingsModal } from './VoucherSeriesSettingsModal';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { DateInput } from '../common/DateInput';
import { FullLedgerMasterModal } from '../master/FullLedgerMasterModal';
import { SearchableDropdown } from '../common/SearchableDropdown';
import { FormCloseConfirmModal } from '../common/FormCloseConfirmModal';
import { useFormEscapeClose } from '../../utils/useFormEscapeClose';
import { getTodayISO, formatDateDisplay, parseDisplayToISO } from '../../utils/dateUtils';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Layers,
  Save,
  FileSpreadsheet,
  Coins,
  Settings,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface VoucherEntryModalProps {
  onClose: () => void;
  initialType?: VoucherType;
  voucherToEdit?: Voucher | null;
  prefillLedgerId?: string;
  onSuccess?: () => void;
}

export const VoucherEntryModal: React.FC<VoucherEntryModalProps> = ({
  onClose,
  initialType = 'PAYMENT',
  voucherToEdit,
  prefillLedgerId,
  onSuccess,
}) => {
  const {
    currentCompany,
    currentFiscalYear,
    ledgers,
    inventoryItems,
    locations,
    showNotification,
    refreshActiveData,
  } = useApp();

  const [voucherType, setVoucherType] = useState<VoucherType>(voucherToEdit?.voucherType || initialType);
  const [selectedSeries, setSelectedSeries] = useState<string>(voucherToEdit?.series || 'MAIN');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    const defLoc = locations.find((l) => l.isDefault && l.isActive) || locations.find((l) => l.isActive);
    return defLoc?.id || '';
  });
  const [isSeriesSettingsOpen, setIsSeriesSettingsOpen] = useState<boolean>(false);
  const [seriesList, setSeriesList] = useState<VoucherSeriesConfig[]>(() =>
    voucherSeriesService.getSeriesForVoucherType(voucherToEdit?.voucherType || initialType)
  );

  // Compute smart initial date that falls within active fiscal year if possible
  const initialDate = (() => {
    if (voucherToEdit?.date) return parseDisplayToISO(voucherToEdit.date).slice(0, 10);
    const today = getTodayISO();
    if (currentFiscalYear) {
      const start = parseDisplayToISO(currentFiscalYear.startDate).slice(0, 10);
      const end = currentFiscalYear.endDate ? parseDisplayToISO(currentFiscalYear.endDate).slice(0, 10) : '';
      if (today >= start && (!end || today <= end)) {
        return today;
      }
      if (today < start) return start;
      if (end && today > end) return end;
    }
    return today;
  })();

  const [date, setDate] = useState<string>(initialDate);
  const [voucherNumber, setVoucherNumber] = useState<string>(voucherToEdit?.voucherNumber || '');
  const [referenceNo, setReferenceNo] = useState<string>(voucherToEdit?.referenceNo || '');
  const [narration, setNarration] = useState<string>(voucherToEdit?.narration || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Create Ledger Modal state
  const [quickLedgerModal, setQuickLedgerModal] = useState<{ open: boolean; lineIdx: number | null }>({ open: false, lineIdx: null });

  // Auto-focus first field when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstField = document.querySelector('#voucher_series_settings_btn') as HTMLElement | null;
      // Focus the voucher type select (first in the form)
      const typeSelect = document.querySelector('.voucher-type-select') as HTMLElement | null;
      if (typeSelect) typeSelect.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  // Synchronize available series when voucherType changes
  useEffect(() => {
    const available = voucherSeriesService.getSeriesForVoucherType(voucherType);
    setSeriesList(available);
    if (!voucherToEdit) {
      const def = available.find((s) => s.isDefault) || available[0];
      setSelectedSeries(def?.seriesName || 'MAIN');
    }
  }, [voucherType, voucherToEdit]);

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

  // Accounting Lines
  const [lines, setLines] = useState<VoucherLine[]>([]);

  // Inventory Lines for Sales/Purchase
  const [inventoryLines, setInventoryLines] = useState<InventoryItemLine[]>([]);

  const isInventoryVoucher =
    voucherType === 'SALES' ||
    voucherType === 'PURCHASE' ||
    voucherType === 'SALES_RETURN' ||
    voucherType === 'PURCHASE_RETURN';

  // Active series configuration
  const activeSeriesConfig =
    seriesList.find((s) => s.seriesName === selectedSeries) ||
    seriesList.find((s) => s.isDefault) ||
    seriesList[0];

  // Initialize lines based on voucher type & selected series
  useEffect(() => {
    if (voucherToEdit) {
      setVoucherType(voucherToEdit.voucherType);
      setDate(voucherToEdit.date);
      setVoucherNumber(voucherToEdit.voucherNumber);
      if (voucherToEdit.series) setSelectedSeries(voucherToEdit.series);
      setReferenceNo(voucherToEdit.referenceNo || '');
      setNarration(voucherToEdit.narration || '');
      setLines(voucherToEdit.lines || []);
      setInventoryLines(voucherToEdit.inventoryLines || []);
      return;
    }

    // Generate auto voucher number according to active series
    const fyShort = currentFiscalYear ? currentFiscalYear.name.replace('FY ', '') : '26-27';
    if (activeSeriesConfig) {
      const autoNum = voucherSeriesService.formatVoucherNumber(activeSeriesConfig, fyShort);
      setVoucherNumber(autoNum);
    }

    // Pre-populate smart default lines based on type & series fixed ledgers
    const cashLedger =
      (prefillLedgerId && prefillLedgerId !== 'ALL' && ledgers.find((l) => l.id === prefillLedgerId)) ||
      ledgers.find((l) => l.groupId === 'grp-cash-in-hand' || l.name.toLowerCase().includes('cash')) ||
      ledgers[0];
    const bankLedger = ledgers.find((l) => l.name.toLowerCase().includes('bank')) || ledgers[1] || ledgers[0];
    const salesLedger = ledgers.find((l) => l.name.toLowerCase().includes('sales')) || ledgers[0];
    const purchaseLedger = ledgers.find((l) => l.name.toLowerCase().includes('purchase')) || ledgers[0];
    const customerLedger = ledgers.find((l) => l.groupId === 'grp-sundry-debtors') || ledgers[0];
    const supplierLedger = ledgers.find((l) => l.groupId === 'grp-sundry-creditors') || ledgers[0];

    // Priority: series fixed ledgers -> contextual default
    const seriesDrIds = (activeSeriesConfig?.defaultDrLedgerIds && activeSeriesConfig.defaultDrLedgerIds.length > 0)
      ? activeSeriesConfig.defaultDrLedgerIds.filter(Boolean)
      : (activeSeriesConfig?.defaultDrLedgerId ? [activeSeriesConfig.defaultDrLedgerId] : []);
    const seriesCrIds = (activeSeriesConfig?.defaultCrLedgerIds && activeSeriesConfig.defaultCrLedgerIds.length > 0)
      ? activeSeriesConfig.defaultCrLedgerIds.filter(Boolean)
      : (activeSeriesConfig?.defaultCrLedgerId ? [activeSeriesConfig.defaultCrLedgerId] : []);

    let initialDrIds = [...seriesDrIds];
    let initialCrIds = [...seriesCrIds];

    if (initialDrIds.length === 0) {
      if (voucherType === 'RECEIPT') initialDrIds = [cashLedger?.id || ''];
      else if (voucherType === 'PAYMENT') initialDrIds = [supplierLedger?.id || ''];
      else if (voucherType === 'CONTRA') initialDrIds = [bankLedger?.id || ''];
      else if (voucherType === 'PURCHASE_RETURN') initialDrIds = [supplierLedger?.id || ''];
      else if (voucherType === 'SALES_RETURN') initialDrIds = [salesLedger?.id || ''];
      else if (voucherType === 'SALES') initialDrIds = [customerLedger?.id || ''];
      else if (voucherType === 'PURCHASE') initialDrIds = [purchaseLedger?.id || ''];
      else if (voucherType === 'JOURNAL') initialDrIds = [customerLedger?.id || ledgers[0]?.id || ''];
      else initialDrIds = [ledgers[0]?.id || ''];
    }

    if (initialCrIds.length === 0) {
      if (voucherType === 'RECEIPT') initialCrIds = [customerLedger?.id || ''];
      else if (voucherType === 'PAYMENT') initialCrIds = [cashLedger?.id || ''];
      else if (voucherType === 'CONTRA') initialCrIds = [cashLedger?.id || ''];
      else if (voucherType === 'PURCHASE_RETURN') initialCrIds = [purchaseLedger?.id || ''];
      else if (voucherType === 'SALES_RETURN') initialCrIds = [customerLedger?.id || ''];
      else if (voucherType === 'SALES') initialCrIds = [salesLedger?.id || ''];
      else if (voucherType === 'PURCHASE') initialCrIds = [supplierLedger?.id || ''];
      else if (voucherType === 'JOURNAL') initialCrIds = [supplierLedger?.id || ledgers[1]?.id || ledgers[0]?.id || ''];
      else initialCrIds = [ledgers[1]?.id || ledgers[0]?.id || ''];
    }

    // Ensure at least 1 Dr and 1 Cr line always
    if (initialDrIds.length === 0) initialDrIds = [ledgers[0]?.id || ''];
    if (initialCrIds.length === 0) initialCrIds = [ledgers[1]?.id || ledgers[0]?.id || ''];

    const initialLines: VoucherLine[] = [
      {
        id: uuidv4(),
        uuid: uuidv4(),
        ledgerId: '',
        ledgerName: '',
        type: 'DR',
        amount: 0,
      },
      {
        id: uuidv4(),
        uuid: uuidv4(),
        ledgerId: '',
        ledgerName: '',
        type: 'CR',
        amount: 0,
      },
    ];

    setLines(initialLines);
  }, [voucherType, selectedSeries, voucherToEdit, currentFiscalYear, ledgers]);

  // Handle Series dropdown change
  const handleSeriesChange = (newSeriesName: string) => {
    setSelectedSeries(newSeriesName);
    const config = seriesList.find((s) => s.seriesName === newSeriesName);
    if (!config) return;

    const fyShort = currentFiscalYear ? currentFiscalYear.name.replace('FY ', '') : '26-27';
    setVoucherNumber(voucherSeriesService.formatVoucherNumber(config, fyShort));

    // If this series defines fixed Debit or Credit ledgers, update lines automatically
    const seriesDrIds = (config.defaultDrLedgerIds && config.defaultDrLedgerIds.length > 0)
      ? config.defaultDrLedgerIds.filter(Boolean)
      : (config.defaultDrLedgerId ? [config.defaultDrLedgerId] : []);
    const seriesCrIds = (config.defaultCrLedgerIds && config.defaultCrLedgerIds.length > 0)
      ? config.defaultCrLedgerIds.filter(Boolean)
      : (config.defaultCrLedgerId ? [config.defaultCrLedgerId] : []);

    if (seriesDrIds.length > 0 || seriesCrIds.length > 0) {
      const newLines: VoucherLine[] = [];
      if (seriesDrIds.length > 0) {
        seriesDrIds.forEach((drId) => {
          const led = ledgers.find((item) => item.id === drId);
          newLines.push({
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: drId,
            ledgerName: led?.name,
            type: 'DR',
            amount: 0,
          });
        });
      } else {
        newLines.push({ id: uuidv4(), uuid: uuidv4(), ledgerId: '', type: 'DR', amount: 0 });
      }

      if (seriesCrIds.length > 0) {
        seriesCrIds.forEach((crId) => {
          const led = ledgers.find((item) => item.id === crId);
          newLines.push({
            id: uuidv4(),
            uuid: uuidv4(),
            ledgerId: crId,
            ledgerName: led?.name,
            type: 'CR',
            amount: 0,
          });
        });
      } else {
        newLines.push({ id: uuidv4(), uuid: uuidv4(), ledgerId: '', type: 'CR', amount: 0 });
      }
      setLines(newLines);
    }
  };

  // Calculate totals
  const totalDebit = lines.reduce((sum, l) => (l.type === 'DR' ? sum + (Number(l.amount) || 0) : sum), 0);
  const totalCredit = lines.reduce((sum, l) => (l.type === 'CR' ? sum + (Number(l.amount) || 0) : sum), 0);
  const roundedDr = Math.round(totalDebit * 100) / 100;
  const roundedCr = Math.round(totalCredit * 100) / 100;
  const diff = Math.round(Math.abs(roundedDr - roundedCr) * 100) / 100;
  const isBalanced = diff === 0 && roundedDr > 0;

  // Sync inventory lines sum to voucher lines
  const inventoryTotal = inventoryLines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const voucherInventoryDecimals = useMemo(() => {
    const decimals: number[] = [];
    for (const line of inventoryLines) {
      const cleanName = String(line.itemName || '').trim().toLowerCase();
      const found = inventoryItems.find(
        (i) =>
          (line.itemId && i.id === line.itemId) ||
          (cleanName && i.name.trim().toLowerCase() === cleanName) ||
          (cleanName && i.code && i.code.trim().toLowerCase() === cleanName) ||
          (cleanName && i.name.trim().toLowerCase().includes(cleanName)) ||
          (cleanName && cleanName.includes(i.name.trim().toLowerCase()))
      );
      if (
        found &&
        found.decimalPlaces !== undefined &&
        found.decimalPlaces !== null &&
        (found.decimalPlaces as any) !== '' &&
        !isNaN(Number(found.decimalPlaces))
      ) {
        decimals.push(Number(found.decimalPlaces));
      }
    }
    return decimals.length > 0 ? Math.max(...decimals) : 2;
  }, [inventoryLines, inventoryItems]);

  // Form close confirmation on Escape
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  useFormEscapeClose({
    isOpen: !isSeriesSettingsOpen && !quickLedgerModal.open && !confirmModal.isOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!voucherNumber || !voucherNumber.trim()) {
      showNotification('Data is needed in "Voucher Number" field.', 'error');
      setShowEscapeConfirm(false);
      return;
    }
    const missingLedgerIdx = lines.findIndex((l) => !l.ledgerId);
    if (missingLedgerIdx !== -1) {
      showNotification('Data is needed in "Account Ledger" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => {
        document.getElementById(`voucher_line_ledger_${missingLedgerIdx}`)?.focus();
      }, 80);
      return;
    }
    if (!isBalanced) {
      showNotification('Data is needed in "Debit/Credit Amount" field (voucher must be balanced).', 'error');
      setShowEscapeConfirm(false);
      return;
    }

    setShowEscapeConfirm(false);
    handleSave();
  };

  // Keep inventory lines reactive to master changes
  useEffect(() => {
    if (!inventoryItems || inventoryItems.length === 0 || inventoryLines.length === 0) return;
    setInventoryLines((prevLines) => {
      let changed = false;
      const updatedLines = prevLines.map((line) => {
        const cleanName = String(line.itemName || '').trim().toLowerCase();
        const found = inventoryItems.find(
          (i) =>
            (line.itemId && i.id === line.itemId) ||
            (cleanName && i.name.trim().toLowerCase() === cleanName) ||
            (cleanName && i.code && i.code.trim().toLowerCase() === cleanName)
        );
        if (!found) return line;

        let rowChanged = false;
        const copy = { ...line };
        if (found.name && copy.itemName !== found.name) {
          copy.itemName = found.name;
          rowChanged = true;
        }
        if (found.primaryUnit && copy.unit !== found.primaryUnit) {
          copy.unit = found.primaryUnit;
          rowChanged = true;
        }
        if (found.decimalPlaces !== undefined && found.decimalPlaces !== null && (found.decimalPlaces as any) !== '') {
          const dec = Number(found.decimalPlaces);
          const currentQty = Number(copy.quantity);
          if (!isNaN(currentQty)) {
            const formattedQty = Number(currentQty.toFixed(dec));
            if (formattedQty !== currentQty) {
              copy.quantity = formattedQty;
              rowChanged = true;
            }
          }
        }
        if (rowChanged) {
          changed = true;
          return copy;
        }
        return line;
      });
      return changed ? updatedLines : prevLines;
    });
  }, [inventoryItems]);

  const handleInventoryItemChange = (idx: number, field: keyof InventoryItemLine, value: any) => {
    const updated = [...inventoryLines];
    const target = { ...updated[idx], [field]: value };

    if (field === 'itemId') {
      const itm = inventoryItems.find((i) => i.id === value);
      if (itm) {
        target.itemName = itm.name;
        target.itemCode = itm.code;
        target.unit = itm.primaryUnit;
        target.rate = Number((itm.openingRate || 0).toFixed(2));
        target.amount = Math.round((target.quantity || 1) * target.rate * 100) / 100;
        if (itm.conversionFactor && itm.alternateUnit) {
          target.alternateUnit = itm.alternateUnit;
          const altUnits = inventoryEngine.convertUnits(target.quantity || 1, 'PRIMARY', itm.conversionFactor, itm.conversionDirection);
          target.alternateQty = Number(altUnits.toFixed(2));
        }
      }
    } else if (field === 'locationId') {
      const loc = locations.find((l) => l.id === value);
      target.locationId = loc?.id;
      target.godown = loc?.name;
    } else if (field === 'quantity' || field === 'rate') {
      const q = field === 'quantity' ? Number(value) : target.quantity || 0;
      const r = field === 'rate' ? Number(Number(value || 0).toFixed(2)) : target.rate || 0;
      target.rate = r;
      target.amount = Math.round(q * r * 100) / 100;

      const itm = inventoryItems.find((i) => i.id === target.itemId);
      if (itm?.conversionFactor && itm?.alternateUnit) {
        const altUnits = inventoryEngine.convertUnits(q, 'PRIMARY', itm.conversionFactor, itm.conversionDirection);
        target.alternateQty = Number(altUnits.toFixed(2));
      }
    } else if (field === 'alternateQty') {
      const altQ = Number(Number(value || 0).toFixed(2));
      target.alternateQty = altQ;
      const itm = inventoryItems.find((i) => i.id === target.itemId);
      if (itm?.conversionFactor && itm?.alternateUnit) {
        target.quantity = inventoryEngine.convertUnits(altQ, 'ALTERNATE', itm.conversionFactor, itm.conversionDirection);
        target.amount = Math.round((target.quantity || 0) * (target.rate || 0) * 100) / 100;
      }
    }

    updated[idx] = target;
    setInventoryLines(updated);

    // Auto-update accounting line amounts if sales or purchase
    const newSum = updated.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    if (lines.length >= 2) {
      setLines((prev) => prev.map((l) => ({ ...l, amount: newSum })));
    }
  };

  const addInventoryRow = () => {
    const firstItm = inventoryItems[0];
    const defLoc = locations.find((l) => l.isDefault) || locations[0];
    setInventoryLines([
      ...inventoryLines,
      {
        id: uuidv4(),
        itemId: firstItm?.id || '',
        itemName: firstItm?.name || 'Stock Item',
        itemCode: firstItm?.code || 'ITM-01',
        quantity: 100,
        unit: firstItm?.primaryUnit || 'SQFT',
        rate: firstItm?.openingRate || 25,
        amount: 100 * (firstItm?.openingRate || 25),
        alternateQty: firstItm?.conversionFactor ? inventoryEngine.convertUnits(100, 'PRIMARY', firstItm.conversionFactor) : undefined,
        alternateUnit: firstItm?.alternateUnit,
        locationId: defLoc?.id,
        godown: defLoc?.name,
      },
    ]);
  };

  const removeInventoryRow = (idx: number) => {
    const updated = inventoryLines.filter((_, i) => i !== idx);
    setInventoryLines(updated);
    const newSum = updated.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    if (lines.length >= 2) {
      setLines((prev) => prev.map((l) => ({ ...l, amount: newSum })));
    }
  };

  const handleLineChange = (idx: number, field: keyof VoucherLine, value: any) => {
    const updated = [...lines];
    const target = { ...updated[idx], [field]: value };
    if (field === 'ledgerId') {
      const led = ledgers.find((l) => l.id === value);
      target.ledgerName = led?.name;
    }
    updated[idx] = target;
    setLines(updated);
  };

  const addLine = () => {
    const curDebit = lines.reduce((sum, l) => (l.type === 'DR' ? sum + (Number(l.amount) || 0) : sum), 0);
    const curCredit = lines.reduce((sum, l) => (l.type === 'CR' ? sum + (Number(l.amount) || 0) : sum), 0);
    const rDr = Math.round(curDebit * 100) / 100;
    const rCr = Math.round(curCredit * 100) / 100;

    let suggestedType: 'DR' | 'CR';
    let remainingDiff = 0;

    if (rDr > rCr) {
      suggestedType = 'CR';
      remainingDiff = Math.round((rDr - rCr) * 100) / 100;
    } else if (rCr > rDr) {
      suggestedType = 'DR';
      remainingDiff = Math.round((rCr - rDr) * 100) / 100;
    } else {
      const last = lines[lines.length - 1];
      suggestedType = last?.type === 'DR' ? 'CR' : 'DR';
      remainingDiff = 0;
    }

    const newIdx = lines.length;

    setLines((prev) => [
      ...prev,
      {
        id: uuidv4(),
        uuid: uuidv4(),
        ledgerId: '',
        type: suggestedType,
        amount: remainingDiff > 0 ? remainingDiff : 0,
      },
    ]);

    setTimeout(() => {
      const el = document.getElementById(`voucher_line_ledger_${newIdx}`) || document.getElementById(`voucher_line_type_${newIdx}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) {
      showNotification('A double-entry voucher must contain at least 2 lines.', 'error');
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const autoBalance = () => {
    if (lines.length >= 2) {
      const firstAmount = lines[0].amount || 0;
      setLines((prev) =>
        prev.map((l, idx) => (idx === 1 && l.amount === 0 ? { ...l, amount: firstAmount } : l))
      );
    }
  };

  const handleSave = () => {
    if (!currentCompany || !currentFiscalYear) {
      showNotification('Company or Fiscal Year context is missing.', 'error');
      return;
    }

    if (!isBalanced) {
      showNotification(`Voucher must be balanced. Total Debit must equal Total Credit. Difference: ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'error');
      return;
    }

    // Validate ledger selections
    const missingLedger = lines.find((l) => !l.ledgerId);
    if (missingLedger) {
      showNotification('Please select a valid Account Ledger for all entries.', 'error');
      return;
    }

    const actionType: ConfirmationType = voucherToEdit ? 'EDIT' : 'ADD';
    const actionTitle = voucherToEdit ? 'Confirm Update Voucher' : 'Confirm Post Accounting Voucher';

    setConfirmModal({
      isOpen: true,
      type: actionType,
      title: actionTitle,
      message: `Are you sure you want to ${voucherToEdit ? 'update' : 'post'} voucher ${voucherNumber} of amount ₹${roundedDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}?`,
      details: [
        { label: 'Voucher Number', value: voucherNumber },
        { label: 'Type & Date', value: `${voucherType} on ${formatDateDisplay(date)}` },
        { label: 'Total Amount', value: `₹${roundedDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: 'Entries Count', value: `${lines.length} Line(s)` },
        { label: 'Narration', value: narration || 'None' },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        const finalDate = date ? parseDisplayToISO(date).slice(0, 10) : getTodayISO();
        try {
          await accountingEngine.postVoucher(
            {
              uuid: voucherToEdit?.uuid || uuidv4(),
              voucherNumber,
              voucherType,
              series: selectedSeries,
              date: finalDate,
              companyId: currentCompany.id,
              fiscalYearId: currentFiscalYear.id,
              narration: narration || `Being ${voucherType} voucher posted`,
              referenceNo,
              lines: lines.map((l) => {
                const led = ledgers.find((item) => item.id === l.ledgerId);
                return {
                  ...l,
                  ledgerName: led?.name || l.ledgerName || 'Account',
                };
              }),
              inventoryLines: isInventoryVoucher ? inventoryLines : undefined,
              totalDebit: roundedDr,
              totalCredit: roundedCr,
              status: 'POSTED',
              deviceId: 'LOCAL-POS-01',
              syncStatus: 'PENDING',
            },
            voucherToEdit?.id
          );

          // Advance sequence counter for this series on new voucher post
          if (!voucherToEdit) {
            voucherSeriesService.incrementSeriesNumber(voucherType, selectedSeries);
          }

          showNotification(`Voucher ${voucherNumber} ${voucherToEdit ? 'updated' : 'posted'} successfully.`, 'success');
          // Reset form state after successful save
          setReferenceNo('');
          setNarration('');
          setLines([
            { id: uuidv4(), uuid: uuidv4(), ledgerId: '', ledgerName: '', type: 'DR', amount: 0 },
            { id: uuidv4(), uuid: uuidv4(), ledgerId: '', ledgerName: '', type: 'CR', amount: 0 },
          ]);
          setInventoryLines([]);
          await refreshActiveData();
          if (onSuccess) {
            onSuccess();
          }
          onClose();
        } catch (err: any) {
          showNotification(err.message || 'Failed to post voucher.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-[rgba(8,24,40,0.54)] backdrop-blur-xl backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] max-h-[94vh] flex flex-col text-[#FFFFFF] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#FFFFFF] flex items-center gap-1.5 leading-tight">
                {voucherToEdit ? 'EDIT ACCOUNTING VOUCHER' : 'NEW DOUBLE-ENTRY VOUCHER'}
                <span className="text-[#2588E8] font-mono text-[9px] bg-[rgba(18,48,76,0.48)] px-2 py-0.5 rounded-md border border-[rgba(112,185,245,0.25)] font-bold">
                  {voucherType === 'PURCHASE_RETURN'
                    ? 'DEBIT NOTE (D.N.)'
                    : voucherType === 'SALES_RETURN'
                    ? 'CREDIT NOTE (C.N.)'
                    : voucherType}
                </span>
              </h2>
              <p className="text-[9px] text-[#7F98AE] font-mono leading-tight">
                {currentCompany?.name} &bull; {currentFiscalYear?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Type Selectors */}
            <div className="flex items-center gap-1 text-[9px] font-mono">
              {[
                { type: 'PAYMENT' as VoucherType, label: 'PAY', title: 'Payment (F5)' },
                { type: 'RECEIPT' as VoucherType, label: 'REC', title: 'Receipt (F6)' },
                { type: 'CONTRA' as VoucherType, label: 'CON', title: 'Contra (F4)' },
                { type: 'JOURNAL' as VoucherType, label: 'JOU', title: 'Journal (F7)' },
                { type: 'PURCHASE_RETURN' as VoucherType, label: 'D.N.', title: 'Debit Note (Purchase Return - F10)' },
                { type: 'SALES_RETURN' as VoucherType, label: 'C.N.', title: 'Credit Note (Sales Return - F11)' },
              ].map((btn) => (
                <button
                  key={btn.type}
                  type="button"
                  title={btn.title}
                  onClick={() => setVoucherType(btn.type)}
                  className={`px-2 py-0.5 rounded-lg transition font-bold cursor-pointer ${
                    voucherType === btn.type
                      ? 'bg-[#2588E8] text-[#FFFFFF] font-bold shadow-xs'
                      : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] hover:text-[#FFFFFF] hover:bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="text-[#7F98AE] hover:text-[#FFFFFF] p-1 rounded-lg hover:bg-[rgba(57,167,255,0.15)] transition ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-3.5 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {/* Voucher Controls Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl p-2.5 rounded-xl border border-[rgba(112,185,245,0.25)] items-start shadow-sm">
            {/* Type */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center text-[9px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as VoucherType)}
                className="voucher-type-select w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-[#2588E8] font-bold focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                <option value="PAYMENT">Payment</option>
                <option value="RECEIPT">Receipt</option>
                <option value="CONTRA">Contra</option>
                <option value="JOURNAL">Journal</option>
                <option value="PURCHASE_RETURN">Debit Note</option>
                <option value="SALES_RETURN">Credit Note</option>
              </select>
            </div>

            {/* Series with Settings Symbol Button */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center text-[9px] font-bold text-[#2588E8] uppercase tracking-wider mb-1">
                Series
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedSeries}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_SERIES__') {
                      setIsSeriesSettingsOpen(true);
                      e.target.value = selectedSeries;
                      return;
                    }
                    handleSeriesChange(e.target.value);
                  }}
                  className="flex-1 min-w-0 h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-[#2588E8] font-bold focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                >
                  <option value="__ADD_SERIES__" className="text-amber-400 font-bold bg-[#142820]">+ Configure Series...</option>
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.seriesName}>
                      {s.seriesName} {s.isDefault ? '★' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  id="voucher_series_settings_btn"
                  onClick={() => setIsSeriesSettingsOpen(true)}
                  title="Series Settings: Prefix, Suffix, Numbering & Fixed Ledgers"
                  className="h-[30px] w-[30px] flex items-center justify-center rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.18)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] transition cursor-pointer shrink-0"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Location dropdown */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center text-[9px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1">
                Location
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
              >
                <option value="">Select Location</option>
                {locations.filter((l) => l.isActive).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}{loc.isDefault ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center gap-1 text-[9px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1">
                <Calendar className="w-3 h-3 text-[#2588E8] shrink-0" />
                <span>Date</span>
              </label>
              <DateInput
                value={date}
                onChange={setDate}
                size="sm"
                className="w-full h-[30px] rounded-lg justify-between"
              />
            </div>

            {/* No. */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center text-[9px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1">
                No.
              </label>
              <input
                type="text"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-[#FFFFFF] font-mono font-bold focus:outline-hidden focus:border-[#2588E8]"
              />
            </div>

            {/* Reference No / Cheque No */}
            <div className="flex flex-col">
              <label className="h-3.5 flex items-center text-[9px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1 truncate">
                Ref / Cheque / UTR
              </label>
              <input
                type="text"
                placeholder="Type Any Reference.."
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-[#FFFFFF] font-mono focus:outline-hidden focus:border-[#2588E8] placeholder:text-[#7F98AE]/60"
              />
            </div>
          </div>

          {/* If Sales/Purchase, Show Item Inventory Breakdown */}
          {isInventoryVoucher && (
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl p-3.5 rounded-2xl border border-[rgba(112,185,245,0.25)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#2588E8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Layers className="w-3.5 h-3.5" />
                  Inventory Item Details (Stone / Slabs)
                </span>
                <button
                  onClick={addInventoryRow}
                  type="button"
                  className="flex items-center gap-1 text-[10px] bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.18)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] px-2.5 py-1 rounded-xl font-bold font-mono transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  ADD ITEM
                </button>
              </div>

              {inventoryLines.length === 0 ? (
                <div className="text-center py-3 text-[#7F98AE] text-[11px] italic">
                  No items added yet. Click &quot;ADD ITEM&quot; to link inventory stock movement.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(112,185,245,0.25)] text-[#7F98AE] text-[10px] uppercase font-mono">
                        <th className="pb-1.5 px-1">Item Name</th>
                        <th className="pb-1.5 px-1 w-32">Godown / Location</th>
                        <th className="pb-1.5 px-1 w-20">Quantity</th>
                        <th className="pb-1.5 px-1 w-16">Unit</th>
                        <th className="pb-1.5 px-1 w-24">Alternate Qty</th>
                        <th className="pb-1.5 px-1 w-24">Rate (₹)</th>
                        <th className="pb-1.5 px-1 w-28 text-right">Amount (₹)</th>
                        <th className="pb-1.5 px-1 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40 font-mono text-[11px]">
                      {inventoryLines.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="py-1.5 pr-2">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleInventoryItemChange(idx, 'itemId', e.target.value)}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1 text-xs text-[#FFFFFF]"
                            >
                              <option value="">Select</option>
                              {inventoryItems.map((itm) => (
                                <option key={itm.id} value={itm.id}>
                                  {itm.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <select
                              value={row.locationId || locations.find((l) => l.name === row.godown)?.id || ''}
                              onChange={(e) => handleInventoryItemChange(idx, 'locationId', e.target.value)}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-1.5 py-1 text-[11px] text-[#2588E8] font-medium"
                            >
                              <option value="">Select</option>
                              {locations.filter((l) => l.isActive).map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name}{loc.isDefault ? ' ★' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleInventoryItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1 text-xs text-[#FFFFFF] text-right"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-[#B7C9D9] font-medium">{row.unit}</td>
                          <td className="py-1.5 pr-2 text-[#7F98AE] text-[10px]">
                            {row.alternateQty ? `${Number(row.alternateQty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row.alternateUnit}` : '-'}
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => handleInventoryItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                              onBlur={(e) => {
                                if (e.target.value !== "" && !isNaN(Number(e.target.value))) {
                                  handleInventoryItemChange(idx, 'rate', Number(Number(e.target.value).toFixed(2)));
                                }
                              }}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1 text-xs text-[#FFFFFF] text-right font-mono"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-right font-bold text-[#2588E8]">
                            ₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 text-center">
                            <button
                              onClick={() => removeInventoryRow(idx)}
                              className="text-[#FF647C] hover:text-[#fca5a5] p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[rgba(112,185,245,0.25)] font-bold text-[#FFFFFF] font-mono text-[11px]">
                        <td colSpan={6} className="pt-2 text-right">
                          Total Item Value:
                        </td>
                        <td className="pt-2 text-right text-[#2588E8]">₹{inventoryTotal.toLocaleString('en-IN', { minimumFractionDigits: voucherInventoryDecimals, maximumFractionDigits: voucherInventoryDecimals })}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Double-Entry Transaction Lines Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#B7C9D9] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#2588E8]" />
                Ledger Entries (Debit / Credit)
              </span>
              <span className="text-[10px] text-[#7F98AE] font-mono">
                Select Dr/Cr &amp; Ledger Account
              </span>
            </div>

            <div className="border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] text-[10px] uppercase font-mono border-b border-[rgba(112,185,245,0.25)]">
                  <tr>
                    <th className="py-1.5 px-3 w-28 sm:w-32">Dr. / Cr.</th>
                    <th className="py-1.5 px-3">Account Ledger</th>
                    <th className="py-1.5 px-3 w-32 text-right text-[#2588E8]">Debit (₹)</th>
                    <th className="py-1.5 px-3 w-32 text-right text-[#2588E8]">Credit (₹)</th>
                    <th className="py-1.5 px-3 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40 font-mono">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-[rgba(57,167,255,0.06)] transition">
                      {/* Type: DR / CR */}
                      <td className="py-1 px-3 w-28 sm:w-32">
                        <select
                          id={`voucher_line_type_${idx}`}
                          value={line.type}
                          onChange={(e) => handleLineChange(idx, 'type', e.target.value as 'DR' | 'CR')}
                          className={`w-full min-w-[76px] h-[30px] font-bold px-2 py-0.5 rounded-lg text-xs border cursor-pointer focus:outline-hidden ${
                            line.type === 'DR'
                              ? 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)] text-[#2588E8]'
                              : 'bg-[#1b4332] border-[rgba(112,185,245,0.25)] text-[#2588E8]'
                          }`}
                        >
                          <option value="DR">Dr.</option>
                          <option value="CR">Cr.</option>
                        </select>
                      </td>

                      {/* Account Ledger */}
                      <td className="py-1 px-3">
                        <SearchableDropdown
                          id={`voucher_line_ledger_${idx}`}
                          value={line.ledgerId}
                          onChange={(val) => handleLineChange(idx, 'ledgerId', val)}
                          options={ledgers.map((led) => ({
                            value: led.id,
                            label: led.name,
                            badge: led.type,
                          }))}
                          placeholder="Select Ledger"
                          addOptionLabel="+ Add Account Ledger..."
                          onAddOption={() => {
                            setQuickLedgerModal({ open: true, lineIdx: idx });
                          }}
                          buttonClassName="h-[30px] text-xs"
                        />
                      </td>

                      {/* Debit Input */}
                      <td className="py-1 px-3 text-right">
                        {line.type === 'DR' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={line.amount === 0 ? '' : line.amount}
                            onChange={(e) => handleLineChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (idx === lines.length - 1) {
                                  addLine();
                                } else {
                                  document.getElementById(`voucher_line_ledger_${idx + 1}`)?.focus();
                                }
                              }
                            }}
                            className="w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-right text-[#2588E8] font-mono font-bold focus:outline-hidden focus:border-[#2588E8]"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-[#7F98AE] font-mono text-xs pr-2">-</span>
                        )}
                      </td>

                      {/* Credit Input */}
                      <td className="py-1 px-3 text-right">
                        {line.type === 'CR' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={line.amount === 0 ? '' : line.amount}
                            onChange={(e) => handleLineChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (idx === lines.length - 1) {
                                  addLine();
                                } else {
                                  document.getElementById(`voucher_line_ledger_${idx + 1}`)?.focus();
                                }
                              }
                            }}
                            className="w-full h-[30px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 text-xs text-right text-[#2588E8] font-mono font-bold focus:outline-hidden focus:border-[#2588E8]"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-[#7F98AE] font-mono text-xs pr-2">-</span>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="py-1 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-[#7F98AE] hover:text-[#fca5a5] p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Action Bar Directly Above Total Debit / Credit */}
              <div className="py-1.5 px-3 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold font-mono px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + ADD ENTRY LINE
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autoBalance}
                    className="text-[10px] bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] px-2.5 py-1 rounded-lg font-mono transition cursor-pointer"
                    title="Auto copy debit amount to credit"
                  >
                    Auto-Balance
                  </button>
                </div>
              </div>
            </div>

            {/* Total Balancing Bar (Debit & Credit Totals) */}
            <div className="bg-[rgba(18,48,76,0.60)] backdrop-blur-xl py-1.5 px-3 rounded-xl border border-[rgba(112,185,245,0.25)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[#7F98AE] text-[10px]">TOTAL DEBIT: </span>
                  <span className="font-bold text-[#2588E8]">₹{roundedDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[#7F98AE] text-[10px]">TOTAL CREDIT: </span>
                  <span className="font-bold text-[#2588E8]">₹{roundedCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <div className="flex items-center gap-1 text-[#2588E8] bg-[#1b4332] border border-[rgba(112,185,245,0.25)] px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>BALANCED (DR = CR)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[#fca5a5] bg-[#421d23] border border-rose-800/50 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>DIFF: ₹{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-1">
              Narration / Transaction Description
            </label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Being cash deposited into State Bank of India Current Account"
              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg p-2 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 sm:py-2.5 border-t border-[rgba(112,185,245,0.25)] flex items-center justify-between bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-b-2xl shrink-0">
          <div className="text-[10px] text-[#7F98AE] font-mono">
            RULE: <span className="font-bold text-[#B7C9D9]">TOTAL DEBIT = TOTAL CREDIT</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!isBalanced || isSubmitting}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                isBalanced && !isSubmitting
                  ? 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF]'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] cursor-not-allowed border border-[rgba(112,185,245,0.25)]'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Post Voucher'}</span>
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] hover:bg-[rgba(57,167,255,0.15)] text-xs font-semibold text-[#B7C9D9] hover:text-[#FFFFFF] transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Voucher Post/Edit */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        itemDetails={confirmModal.details}
        confirmText={voucherToEdit ? 'Update Voucher' : 'Post Voucher'}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Voucher Series & Numbering Settings Modal */}
      <VoucherSeriesSettingsModal
        isOpen={isSeriesSettingsOpen}
        onClose={() => setIsSeriesSettingsOpen(false)}
        currentVoucherType={voucherType}
        fiscalYearShort={currentFiscalYear ? currentFiscalYear.name.replace('FY ', '') : '26-27'}
        ledgers={ledgers}
        onSeriesConfigUpdated={(newDefaultSeries) => {
          const updated = voucherSeriesService.getSeriesForVoucherType(voucherType);
          setSeriesList(updated);
          const targetSeries =
            newDefaultSeries ||
            (updated.some((s) => s.seriesName === selectedSeries) ? selectedSeries : updated[0]?.seriesName) ||
            'MAIN';
          setSelectedSeries(targetSeries);

          const active = updated.find((s) => s.seriesName === targetSeries) || updated[0];
          if (active && !voucherToEdit) {
            const fyShort = currentFiscalYear ? currentFiscalYear.name.replace('FY ', '') : '26-27';
            setVoucherNumber(voucherSeriesService.formatVoucherNumber(active, fyShort));
            const seriesDrIds = (active.defaultDrLedgerIds && active.defaultDrLedgerIds.length > 0)
              ? active.defaultDrLedgerIds.filter(Boolean)
              : (active.defaultDrLedgerId ? [active.defaultDrLedgerId] : []);
            const seriesCrIds = (active.defaultCrLedgerIds && active.defaultCrLedgerIds.length > 0)
              ? active.defaultCrLedgerIds.filter(Boolean)
              : (active.defaultCrLedgerId ? [active.defaultCrLedgerId] : []);

            if (seriesDrIds.length > 0 || seriesCrIds.length > 0) {
              const newLines: VoucherLine[] = [];
              if (seriesDrIds.length > 0) {
                seriesDrIds.forEach((drId) => {
                  const led = ledgers.find((item) => item.id === drId);
                  newLines.push({
                    id: uuidv4(),
                    uuid: uuidv4(),
                    ledgerId: drId,
                    ledgerName: led?.name,
                    type: 'DR',
                    amount: 0,
                  });
                });
              } else {
                newLines.push({ id: uuidv4(), uuid: uuidv4(), ledgerId: '', type: 'DR', amount: 0 });
              }

              if (seriesCrIds.length > 0) {
                seriesCrIds.forEach((crId) => {
                  const led = ledgers.find((item) => item.id === crId);
                  newLines.push({
                    id: uuidv4(),
                    uuid: uuidv4(),
                    ledgerId: crId,
                    ledgerName: led?.name,
                    type: 'CR',
                    amount: 0,
                  });
                });
              } else {
                newLines.push({ id: uuidv4(), uuid: uuidv4(), ledgerId: '', type: 'CR', amount: 0 });
              }
              setLines(newLines);
            }
          }
        }}
      />

      {/* Full Original Ledger Modal for adding account on-the-fly */}
      <FullLedgerMasterModal
        isOpen={quickLedgerModal.open}
        initialName=""
        onClose={() => setQuickLedgerModal({ open: false, lineIdx: null })}
        onCreated={async (newLedger) => {
          await refreshActiveData();
          if (quickLedgerModal.lineIdx !== null) {
            handleLineChange(quickLedgerModal.lineIdx, 'ledgerId', newLedger.id);
            setTimeout(() => {
              document.getElementById(`voucher_line_ledger_${quickLedgerModal.lineIdx}`)?.focus();
            }, 60);
          }
          setQuickLedgerModal({ open: false, lineIdx: null });
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title={`Save ${voucherType} Voucher Before Closing?`}
        message={`Do you want to save ${voucherType} voucher "${voucherNumber || 'this entry'}" (Amount: ₹${roundedDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) before closing this form?`}
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
