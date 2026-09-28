import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Plus, Trash2, Printer, Save, FileText,
  Truck, MapPin, Phone, Scale, Warehouse,
  Building2, DollarSign, Calendar, AlertCircle, CheckCircle2,
  Settings, Edit2, Calculator, RefreshCw, ChevronDown, Check, ArrowLeft,
  ExternalLink, SlidersHorizontal, Copy, Minus
} from "lucide-react";
import { PdfFileIcon, ExcelFileIcon } from "./common/DocumentIcons";
import { db } from "../db";
import { PartySelectDropdown } from "./PartySelectDropdown";
import { useApp } from "../context/AppContext";
import { parseDisplayToISO, getTodayISO, formatDateDisplay } from "../utils/dateUtils";
import { DateInput } from "./common/DateInput";
import { dbStorage } from "../services/storage/indexedDbStorage";
import { v4 as uuidv4 } from "uuid";
import { Voucher, VoucherSeriesConfig, VoucherType, InventoryItem, SeriesBillSundryConfig, Company, FiscalYear } from "../types";
import { ExportEngine } from "../services/exportEngine";
import { SalesSeriesSettingsModal } from "./accounting/SalesSeriesSettingsModal";
import { FullItemMasterModal } from "./master/FullItemMasterModal";
import { FullLedgerMasterModal } from "./master/FullLedgerMasterModal";
import { FullSparePartModal } from "./master/FullSparePartModal";
import { FormCloseConfirmModal } from "./common/FormCloseConfirmModal";
import { useFormEscapeClose } from "../utils/useFormEscapeClose";
import { SearchableDropdown } from "./common/SearchableDropdown";
import { voucherSeriesService } from "../services/voucherSeriesService";
import { getDefaultInventoryItems } from "../services/storage/defaultData";
import { inventoryEngine } from "../services/inventoryEngine";
import { formatAmount, formatQty, formatPcs, formatCurrency } from "../utils/formatUtils";
import { DespatchItemDetailContent } from "./DespatchItemDetailContent";
import { printElementById, openElementInPrintTab } from "../utils/printHelper";
import { exportInvoicePreviewToExactPdf, exportInvoicePreviewToExactExcel } from "../utils/invoiceExportUtils";

export interface InvoiceItemRow {
  id: string;
  item: string;
  ledger?: string;
  reference?: string;
  pcs: number | string;
  qty: number | string;
  unit: string;
  taxPercent?: number | string;  // Tax % from item master (display only, no totals)
  rate: number | string;
  amount: number | string;
  pakkaAmount?: number | string; // Pakka amount field – saved to bill, not totalled
}

export interface BillSundryRow {
  name: string;
  amount: number | string;
  type: "ADD" | "SUBTRACT" | "ADD_LESS";
  rate?: number | string;
  isPercentage?: boolean;
  calculateOn?: "SUB_TOTAL" | "PAKKA" | "KACHA";
}

// Indian thousand separator and 2-decimal formatting helper (supports negative numbers)
const formatIndianNumberWithDecimals = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "";
  const rawStr = String(val).trim();
  if (
    rawStr.toLowerCase() === "nan" ||
    rawStr.toLowerCase() === "null" ||
    rawStr.toLowerCase() === "undefined"
  ) {
    return "";
  }
  const cleanStr = rawStr.replace(/[₹,\s]/g, "").trim();
  const num = Number(cleanStr);
  if (!isNaN(num) && cleanStr !== "") {
    const isNeg = num < 0;
    const absFormatted = Math.abs(num).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isNeg ? `-${absFormatted}` : absFormatted;
  }
  return cleanStr.toLowerCase() === "nan" ? "" : rawStr;
};

// Safe number parser stripping commas
const parseNumberValue = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleanStr = String(val).replace(/,/g, "").trim();
  const num = Number(cleanStr);
  return isNaN(num) ? 0 : num;
};

// Convert number to Indian currency words
const numberToIndianWords = (amount: number): string => {
  if (isNaN(amount) || amount === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    let str = "";
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      if (n < 20) str += a[n] + " ";
      else {
        str += b[Math.floor(n / 10)] + " ";
        if (n % 10 > 0) str += a[n % 10] + " ";
      }
    }
    return str.trim();
  };

  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let result = inWords(rupees) + " Rupees";
  if (paise > 0) {
    result += " and " + inWords(paise) + " Paise";
  }
  return result + " Only";
};

export const SalesInvoiceModal: React.FC<{
  initialData?: any;
  nextBillNo?: string;
  formType?: "sales_invoice" | "purchase_invoice" | "spare_parts_purchase";
  defaultPrintView?: boolean;
  ownerKey?: string;
  onClose: () => void;
  onSaveSuccess: () => void;
}> = ({ initialData, nextBillNo = "", formType = "sales_invoice", defaultPrintView = false, ownerKey = "voucher", onClose, onSaveSuccess }) => {
  const {
    showNotification,
    currentCompany,
    currentFiscalYear,
    ledgers,
    refreshVouchers,
    inventoryItems,
    locations,
    minimizedInvoice,
    setMinimizedInvoice,
    registerRestoreInvoiceHandler,
    registerCloseInvoiceHandler,
  } = useApp();
  const isPurchase = formType === "purchase_invoice" || formType === "spare_parts_purchase";
  const isSpareParts = formType === "spare_parts_purchase";

  // Active locations from Location Master
  const activeLocations = React.useMemo(() => {
    return (locations || []).filter((l) => l.isActive !== false);
  }, [locations]);

  // Parse if initialData has JSON notes
  const parsedNotes = React.useMemo(() => {
    if (initialData?.notes) {
      try {
        return JSON.parse(initialData.notes);
      } catch {
        return null;
      }
    }
    return null;
  }, [initialData]);
  
  // Header Info - safely parse date to ISO
  const initialIsoDate = React.useMemo(() => {
    if (initialData?.date) {
      return parseDisplayToISO(initialData.date);
    }
    return getTodayISO();
  }, [initialData?.date]);

  // Series configuration & voucher type
  const voucherTypeForSeries: VoucherType = isPurchase ? "PURCHASE" : "SALES";
  const [isSeriesSettingsOpen, setIsSeriesSettingsOpen] = useState(false);
  const [availableSeriesList, setAvailableSeriesList] = useState<VoucherSeriesConfig[]>(() =>
    voucherSeriesService.getSeriesForVoucherType(voucherTypeForSeries)
  );

  const initialSeriesName =
    parsedNotes?.series ||
    availableSeriesList.find((s) => s.isDefault)?.seriesName ||
    availableSeriesList[0]?.seriesName ||
    "MAIN";

  const initialLocation =
    parsedNotes?.location ||
    (locations || []).find((l) => l.isDefault)?.name ||
    (locations || [])[0]?.name ||
    "";

  const initialParty = React.useMemo(() => {
    if (initialData?.partyName) return initialData.partyName;
    if (initialData?.lines && Array.isArray(initialData.lines)) {
      if (isPurchase) {
        // In purchase voucher, credit line is the supplier/vendor
        const crLine = initialData.lines.find((l: any) => l.type === 'CR');
        if (crLine?.ledgerName) return crLine.ledgerName;
      } else {
        // In sales voucher, debit line is the customer
        const drLine = initialData.lines.find((l: any) => l.type === 'DR');
        if (drLine?.ledgerName) return drLine.ledgerName;
      }
    }
    return "";
  }, [initialData, isPurchase]);

  const [series, setSeries] = useState(initialSeriesName);
  const [location, setLocation] = useState(initialLocation);
  const [billNo, setBillNo] = useState(initialData?.refNo || initialData?.voucherNumber || nextBillNo);
  const [date, setDate] = useState(initialIsoDate);
  const [party, setParty] = useState(initialParty);
  const [salesAc, setSalesAc] = useState(parsedNotes?.salesAc || "");
  const [reference, setReference] = useState(parsedNotes?.reference || (initialData?.notes && typeof initialData.notes === 'string' ? JSON.parse(initialData.notes)?.reference : "") || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-set default location if not yet selected
  useEffect(() => {
    if (!location && !parsedNotes?.location && locations && locations.length > 0) {
      const def = locations.find((l) => l.isDefault)?.name || locations[0]?.name || "";
      if (def) {
        setLocation(def);
      }
    }
  }, [locations, parsedNotes?.location, location]);

  // Logistics & Dispatch
  const [weight, setWeight] = useState(parsedNotes?.weight || "");
  const [fare, setFare] = useState<number | string>(() =>
    parsedNotes?.fare !== undefined && parsedNotes?.fare !== null && parsedNotes?.fare !== ""
      ? formatIndianNumberWithDecimals(parsedNotes.fare)
      : ""
  );
  const [truck, setTruck] = useState(parsedNotes?.truck || initialData?.extra1 || "");
  const [mobile, setMobile] = useState(parsedNotes?.mobile || "");
  const [advance, setAdvance] = useState<number | string>(() => {
    if (parsedNotes?.advance !== undefined && parsedNotes?.advance !== null && parsedNotes?.advance !== "") {
      const formatted = formatIndianNumberWithDecimals(parsedNotes.advance);
      return formatted.toLowerCase() === "nan" ? "" : formatted;
    }
    return "";
  });
  const [destination, setDestination] = useState(parsedNotes?.destination || "");

  // Spare Parts Catalog suggestions
  const sparePartsSuggestions = React.useMemo(() => {
    if (typeof window !== 'undefined' && currentCompany?.id) {
      try {
        const raw = localStorage.getItem(`bahi_khata_spare_parts_${currentCompany.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p: any) => p.name).filter(Boolean);
          }
        }
      } catch {
        // ignore
      }
    }
    return [
      'Diamond Gangsaw Blade Segments (4x10x20mm)',
      'Shell Tellus 68 Hydraulic Oil',
      'SKF Spherical Roller Bearing 22220',
      'Silicon Carbide Frankfurts #120',
      'EOT Crane Steel Wire Rope 16mm',
      'Gangsaw Tensioner Hydraulic Seal Kit',
      'Block Cutter Segmented Circular Blade 2000mm',
      'High-Pressure Water Nozzles 1/4" NPT',
      'Castrol Industrial Gear Oil Alpha SP 320',
      'Grease EP-2 High Temperature',
    ];
  }, [currentCompany?.id]);

  // Available Ledgers for Line Items
  const availableLedgers = React.useMemo(() => {
    const list: string[] = [];
    const defaults = isSpareParts
      ? ["Spare Parts & Machine Maintenance", "Consumables & Store A/c", "GST Purchase 18%"]
      : isPurchase
      ? ["Purchase Account", "GST Purchase 18%", "GST Purchase 12%", "GST Purchase 5%", "Raw Blocks Purchase A/c", "Interstate Purchase A/c"]
      : ["GST Sales 18%", "GST Sales 12%", "GST Sales 5%", "GST Sales 28%", "Marble Sales A/c", "Granite & Slab Sales", "Interstate Sales (IGST 18%)", "Nil-Rated / Exempted Sales"];
      
    defaults.forEach(d => {
      if (!list.includes(d)) list.push(d);
    });

    if (salesAc && !list.includes(salesAc)) {
      list.unshift(salesAc);
    }

    if (Array.isArray(ledgers) && ledgers.length > 0) {
      ledgers.forEach(l => {
        if (l?.name && !list.includes(l.name)) {
          list.push(l.name);
        }
      });
    }

    return list;
  }, [ledgers, isSpareParts, isPurchase, salesAc]);

  // Grid Items
  const [items, setItems] = useState<InvoiceItemRow[]>(() => {
    if (Array.isArray(parsedNotes?.items) && parsedNotes.items.length > 0) {
      return parsedNotes.items.map((it: any) => ({
        ...it,
        rate: it.rate !== undefined && it.rate !== null && it.rate !== "" && !isNaN(Number(String(it.rate).replace(/,/g, "")))
          ? Number(String(it.rate).replace(/,/g, "")).toFixed(2)
          : it.rate || "",
        pcs: it.pcs !== undefined && it.pcs !== null && it.pcs !== "" && !isNaN(Number(String(it.pcs).replace(/,/g, "")))
          ? Number(String(it.pcs).replace(/,/g, "")).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : it.pcs || "",
      }));
    }
    if (Array.isArray(initialData?.inventoryLines) && initialData.inventoryLines.length > 0) {
      return initialData.inventoryLines.map((il: any, idx: number) => ({
        id: String(idx + 1),
        item: il.itemName || "",
        ledger: "",
        pcs: il.alternateQty ? String(il.alternateQty) : "",
        qty: il.quantity ? String(il.quantity) : "",
        unit: il.unit || (isSpareParts ? "NOS" : "SQFT"),
        rate: il.rate ? String(il.rate) : "",
        amount: il.amount ? String(il.amount) : "",
      }));
    }
    return [
      {
        id: "1",
        item: "",
        ledger: "",
        pcs: "",
        qty: "",
        unit: isSpareParts ? "NOS" : "SQFT",
        rate: "",
        amount: "",
      },
    ];
  });

  // Bill Sundries
  const [billSundries, setBillSundries] = useState<BillSundryRow[]>(() => {
    if (Array.isArray(parsedNotes?.billSundries) && parsedNotes.billSundries.length > 0) {
      return parsedNotes.billSundries.map((s: any) => {
        const numVal = parseNumberValue(s.amount);
        return {
          ...s,
          amount: numVal !== 0 ? numVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (s.amount && String(s.amount).toLowerCase() !== "nan" ? String(s.amount) : "0.00"),
        };
      });
    }
    return [];
  });
  const [customSundryRows, setCustomSundryRows] = useState<{ [index: number]: boolean }>({});
  const [customItemRows, setCustomItemRows] = useState<{ [index: number]: boolean }>({});
  const [masterItems, setMasterItems] = useState<InventoryItem[]>([]);

  // Focus tracking state for smooth formatted input entry
  const [focusedQtyRow, setFocusedQtyRow] = useState<number | null>(null);
  const [focusedPcsRow, setFocusedPcsRow] = useState<number | null>(null);
  const [focusedSundryRateIdx, setFocusedSundryRateIdx] = useState<number | null>(null);
  const [focusedSundryAmountIdx, setFocusedSundryAmountIdx] = useState<number | null>(null);

  // Quick Create Item & Ledger & Spare Part Modal states
  const [quickItemModalOpen, setQuickItemModalOpen] = useState(false);
  const [quickItemRowIndex, setQuickItemRowIndex] = useState<number | null>(null);
  const [quickLedgerModalOpen, setQuickLedgerModalOpen] = useState(false);
  const [quickLedgerRowIndex, setQuickLedgerRowIndex] = useState<number | null>(null);
  const [quickSparePartModalOpen, setQuickSparePartModalOpen] = useState(false);
  const [quickSparePartRowIndex, setQuickSparePartRowIndex] = useState<number | null>(null);

  // Minimized state to taskbar
  // Initialize as true if there's already a minimized invoice (handles tab-switch remount)
  const [isMinimized, setIsMinimized] = useState(() => Boolean(minimizedInvoice));

  // Stable refs to avoid useEffect re-runs due to prop reference changes
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const setMinimizedInvoiceRef = React.useRef(setMinimizedInvoice);
  setMinimizedInvoiceRef.current = setMinimizedInvoice;

  // Register restore and close invoice handlers for the workspace taskbar — run only once
  useEffect(() => {
    if (!registerRestoreInvoiceHandler || !registerCloseInvoiceHandler) return;

    registerRestoreInvoiceHandler(() => {
      setIsMinimized(false);
      // Delay clearing minimizedInvoice so the modal stays mounted during this render cycle
      requestAnimationFrame(() => {
        setMinimizedInvoiceRef.current(null);
      });
    });

    registerCloseInvoiceHandler(() => {
      setIsMinimized(false);
      setMinimizedInvoiceRef.current(null);
      onCloseRef.current();
    });

    return () => {
      registerRestoreInvoiceHandler(null);
      registerCloseInvoiceHandler(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerRestoreInvoiceHandler, registerCloseInvoiceHandler]);

  const handleMinimize = () => {
    setIsMinimized(true);
    setMinimizedInvoice({
      title: isSpareParts ? "Spare Parts Bill" : isPurchase ? "Purchase Bill" : "Sale Bill",
      formType,
      ownerId: ownerKey,
      billNo: billNo || nextBillNo || "New",
      party: party || "Cash Sale",
    });
  };

  const handleModalClose = () => {
    setMinimizedInvoice(null);
    onClose();
  };

  // Form close confirmation on Escape
  const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);

  useFormEscapeClose({
    isOpen: !isMinimized && !isSeriesSettingsOpen && !quickItemModalOpen && !quickLedgerModalOpen && !quickSparePartModalOpen,
    onAttemptClose: () => setShowEscapeConfirm(true),
  });

  const handleEscapeSave = () => {
    if (!party || !party.trim()) {
      showNotification('Data is needed in "Party / Customer Name" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => {
        const pInput = document.getElementById("party_select_input") || document.querySelector('input[placeholder*="Customer" i], input[placeholder*="Vendor" i]') as HTMLElement;
        pInput?.focus();
      }, 80);
      return;
    }
    if (!billNo || !billNo.trim()) {
      showNotification('Data is needed in "Invoice / Bill Number" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => {
        document.getElementById("sales_bill_no_input")?.focus();
      }, 80);
      return;
    }
    const isItemRowEmpty = (r: InvoiceItemRow) => {
      const hasItem = Boolean(r.item && r.item.trim());
      const hasRef = Boolean(r.reference && r.reference.trim());
      const hasQty = r.qty !== undefined && r.qty !== null && String(r.qty).trim() !== "" && Number(r.qty) !== 0;
      const hasPcs = r.pcs !== undefined && r.pcs !== null && String(r.pcs).trim() !== "" && Number(r.pcs) !== 0;
      const hasRate = r.rate !== undefined && r.rate !== null && String(r.rate).trim() !== "" && Number(r.rate) !== 0;
      const hasAmount = r.amount !== undefined && r.amount !== null && String(r.amount).trim() !== "" && Number(r.amount) !== 0;
      return !hasItem && !hasRef && !hasQty && !hasPcs && !hasRate && !hasAmount;
    };
    const validItems = items.filter((r) => !isItemRowEmpty(r));
    if (validItems.length === 0) {
      showNotification('Data is needed in "Item Details" field.', 'error');
      setShowEscapeConfirm(false);
      setTimeout(() => {
        const el = document.getElementById("sales_item_input_0") || document.getElementById("sales_item_dropdown_0");
        el?.focus();
      }, 80);
      return;
    }

    setShowEscapeConfirm(false);
    handleSaveInvoice();
  };

  // Auto-focus first field when form opens
  useEffect(() => {
    const focusFirst = () => {
      const seriesSelect = document.getElementById("sales_series_dropdown");
      const partyInput = document.getElementById("party_select_input") || document.querySelector('input[placeholder*="Customer" i], input[placeholder*="Vendor" i]');
      const target = seriesSelect || partyInput;
      if (target) {
        (target as HTMLElement).focus();
      }
    };
    const t1 = setTimeout(focusFirst, 60);
    const t2 = setTimeout(focusFirst, 180);
    const t3 = setTimeout(focusFirst, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Fetch items from Item Master (Database or default inventory)
  useEffect(() => {
    let isMounted = true;
    const fetchMasterItems = async () => {
      try {
        const dbItems = await dbStorage.getInventoryItems();
        if (isMounted) {
          if (Array.isArray(dbItems) && dbItems.length > 0) {
            setMasterItems(dbItems);
          } else if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
            setMasterItems(inventoryItems);
          } else if (currentCompany?.id) {
            setMasterItems(getDefaultInventoryItems(currentCompany.id));
          }
        }
      } catch {
        if (isMounted && Array.isArray(inventoryItems)) {
          setMasterItems(inventoryItems);
        }
      }
    };
    fetchMasterItems();
    return () => {
      isMounted = false;
    };
  }, [currentCompany?.id, inventoryItems]);

  // Real-time listener for master updates
  useEffect(() => {
    const handleMasterUpdate = async () => {
      try {
        const dbItems = await dbStorage.getInventoryItems();
        if (Array.isArray(dbItems) && dbItems.length > 0) {
          setMasterItems(dbItems);
        }
      } catch (err) {
        console.error('Error refreshing master items on master-updated:', err);
      }
    };
    window.addEventListener('master-updated', handleMasterUpdate);
    return () => window.removeEventListener('master-updated', handleMasterUpdate);
  }, []);

  // Helper to match master item flexibly by name or code
  const findMasterItem = (nameOrCode: string) => {
    if (!nameOrCode) return undefined;
    const clean = nameOrCode.trim().toLowerCase();
    return masterItems.find(
      (m) =>
        m.name.trim().toLowerCase() === clean ||
        (m.code && m.code.trim().toLowerCase() === clean) ||
        (clean.length >= 4 && m.name.trim().toLowerCase().includes(clean)) ||
        (clean.length >= 4 && clean.includes(m.name.trim().toLowerCase()))
    );
  };

  // Determine unit and dual unit capabilities from selected item
  const getItemUnitInfo = (itemName: string, explicitItem?: InventoryItem) => {
    if (!itemName) {
      return {
        mainUnit: isSpareParts ? "NOS" : "SQFT",
        hasDualUnit: true,
        alternateUnit: "PCS",
        conversionFactor: 1,
        conversionDirection: "PRIMARY_TO_ALT" as const,
        formulaDescription: "",
        decimalPlaces: 2,
        item: null,
      };
    }
    const found = explicitItem || findMasterItem(itemName);
    if (found) {
      const mainUnit = found.primaryUnit || (isSpareParts ? "NOS" : "SQFT");
      const altUnit = found.alternateUnit?.trim() || "PCS";
      const hasDualUnit = true; // Kota Stone, Marble, Granite, Tiles etc. can always record Pcs count
      const factor = found.conversionFactor;
      const dir = found.conversionDirection || (factor && factor < 1 ? "PRIMARY_TO_ALT" : "ALT_TO_PRIMARY");
      
      let formulaDescription = "";
      if (factor && factor > 0) {
        if (dir === "PRIMARY_TO_ALT" || factor < 1) {
          formulaDescription = `1 ${mainUnit} = ${factor} ${altUnit}`;
        } else {
          formulaDescription = `1 ${altUnit} = ${factor} ${mainUnit}`;
        }
      }

      return {
        mainUnit,
        hasDualUnit: true,
        alternateUnit: altUnit,
        conversionFactor: factor,
        conversionDirection: dir,
        formulaDescription,
        decimalPlaces:
          found?.decimalPlaces !== undefined &&
          found?.decimalPlaces !== null &&
          (found?.decimalPlaces as any) !== "" &&
          !isNaN(Number(found.decimalPlaces))
            ? Number(found.decimalPlaces)
            : 2,
        item: found,
      };
    }
    return {
      mainUnit: isSpareParts ? "NOS" : "SQFT",
      hasDualUnit: true,
      alternateUnit: "PCS",
      conversionFactor: undefined,
      conversionDirection: undefined,
      formulaDescription: "",
      decimalPlaces: 2,
      item: null,
    };
  };

  const handleItemCreated = async (newItem: InventoryItem) => {
    try {
      const dbItems = await dbStorage.getInventoryItems();
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        setMasterItems(dbItems);
      } else {
        setMasterItems((prev) => [...prev, newItem]);
      }
    } catch {
      setMasterItems((prev) => [...prev, newItem]);
    }

    if (quickItemRowIndex !== null && quickItemRowIndex >= 0 && quickItemRowIndex < items.length) {
      handleItemSelect(quickItemRowIndex, newItem.name, newItem);
      setTimeout(() => {
        const el = document.getElementById(`sales_item_dropdown_${quickItemRowIndex}`) || document.getElementById(`sales_item_input_${quickItemRowIndex}`);
        el?.focus();
      }, 70);
    }
    setQuickItemModalOpen(false);
  };

  const handleItemSelect = (index: number, selectedName: string, explicitItem?: InventoryItem) => {
    if (selectedName === "__ADD_ITEM__") {
      setQuickItemRowIndex(index);
      setQuickItemModalOpen(true);
      return;
    }

    if (selectedName === "__CUSTOM__") {
      setCustomItemRows((prev) => ({ ...prev, [index]: true }));
      return;
    }

    const unitInfo = getItemUnitInfo(selectedName, explicitItem);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      item: selectedName,
      unit: unitInfo.mainUnit,
    };

    const found = explicitItem || masterItems.find(
      (m) => m.name.trim().toLowerCase() === selectedName.trim().toLowerCase()
    );
    if (found) {
      const itemAc = isPurchase
        ? (found.purchaseAccountId || found.purchaseAc)
        : (found.salesAccountId || found.salesAc);
      if (itemAc && !updated[index].ledger) {
        updated[index].ledger = itemAc;
      }

      // Auto-set taxPercent from item master
      if (found.taxPercent !== undefined && found.taxPercent !== null && found.taxPercent !== "") {
        updated[index].taxPercent = found.taxPercent;
      }

      // Auto-set rate to 2 decimal places from item master opening rate or existing rate
      if (found.openingRate !== undefined && found.openingRate !== null && !updated[index].rate) {
        updated[index].rate = Number(found.openingRate).toFixed(2);
      } else if (updated[index].rate !== "" && !isNaN(Number(String(updated[index].rate).replace(/,/g, "")))) {
        updated[index].rate = Number(String(updated[index].rate).replace(/,/g, "")).toFixed(2);
      }

      // Auto-calculate quantity from alternate unit (Pcs) if already entered!
      const currentPcs = parseNumberValue(updated[index].pcs);
      if (found.conversionFactor && !isNaN(currentPcs) && currentPcs > 0) {
        const calculatedQty = inventoryEngine.convertUnits(
          currentPcs,
          "ALTERNATE",
          found.conversionFactor,
          found.conversionDirection
        );
        updated[index].qty = calculatedQty;
        const r = parseNumberValue(updated[index].rate) || 0;
        updated[index].amount = Number((calculatedQty * r).toFixed(2));
      } else if (
        found.conversionFactor &&
        parseNumberValue(updated[index].qty) > 0 &&
        (!updated[index].pcs || updated[index].pcs === "0") &&
        unitInfo.hasDualUnit
      ) {
        const calculatedPcs = inventoryEngine.convertUnits(
          parseNumberValue(updated[index].qty),
          "PRIMARY",
          found.conversionFactor,
          found.conversionDirection
        );
        updated[index].pcs = Number(calculatedPcs.toFixed(2));
      }
    }

    setItems(updated);
  };

  // Categorized Ledgers for Sundry Dropdown
  const sundryTaxLedgers = React.useMemo(() => {
    return ledgers.filter(
      (l) =>
        l.groupId === "grp-duties-taxes" ||
        l.accountType === "LIABILITY" ||
        l.name.toUpperCase().includes("GST") ||
        l.name.toUpperCase().includes("TAX") ||
        l.name.toUpperCase().includes("TCS")
    );
  }, [ledgers]);

  // All unique tax % options — standard GST slabs + any custom % from item master
  const taxPercentOptions = React.useMemo<number[]>(() => {
    const standard: number[] = [0, 0.1, 0.25, 1.5, 3, 5, 6, 12, 18, 28];
    const fromMaster: number[] = masterItems
      .map((m) => m.taxPercent)
      .filter((v): v is number | string => v !== undefined && v !== null && v !== "")
      .map((v) => Number(v))
      .filter((v) => !isNaN(v) && !standard.includes(v));
    return [...standard, ...Array.from(new Set(fromMaster))].sort((a: number, b: number) => a - b);
  }, [masterItems]);

  const sundryExpenseLedgers = React.useMemo(() => {
    return ledgers.filter(
      (l) =>
        (l.accountType === "DIRECT_EXPENSE" ||
          l.accountType === "INDIRECT_EXPENSE" ||
          l.name.toUpperCase().includes("FREIGHT") ||
          l.name.toUpperCase().includes("LOADING") ||
          l.name.toUpperCase().includes("DISCOUNT") ||
          l.name.toUpperCase().includes("ROUND") ||
          l.name.toUpperCase().includes("INSURANCE") ||
          l.name.toUpperCase().includes("CARTAGE")) &&
        !sundryTaxLedgers.some((t) => t.id === l.id)
    );
  }, [ledgers, sundryTaxLedgers]);

  const otherSundryLedgers = React.useMemo(() => {
    const existingIds = new Set([...sundryTaxLedgers.map((l) => l.id), ...sundryExpenseLedgers.map((l) => l.id)]);
    return ledgers.filter((l) => !existingIds.has(l.id));
  }, [ledgers, sundryTaxLedgers, sundryExpenseLedgers]);

  // Pakka / Kacha Split (Defaults to empty string when not explicitly provided)
  const [pakka, setPakka] = useState<string>(() => {
    const raw = initialData?.pakka ?? parsedNotes?.pakka;
    if (raw !== undefined && raw !== null) {
      const s = String(raw).trim();
      if (s !== "" && s !== "0" && s !== "0.00") return s;
    }
    return "";
  });
  const [kacha, setKacha] = useState<string>(() => {
    const raw = initialData?.kacha ?? parsedNotes?.kacha;
    if (raw !== undefined && raw !== null) {
      const s = String(raw).trim();
      if (s !== "" && s !== "0" && s !== "0.00") return s;
    }
    return "";
  });

  // Print Preview state
  const [showPrintView, setShowPrintView] = useState(defaultPrintView);
  const [printSheetType, setPrintSheetType] = useState<"half_sheet" | "a5_portrait" | "full_sheet">("half_sheet");
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  // Print Settings & Layout Customizations
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [printScale, setPrintScale] = useState<number>(100);
  const [printMargin, setPrintMargin] = useState<"compact" | "normal" | "wide">("compact");
  const [printColorMode, setPrintColorMode] = useState<"color" | "monochrome">("color");
  const [showDuplicateCopy, setShowDuplicateCopy] = useState<boolean>(false);
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Close print dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setIsPrintDropdownOpen(false);
      }
    };
    if (isPrintDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPrintDropdownOpen]);

  // Matching ledger for party details (GSTIN, address, state, phone)
  const partyLedger = React.useMemo(() => {
    if (!party) return null;
    return (ledgers || []).find(
      (l) => l.name?.toLowerCase().trim() === party.toLowerCase().trim()
    );
  }, [party, ledgers]);

  // Calculations with thousand separators parsing support
  const totalPcs = items.reduce((acc, curr) => acc + parseNumberValue(curr.pcs), 0);
  const totalQty = items.reduce((acc, curr) => acc + parseNumberValue(curr.qty), 0);
  const itemTotal = items.reduce((acc, curr) => acc + parseNumberValue(curr.amount), 0);
  const sundryTotal = billSundries.reduce((acc, curr) => {
    const amt = parseNumberValue(curr.amount);
    return curr.type === "SUBTRACT" ? acc - amt : acc + amt;
  }, 0);
  const grandTotal = Math.max(0, itemTotal + sundryTotal);

  // Dynamic decimal places based on items in invoice matched from Item Master
  const billDecimalPlaces = React.useMemo(() => {
    const decimals: number[] = [];
    for (const row of items) {
      if (!row.item) continue;
      const matched = findMasterItem(row.item);
      if (
        matched &&
        matched.decimalPlaces !== undefined &&
        matched.decimalPlaces !== null &&
        (matched.decimalPlaces as any) !== "" &&
        !isNaN(Number(matched.decimalPlaces))
      ) {
        decimals.push(Number(matched.decimalPlaces));
      }
    }
    if (decimals.length > 0) {
      return Math.max(...decimals);
    }
    return 2;
  }, [items, masterItems]);

  // Group and sort items alphabetically by item name for half-sheet print view
  const groupedAlphabeticalItems = React.useMemo(() => {
    const groups: Record<string, InvoiceItemRow[]> = {};
    items.forEach((it) => {
      const key = (it.item || "Marble / Granite").trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });

    const sortedNames = Object.keys(groups).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return sortedNames.map((name) => {
      const lines = groups[name];
      const groupPcs = lines.reduce((acc, curr) => acc + parseNumberValue(curr.pcs), 0);
      const groupQty = lines.reduce((acc, curr) => acc + parseNumberValue(curr.qty), 0);
      const unit = lines[0]?.unit || "SQFT";
      return {
        name,
        lines,
        totalPcs: groupPcs,
        totalQty: groupQty,
        unit,
      };
    });
  }, [items]);

  const getItemDec = (itemName: string) => {
    if (!itemName) return billDecimalPlaces;
    const mi = findMasterItem(itemName);
    if (
      mi &&
      mi.decimalPlaces !== undefined &&
      mi.decimalPlaces !== null &&
      (mi.decimalPlaces as any) !== "" &&
      !isNaN(Number(mi.decimalPlaces))
    ) {
      return Number(mi.decimalPlaces);
    }
    return billDecimalPlaces;
  };

  // Only auto-adjust Kacha if user has explicitly provided a non-empty Pakka amount
  useEffect(() => {
    const cleanPakka = pakka ? String(pakka).replace(/,/g, "").trim() : "";
    if (cleanPakka !== "" && !isNaN(Number(cleanPakka)) && Number(cleanPakka) !== 0) {
      const pNum = parseNumberValue(cleanPakka);
      const diff = Number((grandTotal - pNum).toFixed(2));
      setKacha(formatIndianNumberWithDecimals(diff));
    }
  }, [grandTotal]);

  const handlePakkaChange = (rawVal: string) => {
    setPakka(rawVal);
    const clean = rawVal.replace(/,/g, "").trim();
    if (clean === "") {
      setKacha("");
      const hasPakkaOrKachaSundry = billSundries.some(
        (s) => s.isPercentage && (s.calculateOn === "PAKKA" || s.calculateOn === "KACHA")
      );
      if (hasPakkaOrKachaSundry) {
        setBillSundries((prev) =>
          recalculateSundries(prev, itemTotal, series, "", "")
        );
      }
      return;
    }

    const pNum = parseNumberValue(rawVal);
    const diff = Number((grandTotal - pNum).toFixed(2));
    const kachaStr = formatIndianNumberWithDecimals(diff);
    setKacha(kachaStr);

    const hasPakkaOrKachaSundry = billSundries.some(
      (s) => s.isPercentage && (s.calculateOn === "PAKKA" || s.calculateOn === "KACHA")
    );
    if (hasPakkaOrKachaSundry) {
      setBillSundries((prev) =>
        recalculateSundries(prev, itemTotal, series, rawVal, String(diff))
      );
    }
  };

  const handlePakkaBlur = () => {
    const clean = pakka.replace(/,/g, "").trim();
    if (clean === "" || clean === "0" || clean === "0.00") {
      setPakka("");
      setKacha("");
      return;
    }
    const pNum = parseNumberValue(pakka);
    let diff = 0;
    if (pNum !== 0) {
      setPakka(formatIndianNumberWithDecimals(pNum));
      diff = Number((grandTotal - pNum).toFixed(2));
      const kachaStr = formatIndianNumberWithDecimals(diff);
      setKacha(kachaStr);
    }

    const hasPakkaOrKachaSundry = billSundries.some(
      (s) => s.isPercentage && (s.calculateOn === "PAKKA" || s.calculateOn === "KACHA")
    );
    if (hasPakkaOrKachaSundry) {
      setBillSundries((prev) =>
        recalculateSundries(prev, itemTotal, series, String(pNum), String(diff))
      );
    }
  };

  const handleKachaChange = (rawVal: string) => {
    setKacha(rawVal);
    const hasKachaSundry = billSundries.some(
      (s) => s.isPercentage && s.calculateOn === "KACHA"
    );
    if (hasKachaSundry) {
      setBillSundries((prev) =>
        recalculateSundries(prev, itemTotal, series, pakka, rawVal)
      );
    }
  };

  const handleKachaBlur = () => {
    const clean = String(kacha).replace(/,/g, "").trim();
    if (clean === "" || clean === "0" || clean === "0.00") {
      setKacha("");
    } else if (!isNaN(Number(clean))) {
      setKacha(formatIndianNumberWithDecimals(clean));
    }
    const hasKachaSundry = billSundries.some(
      (s) => s.isPercentage && s.calculateOn === "KACHA"
    );
    if (hasKachaSundry) {
      setBillSundries((prev) =>
        recalculateSundries(prev, itemTotal, series, pakka, kacha)
      );
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemRow, value: any) => {
    const updated = [...items];
    const currentRow = { ...updated[index], [field]: value };
    const matchedMasterItem = masterItems.find(
      (m) => m.name.trim().toLowerCase() === (currentRow?.item || "").trim().toLowerCase()
    );

    const q = parseNumberValue(field === "qty" ? value : currentRow.qty);
    const r = parseNumberValue(field === "rate" ? value : currentRow.rate);
    const a = parseNumberValue(field === "amount" ? value : currentRow.amount);

    if (field === "pcs") {
      const pcsVal = value;
      const pcsNum = parseNumberValue(pcsVal);
      currentRow.pcs = pcsVal;

      if (!isNaN(pcsNum) && pcsNum > 0 && matchedMasterItem?.conversionFactor) {
        const calculatedQty = inventoryEngine.convertUnits(
          pcsNum,
          "ALTERNATE",
          matchedMasterItem.conversionFactor,
          matchedMasterItem.conversionDirection
        );
        currentRow.qty = calculatedQty;
      }

      const currentQ = parseNumberValue(currentRow.qty);
      const currentR = parseNumberValue(currentRow.rate);
      const currentA = parseNumberValue(currentRow.amount);

      if (!isNaN(currentQ) && !isNaN(currentR) && currentR > 0) {
        currentRow.amount = Number((currentQ * currentR).toFixed(2));
      } else if (!isNaN(currentQ) && currentQ > 0 && !isNaN(currentA) && currentA > 0) {
        currentRow.rate = Number((currentA / currentQ).toFixed(2)).toFixed(2);
      }
    } else if (field === "qty") {
      if (!isNaN(q) && !isNaN(r) && r > 0) {
        currentRow.amount = Number((q * r).toFixed(2));
      } else if (!isNaN(q) && q > 0 && !isNaN(a) && a > 0) {
        currentRow.rate = Number((a / q).toFixed(2)).toFixed(2);
      }

      // Auto-calculate pcs if master item has alternate unit and conversion factor
      if (
        matchedMasterItem?.alternateUnit &&
        matchedMasterItem.alternateUnit.toUpperCase() !== matchedMasterItem.primaryUnit.toUpperCase() &&
        matchedMasterItem.conversionFactor &&
        !isNaN(q) &&
        q > 0
      ) {
        const calculatedPcs = inventoryEngine.convertUnits(
          q,
          "PRIMARY",
          matchedMasterItem.conversionFactor,
          matchedMasterItem.conversionDirection
        );
        currentRow.pcs = Number(calculatedPcs.toFixed(2));
      }
    } else if (field === "rate") {
      if (!isNaN(q) && !isNaN(r) && q > 0) {
        currentRow.amount = Number((q * r).toFixed(2));
      } else if (!isNaN(r) && r > 0 && !isNaN(a) && a > 0) {
        const targetDec = matchedMasterItem?.decimalPlaces !== undefined && matchedMasterItem.decimalPlaces !== null
          ? Number(matchedMasterItem.decimalPlaces)
          : 3;
        const calculatedQty = Number((a / r).toFixed(targetDec));
        currentRow.qty = calculatedQty;

        if (
          matchedMasterItem?.alternateUnit &&
          matchedMasterItem.alternateUnit.toUpperCase() !== matchedMasterItem.primaryUnit.toUpperCase() &&
          matchedMasterItem.conversionFactor &&
          calculatedQty > 0
        ) {
          const calculatedPcs = inventoryEngine.convertUnits(
            calculatedQty,
            "PRIMARY",
            matchedMasterItem.conversionFactor,
            matchedMasterItem.conversionDirection
          );
          currentRow.pcs = Number(calculatedPcs.toFixed(2));
        }
      }
    } else if (field === "amount") {
      if (!isNaN(a) && !isNaN(q) && q > 0) {
        // Agar quantity feed ki hui hai aur amount change kiya jaata hai, toh rate me calculation ke according change ho na ki quantity me
        currentRow.rate = Number((a / q).toFixed(2)).toFixed(2);
      } else if (!isNaN(a) && !isNaN(r) && r > 0) {
        const targetDec = matchedMasterItem?.decimalPlaces !== undefined && matchedMasterItem.decimalPlaces !== null
          ? Number(matchedMasterItem.decimalPlaces)
          : 3;
        const calculatedQty = Number((a / r).toFixed(targetDec));
        currentRow.qty = calculatedQty;

        if (
          matchedMasterItem?.alternateUnit &&
          matchedMasterItem.alternateUnit.toUpperCase() !== matchedMasterItem.primaryUnit.toUpperCase() &&
          matchedMasterItem.conversionFactor &&
          calculatedQty > 0
        ) {
          const calculatedPcs = inventoryEngine.convertUnits(
            calculatedQty,
            "PRIMARY",
            matchedMasterItem.conversionFactor,
            matchedMasterItem.conversionDirection
          );
          currentRow.pcs = Number(calculatedPcs.toFixed(2));
        }
      }
    }

    updated[index] = currentRow;
    setItems(updated);
  };

  const [autoCalcSundries, setAutoCalcSundries] = useState(true);

  // Helper to recalculate sundries according to active series configuration, current itemTotal, and selected calculation base
  const recalculateSundries = (
    currentSundries: BillSundryRow[],
    currentItemTotal: number,
    seriesName: string,
    overridePakka?: string,
    overrideKacha?: string
  ): BillSundryRow[] => {
    const seriesConf = availableSeriesList.find((s) => s.seriesName === seriesName);
    const seriesSundryMap = new Map<string, SeriesBillSundryConfig>();
    if (seriesConf?.defaultSundries) {
      seriesConf.defaultSundries.forEach((s) => {
        seriesSundryMap.set(s.name.toUpperCase().trim(), s);
      });
    }

    const currentPakkaStr = overridePakka !== undefined ? overridePakka : pakka;
    const currentKachaStr = overrideKacha !== undefined ? overrideKacha : kacha;
    const pakkaNum = parseNumberValue(currentPakkaStr);
    const kachaNum = parseNumberValue(currentKachaStr);

    // Pass 1: Recalculate percent and fixed amounts
    const updated: BillSundryRow[] = currentSundries.map((sundry) => {
      const upperName = (sundry.name || "").toUpperCase().trim();
      const cfg = seriesSundryMap.get(upperName);

      if (sundry.type === "ADD_LESS" || upperName.includes("ROUND")) {
        return { ...sundry };
      }

      let isPercent = sundry.isPercentage ?? cfg?.isPercentage ?? false;
      let percentRate: number | null = null;

      if (sundry.rate !== undefined && sundry.rate !== "" && !isNaN(Number(String(sundry.rate).replace(/,/g, "")))) {
        percentRate = Number(String(sundry.rate).replace(/,/g, ""));
      } else if (cfg?.amount !== undefined && !isNaN(Number(String(cfg.amount).replace(/,/g, "")))) {
        percentRate = Number(String(cfg.amount).replace(/,/g, ""));
      }

      // If rate not found, check if % in name (e.g. "CGST 9%")
      if (percentRate === null || isNaN(percentRate)) {
        const match = upperName.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) {
          percentRate = parseFloat(match[1]);
          isPercent = true;
        }
      }

      const calcBase = sundry.calculateOn || "SUB_TOTAL";

      if (isPercent || upperName.includes("%")) {
        const effectiveRate = percentRate !== null && !isNaN(percentRate) ? percentRate : 0;
        
        let baseAmount = currentItemTotal;
        if (calcBase === "PAKKA") {
          baseAmount = pakkaNum;
        } else if (calcBase === "KACHA") {
          baseAmount = kachaNum;
        }

        const safeBase = isNaN(baseAmount) ? 0 : baseAmount;
        const safeRate = isNaN(effectiveRate) ? 0 : effectiveRate;
        const calcAmt = safeBase !== 0 ? Number(((safeBase * safeRate) / 100).toFixed(2)) : 0;
        const finalAmt = isNaN(calcAmt) ? 0 : calcAmt;
        return {
          ...sundry,
          rate: safeRate.toFixed(2),
          isPercentage: true,
          calculateOn: calcBase,
          amount: finalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          type: sundry.type || cfg?.type || "ADD",
        };
      }

      if (cfg && !cfg.isPercentage && cfg.amount !== undefined) {
        const fixedAmt = parseNumberValue(cfg.amount) || parseNumberValue(sundry.amount) || 0;
        return {
          ...sundry,
          rate: fixedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          isPercentage: false,
          calculateOn: calcBase,
          amount: fixedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          type: sundry.type || cfg.type || "ADD",
        };
      }

      const safeAmt = parseNumberValue(sundry.amount);
      return {
        ...sundry,
        calculateOn: calcBase,
        amount: safeAmt !== 0 ? safeAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (sundry.amount && String(sundry.amount).toLowerCase() !== "nan" ? sundry.amount : "0.00"),
      };
    });

    // Pass 2: Calculate round-off difference
    let subtotal = currentItemTotal;
    updated.forEach((s) => {
      const upperName = (s.name || "").toUpperCase().trim();
      if (s.type !== "ADD_LESS" && !upperName.includes("ROUND")) {
        const a = parseNumberValue(s.amount);
        subtotal = s.type === "SUBTRACT" ? subtotal - a : subtotal + a;
      }
    });

    return updated.map((s) => {
      const upperName = (s.name || "").toUpperCase().trim();
      if (s.type === "ADD_LESS" || upperName.includes("ROUND")) {
        const rounded = Math.round(subtotal);
        const diff = Number((rounded - subtotal).toFixed(2));
        const safeDiff = isNaN(diff) ? 0 : diff;
        return {
          ...s,
          type: safeDiff < 0 ? "SUBTRACT" : "ADD",
          amount: Math.abs(safeDiff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        };
      }
      return s;
    });
  };

  const handleAutoCalculateSundries = () => {
    if (billSundries.length === 0) {
      showNotification("No bill sundries configured to calculate", "info");
      return;
    }
    const updated = recalculateSundries(billSundries, itemTotal, series, pakka, kacha);
    setBillSundries(updated);
    showNotification("Bill sundries auto-calculated as per configuration!", "success");
  };

  // Auto-calculate bill sundries when itemTotal changes if autoCalcSundries is enabled
  useEffect(() => {
    if (autoCalcSundries && billSundries.length > 0) {
      setBillSundries((prev) => {
        const recalculated = recalculateSundries(prev, itemTotal, series, pakka, kacha);
        const hasChanged = recalculated.some((r, i) => {
          const p = prev[i];
          return !p || p.amount !== r.amount || p.type !== r.type || p.calculateOn !== r.calculateOn;
        });
        return hasChanged ? recalculated : prev;
      });
    }
  }, [itemTotal, autoCalcSundries, series, pakka, kacha]);

  const handleSeriesChange = (newSeriesName: string) => {
    setSeries(newSeriesName);
    const conf = availableSeriesList.find((s) => s.seriesName === newSeriesName);
    if (conf) {
      if (!initialData) {
        const fyShort = currentFiscalYear?.name?.slice(-2) || "26";
        setBillNo(voucherSeriesService.formatVoucherNumber(conf, fyShort, conf.nextNumber));
      }
      if (conf.defaultSundries && conf.defaultSundries.length > 0) {
        const initialSundries = conf.defaultSundries.map((s) => ({
          name: s.name,
          amount: 0,
          type: s.type,
          rate: s.amount,
          isPercentage: s.isPercentage,
          calculateOn: "SUB_TOTAL" as const,
        }));
        setBillSundries(recalculateSundries(initialSundries, itemTotal, newSeriesName, pakka, kacha));
      } else {
        setBillSundries([]);
      }
    }
  };

  // Initial auto-sync of billNo and series sundries for new invoice
  useEffect(() => {
    if (!initialData && availableSeriesList.length > 0) {
      const activeConf =
        availableSeriesList.find((s) => s.seriesName === series) ||
        availableSeriesList.find((s) => s.isDefault) ||
        availableSeriesList[0];
      if (activeConf) {
        const fyShort = currentFiscalYear?.name?.slice(-2) || "26";
        setBillNo(voucherSeriesService.formatVoucherNumber(activeConf, fyShort, activeConf.nextNumber));
        if (activeConf.defaultSundries && activeConf.defaultSundries.length > 0) {
          const initialSundries = activeConf.defaultSundries.map((s) => ({
            name: s.name,
            amount: 0,
            type: s.type,
            rate: s.amount,
            isPercentage: s.isPercentage,
            calculateOn: "SUB_TOTAL" as const,
          }));
          setBillSundries(recalculateSundries(initialSundries, itemTotal, activeConf.seriesName, pakka, kacha));
        }
      }
    }
  }, [availableSeriesList, series]);

  const addItemRow = (afterIndex?: number) => {
    const newRow: InvoiceItemRow = {
      id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
      item: "",
      ledger: "",
      pcs: "",
      qty: "",
      unit: isSpareParts ? "NOS" : "SQFT",
      rate: "",
      amount: "",
    };
    let newIdx: number;
    if (typeof afterIndex === "number") {
      const copy = [...items];
      copy.splice(afterIndex + 1, 0, newRow);
      setItems(copy);
      newIdx = afterIndex + 1;
    } else {
      setItems((prev) => { newIdx = prev.length; return [...prev, newRow]; });
      newIdx = items.length;
    }
    setTimeout(() => {
      const el = document.getElementById(`sales_item_dropdown_${newIdx}`) || document.getElementById(`sales_item_input_${newIdx}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const handleSaveInvoice = async (e?: React.FormEvent, openPrintAfterSave: boolean = false) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!party || !party.trim()) {
      setFormError("Please enter or select a Customer / Party Name to proceed.");
      showNotification("Please specify Customer / Party name", "error");
      return;
    }

    if (!billNo || !billNo.trim()) {
      setFormError("Please provide an Invoice / Bill Number.");
      showNotification("Invoice number is required", "error");
      return;
    }

    // Filter out empty/unfilled item rows before saving
    const isItemRowEmpty = (r: InvoiceItemRow) => {
      const hasItem = Boolean(r.item && r.item.trim());
      const hasRef = Boolean(r.reference && r.reference.trim());
      const hasQty = r.qty !== undefined && r.qty !== null && String(r.qty).trim() !== "" && Number(r.qty) !== 0;
      const hasPcs = r.pcs !== undefined && r.pcs !== null && String(r.pcs).trim() !== "" && Number(r.pcs) !== 0;
      const hasRate = r.rate !== undefined && r.rate !== null && String(r.rate).trim() !== "" && Number(r.rate) !== 0;
      const hasAmount = r.amount !== undefined && r.amount !== null && String(r.amount).trim() !== "" && Number(r.amount) !== 0;
      return !hasItem && !hasRef && !hasQty && !hasPcs && !hasRate && !hasAmount;
    };

    const validItems = items.filter((r) => !isItemRowEmpty(r));

    if (validItems.length === 0) {
      setFormError("Please enter at least one item with details to proceed.");
      showNotification("Please fill in at least one item before saving", "error");
      return;
    }

    // Automatically remove blank/without-data lines so state matches the clean bill
    if (validItems.length !== items.length) {
      setItems(validItems);
    }

    setIsSubmitting(true);

    try {
      const invoiceDetails = {
        formType,
        series,
        location,
        billNo: billNo.trim(),
        date,
        party: party.trim(),
        salesAc,
        reference: reference.trim(),
        weight,
        fare,
        truck,
        mobile,
        advance: advance !== undefined && advance !== null && String(advance).trim().toLowerCase() !== "nan"
          ? String(advance).trim()
          : "",
        destination,
        items: validItems,
        billSundries,
        totalAmount: grandTotal,
        pakka: pakka?.trim() ? pakka.trim() : "",
        kacha: kacha?.trim() ? kacha.trim() : "",
      };

      const totalQty = validItems.reduce((acc, curr) => acc + parseNumberValue(curr.qty), 0);

      const recordData = {
        formType,
        refNo: billNo.trim(),
        partyName: party.trim(),
        date,
        amount: grandTotal,
        secondaryVal: totalQty,
        pakka: pakka?.trim() ? pakka.trim() : "",
        kacha: kacha?.trim() ? kacha.trim() : "",
        extra1: truck,
        status: "Paid",
        notes: JSON.stringify(invoiceDetails),
        createdAt: initialData?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      if (initialData?.id) {
        await db.transactions.put({ ...recordData, id: initialData.id });
      } else {
        await db.transactions.add(recordData);
      }

      // Automatically sync with ERP Accounting Voucher so it shows in Sales Register & Day Book
      try {
        if (currentCompany?.id && currentFiscalYear?.id) {
          // Find or create customer / supplier ledger
          const existingPartyLedger = ledgers.find(
            (l) => l.name.trim().toUpperCase() === party.trim().toUpperCase()
          );
          const defaultAccountLedger = isPurchase
            ? ledgers.find((l) => l.groupId === 'grp-purchase-accounts' || l.accountType === 'PURCHASE_ACCOUNT' || l.name.toUpperCase().includes('PURCHASE')) || ledgers[0]
            : ledgers.find((l) => l.groupId === 'grp-sales-accounts' || l.accountType === 'SALES_ACCOUNT' || l.name.toUpperCase().includes('SALES')) || ledgers[0];

          const partyLedgerId = existingPartyLedger?.id || (isPurchase ? 'vendor_' : 'party_') + uuidv4().slice(0, 8);
          const defaultAccountId = defaultAccountLedger?.id || (isPurchase ? 'purch_' : 'sales_') + uuidv4().slice(0, 8);
          const defaultAccountName = salesAc || defaultAccountLedger?.name || (isPurchase ? "Purchase Account" : "Sales Account");

          const nowIso = new Date().toISOString();
          const voucherRecord: Voucher = {
            id: initialData?.voucherId || initialData?.id || (isPurchase ? 'v_purch_' : 'v_sales_') + uuidv4().slice(0, 8),
            uuid: uuidv4(),
            companyId: currentCompany.id,
            fiscalYearId: currentFiscalYear.id,
            voucherNumber: billNo.trim(),
            voucherType: isPurchase ? 'PURCHASE' : 'SALES',
            date,
            referenceNo: billNo.trim(),
            referenceDate: date,
            lines: isPurchase
              ? [
                  { id: uuidv4(), uuid: uuidv4(), ledgerId: defaultAccountId, ledgerName: defaultAccountName, type: 'DR', amount: grandTotal },
                  { id: uuidv4(), uuid: uuidv4(), ledgerId: partyLedgerId, ledgerName: party.trim(), type: 'CR', amount: grandTotal },
                ]
              : [
                  { id: uuidv4(), uuid: uuidv4(), ledgerId: partyLedgerId, ledgerName: party.trim(), type: 'DR', amount: grandTotal },
                  { id: uuidv4(), uuid: uuidv4(), ledgerId: defaultAccountId, ledgerName: defaultAccountName, type: 'CR', amount: grandTotal },
                ],
            inventoryLines: validItems.map((it) => {
              const matchedMaster = masterItems.find(
                (m) => m.name.toLowerCase() === (it.item || '').trim().toLowerCase()
              );
              return {
                id: uuidv4(),
                itemId: matchedMaster?.id || 'item_' + uuidv4().slice(0, 6),
                itemName: it.item || '',
                itemCode: matchedMaster?.code || '',
                quantity: parseNumberValue(it.qty),
                unit: it.unit || (isSpareParts ? 'NOS' : 'SQFT'),
                rate: parseNumberValue(it.rate),
                amount: parseNumberValue(it.amount),
                alternateQty: parseNumberValue(it.pcs) || undefined,
                godown: location || undefined,
              };
            }),
            totalDebit: grandTotal,
            totalCredit: grandTotal,
            narration: isSpareParts
              ? `Spare Parts Purchase | Bill No: ${billNo.trim()} | Machine/Store: ${truck || 'General'} | Spares: ${validItems.map(i => i.item).filter(Boolean).join(', ')}`
              : isPurchase
              ? `Purchase Bill No: ${billNo.trim()} | Supplier: ${party.trim()} | Truck: ${truck || 'N/A'} | Items: ${validItems.map(i => i.item).filter(Boolean).join(', ')}`
              : `Sales Inv No: ${billNo.trim()} | Customer: ${party.trim()} | Truck: ${truck || 'N/A'} | Goods: ${validItems.map(i => i.item).filter(Boolean).join(', ')}`,
            status: 'POSTED',
            deviceId: 'web-client',
            syncStatus: 'PENDING',
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          await dbStorage.saveVoucher(voucherRecord);
          if (refreshVouchers) {
            refreshVouchers();
          }
        }
      } catch (err) {
        console.warn('Voucher sync optional notice:', err);
      }

      showNotification(`${isSpareParts ? 'Spare Parts Purchase' : isPurchase ? 'Purchase' : 'Sales'} Invoice ${billNo.trim()} saved successfully!`, 'success');
      
      // Advance series nextNumber if new invoice
      if (!initialData) {
        const activeSeriesConfig = availableSeriesList.find((s) => s.seriesName === series);
        if (activeSeriesConfig) {
          voucherSeriesService.incrementVoucherNumber(activeSeriesConfig.id);
        }
      }

      // Reset form states after successful save
      if (openPrintAfterSave) {
        setShowPrintView(true);
        showNotification('Invoice saved successfully! Opened Print View.', 'success');
      } else {
        setParty('');
        setTruck('');
        setWeight('');
        setFare('');
        setMobile('');
        setAdvance('');
        setDestination('');
        setSeries('');
        setLocation('');
        setSalesAc('');
        setItems([
          {
            id: "1",
            item: "",
            ledger: "",
            pcs: "",
            qty: "",
            unit: isSpareParts ? "NOS" : "SQFT",
            rate: "",
            amount: "",
          }
        ]);
        setBillSundries([]);
        setPakka("");
        setKacha("");

        setMinimizedInvoice(null);
        onSaveSuccess();
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      setFormError('An error occurred while saving. Please try again.');
      showNotification('Failed to save invoice record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInvoiceExportOptions = () => {
    const validItems = items.filter(
      (it) => (it.item && it.item.trim()) || parseNumberValue(it.amount) > 0 || parseNumberValue(it.qty) > 0
    );

    const title = isSpareParts
      ? "Spare Parts Purchase Bill"
      : isPurchase
      ? "Purchase Invoice"
      : "Sales Tax Invoice";

    const company: Company = currentCompany || {
      id: "company-default",
      name: "Bahi Khata ERP",
      legalName: "Bahi Khata ERP",
      address: "Industrial Area, RIICO Phase-II",
      city: "Kishangarh",
      state: "Rajasthan",
      pincode: "305801",
      phone: "+91 98290 12345",
      email: "info@bahikhataerp.com",
      gstin: "08AAAAA0000A1Z5",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fiscalYear: FiscalYear = currentFiscalYear || {
      id: "fy-2026-2027",
      name: "2026-2027",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isClosed: false,
      isCurrent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const columns = [
      { header: "S.No", dataKey: "sno", align: "center" as const },
      { header: "Description / Item Name", dataKey: "item", align: "left" as const },
      { header: "Ref / Brand", dataKey: "ref", align: "left" as const },
      { header: "Qty", dataKey: "qty", align: "right" as const },
      { header: "Unit", dataKey: "unit", align: "center" as const },
      { header: "Pcs", dataKey: "pcs", align: "right" as const },
      { header: "Rate (₹)", dataKey: "rate", align: "right" as const },
      { header: "Amount (₹)", dataKey: "amount", align: "right" as const },
    ];

    const data = validItems.map((it, idx) => ({
      sno: idx + 1,
      item: it.item,
      ref: it.reference || "-",
      qty: parseNumberValue(it.qty).toFixed(2),
      unit: it.unit || "Sqft",
      pcs: it.pcs ? parseNumberValue(it.pcs).toFixed(2) : "-",
      rate: parseNumberValue(it.rate).toFixed(2),
      amount: parseNumberValue(it.amount).toFixed(2),
    }));

    const totalQty = validItems.reduce((acc, curr) => acc + parseNumberValue(curr.qty), 0);
    const totalPcs = validItems.reduce((acc, curr) => acc + parseNumberValue(curr.pcs), 0);
    const subTotal = validItems.reduce((acc, curr) => acc + parseNumberValue(curr.amount), 0);

    const summaryRows: Record<string, any>[] = [
      {
        sno: "",
        item: "ITEM SUB-TOTAL",
        ref: "",
        qty: totalQty.toFixed(2),
        unit: "",
        pcs: totalPcs > 0 ? totalPcs.toFixed(2) : "-",
        rate: "",
        amount: subTotal.toFixed(2),
      },
    ];

    // Add sundry lines if any
    billSundries.forEach((s) => {
      const amt = parseNumberValue(s.amount);
      if (amt !== 0) {
        summaryRows.push({
          sno: "",
          item: `${s.name} (${s.type})`,
          ref: "",
          qty: "",
          unit: "",
          pcs: "",
          rate: "",
          amount: (s.type === "SUBTRACT" ? -amt : amt).toFixed(2),
        });
      }
    });

    // Grand Total Row
    summaryRows.push({
      sno: "",
      item: "GRAND TOTAL (₹)",
      ref: "",
      qty: "",
      unit: "",
      pcs: "",
      rate: "",
      amount: grandTotal.toFixed(2),
    });

    const cleanBillNo = (billNo || "INVOICE").replace(/[^a-zA-Z0-9_-]/g, "_");

    return {
      company,
      fiscalYear,
      reportTitle: `${title} (${billNo || "Draft"})`,
      subtitle: `Party: ${party || "Counter / Cash"} | Date: ${formatDateDisplay(date)} | Vehicle: ${truck || "N/A"}`,
      periodText: `Dated: ${formatDateDisplay(date)}`,
      columns,
      data,
      summaryRows,
      customFilename: `${cleanBillNo}_${formatDateDisplay(date).replace(/\//g, "-")}`,
    };
  };

  const getPageMarginValue = () => {
    if (printSheetType === "a5_portrait") return "0";
    if (printSheetType === "half_sheet") return "0";
    if (printMargin === "compact") return "3mm";
    if (printMargin === "wide") return "8mm";
    return "4mm";
  };

  const getPageSizeValue = () => {
    if (printSheetType === "a5_portrait" || printSheetType === "half_sheet") return "A5 portrait";
    return "A4 portrait";
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    showNotification("Generating exact preview PDF (1:1 layout)...", "info");
    try {
      const res = await exportInvoicePreviewToExactPdf(
        "invoice_printable_document",
        {
          company: currentCompany,
          fiscalYear: currentFiscalYear,
          billNo,
          date,
          formType,
          isSpareParts,
          isPurchase,
          party,
          partyLedger,
          items,
          groupedAlphabeticalItems,
          billSundries,
          subtotal: itemTotal,
          grandTotal,
          pakka,
          kacha,
          weight,
          fare,
          advance,
          truck,
          mobile,
          destination,
          series,
          location,
          reference,
          billDecimalPlaces,
          totalPcs,
          totalQty,
          printSheetType,
          copies: printCopies,
        }
      );
      if (res && res.success) {
        showNotification(`PDF Downloaded: ${res.filename}`, "success");
      }
    } catch (err: any) {
      console.error("Exact PDF generation failed:", err);
      showNotification("PDF fallback: generating document...", "warning");
      try {
        const opts = getInvoiceExportOptions();
        const res = await ExportEngine.exportToPdf(opts);
        if (res && res.saved) {
          showNotification(`PDF exported: ${res.filename}`, "success");
        }
      } catch (e) {
        showNotification("Failed to export PDF", "error");
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    setIsExportingExcel(true);
    showNotification("Generating exact preview Excel layout...", "info");
    try {
      const res = exportInvoicePreviewToExactExcel({
        company: currentCompany,
        fiscalYear: currentFiscalYear,
        billNo,
        date,
        formType,
        isSpareParts,
        isPurchase,
        party,
        partyLedger,
        items,
        groupedAlphabeticalItems,
        billSundries,
        subtotal: itemTotal,
        grandTotal,
        pakka,
        kacha,
        weight,
        fare,
        advance,
        truck,
        mobile,
        destination,
        series,
        location,
        reference,
        billDecimalPlaces,
        totalPcs,
        totalQty,
        printSheetType,
      });
      if (res && res.success) {
        showNotification(`Excel Downloaded: ${res.filename}`, "success");
      }
    } catch (err: any) {
      console.error("Exact Excel layout failed:", err);
      showNotification("Excel fallback: generating table...", "warning");
      try {
        const opts = getInvoiceExportOptions();
        ExportEngine.exportToExcel(opts);
      } catch (e) {
        showNotification("Failed to export Excel", "error");
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrintInvoice = () => {
    const pageSize = getPageSizeValue();
    const pageMargin = getPageMarginValue();
    const title = `${isSpareParts ? "Spare_Parts_Bill" : isPurchase ? "Purchase_Invoice" : "Tax_Invoice"}_${billNo || "Draft"}`;

    showNotification("Triggering printer dialog...", "info");

    const res = printElementById("invoice_printable_document", {
      title,
      pageSize,
      pageMargin,
      scale: printScale / 100,
      colorMode: printColorMode,
      copies: printCopies,
      fallbackToPdf: () => {
        showNotification("Printing restricted by browser iframe. Generating exact PDF...", "warning");
        handleExportPdf();
      },
    });

    if (res.method === "new_tab") {
      showNotification("Print window opened in new tab. Press Ctrl+P or click Print button!", "success");
    } else {
      showNotification("Printer dialog opened.", "success");
    }
  };

  const handleOpenPrintInNewTab = () => {
    const pageSize = getPageSizeValue();
    const pageMargin = getPageMarginValue();
    const title = `${isSpareParts ? "Spare_Parts_Bill" : isPurchase ? "Purchase_Invoice" : "Tax_Invoice"}_${billNo || "Draft"}`;

    const ok = openElementInPrintTab("invoice_printable_document", {
      title,
      pageSize,
      pageMargin,
      scale: printScale / 100,
      colorMode: printColorMode,
      copies: printCopies,
    });

    if (ok) {
      showNotification("Opened standalone print tab with full browser dialog support!", "success");
    } else {
      showNotification("Could not open print window", "error");
    }
  };

  const renderPakkaHalfContent = () => (
    <DespatchItemDetailContent
      layout="portrait"
      billNo={billNo}
      date={date}
      reference={reference}
      pakka={pakka}
      kacha={kacha}
      weight={weight}
      fare={fare}
      advance={advance}
      truck={truck}
      mobile={mobile}
      destination={destination}
      formatDateDisplay={formatDateDisplay}
      parseNumberValue={parseNumberValue}
      formatIndianNumberWithDecimals={formatIndianNumberWithDecimals}
      groupedAlphabeticalItems={groupedAlphabeticalItems}
      billDecimalPlaces={billDecimalPlaces}
      totalPcs={totalPcs}
      totalQty={totalQty}
      items={items}
    />
  );

  const renderKachaHalfCopy = (copyLabel: string) => {
    const validItems = items.filter(
      (it) => (it.item && it.item.trim()) || parseNumberValue(it.amount) > 0 || parseNumberValue(it.qty) > 0
    );
    const MIN_ROWS = 4;
    const fillerCount = Math.max(0, MIN_ROWS - validItems.length);

    return (
      <div className="border-2 border-black flex flex-col justify-between w-full h-full p-2 text-black bg-white invoice-root-container box-border overflow-hidden select-none">
        <div>
          {/* Top Header: Company Info & Invoice Badging */}
          <div className="border-b-2 border-black pb-1 mb-1 flex justify-between items-center gap-1.5 shrink-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black uppercase tracking-tight text-black leading-tight truncate">
                {currentCompany?.legalName || currentCompany?.name || "Bahi Khata ERP"}
              </h1>
              {currentCompany?.gstin && (
                <div className="text-[8px] text-gray-800 font-semibold mt-0.5">
                  GSTIN: <span className="font-mono font-bold">{currentCompany.gstin}</span>
                </div>
              )}
            </div>

            <div className="text-right border-l-2 border-black pl-2 shrink-0 min-w-[130px]">
              <div className="inline-block bg-black text-white text-[8px] font-bold px-1.5 py-0.5 uppercase tracking-wider mb-0.5 text-center w-full whitespace-nowrap">
                {isSpareParts ? "SPARE PARTS BILL" : isPurchase ? "PURCHASE VOUCHER" : "SALE INVOICE"}
                {copyLabel ? ` · ${copyLabel}` : ""}
              </div>
              <div className="text-[7.5px] space-y-0.5 text-left border-t border-gray-300 pt-0.5">
                <div className="flex justify-between gap-1 items-center whitespace-nowrap">
                  <span className="text-gray-600 shrink-0">Inv No:</span>
                  <span className="font-mono font-bold text-black whitespace-nowrap">{billNo}</span>
                </div>
                <div className="flex justify-between gap-1 items-center whitespace-nowrap">
                  <span className="text-gray-600 shrink-0">Date:</span>
                  <span className="font-semibold whitespace-nowrap">{formatDateDisplay(date)}</span>
                </div>
                {reference && (
                  <div className="flex justify-between gap-1 items-center whitespace-nowrap">
                    <span className="text-gray-600 shrink-0">Ref / Challan:</span>
                    <span className="font-mono font-bold text-black whitespace-nowrap">{reference}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Details (Billed To) */}
          <div className="border border-black px-1.5 py-0.5 mb-1 bg-gray-50/40 text-[8px] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-bold uppercase text-[7.5px] text-gray-600 block tracking-wider shrink-0">
                {isPurchase ? "Purchased From:" : "Billed To:"}
              </span>
              <span className="font-bold text-[9px] text-black leading-tight truncate">
                {party || (isPurchase ? "Cash Supplier" : "Cash Customer")}
              </span>
            </div>
            {partyLedger?.phone && (
              <div className="text-[7.5px] text-gray-700 font-mono shrink-0 pl-1">
                Ph: {partyLedger.phone}
              </div>
            )}
          </div>

          {/* Despatch / Transport Particulars (8 Fields Grid) */}
          <div className="border border-black text-[7.5px] mb-1 bg-white shrink-0">
            <div className="bg-gray-100 px-1.5 py-0.5 border-b border-black font-bold uppercase tracking-wider text-[7px] flex justify-between items-center">
              <span>Despatch / Transport Particulars</span>
              <span className="font-mono text-[6.5px] text-gray-500 font-normal">Vehicle & Delivery Details</span>
            </div>
            <div className="grid grid-cols-4 divide-x divide-y divide-black text-[7.5px]">
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Pakka:</span>
                <span className="font-mono font-bold text-black">
                  {pakka && parseNumberValue(pakka) !== 0 ? `₹${formatIndianNumberWithDecimals(pakka)}` : "-"}
                </span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Kacha:</span>
                <span className={`font-mono font-bold ${parseNumberValue(kacha) < 0 ? "text-rose-700" : "text-black"}`}>
                  {kacha && parseNumberValue(kacha) !== 0 ? `₹${formatIndianNumberWithDecimals(kacha)}` : "-"}
                </span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Weight:</span>
                <span className="font-mono font-bold text-black">
                  {weight && String(weight).trim() !== "" ? (String(weight).toLowerCase().includes("ton") ? weight : `${weight} Ton`) : "-"}
                </span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Fare:</span>
                <span className="font-mono font-bold text-black">
                  {fare && parseNumberValue(fare) !== 0 ? `₹${formatIndianNumberWithDecimals(fare)}/Ton` : "-"}
                </span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Truck No.:</span>
                <span className="font-mono font-bold text-black uppercase truncate">{truck || "-"}</span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Mobile:</span>
                <span className="font-mono font-bold text-black">{mobile || "-"}</span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Advance:</span>
                <span className="font-mono font-bold text-black">
                  {advance !== undefined && advance !== null && String(advance).trim() !== "" && String(advance).toLowerCase() !== "nan" && parseNumberValue(advance) !== 0
                    ? `₹${formatIndianNumberWithDecimals(advance)}`
                    : "-"}
                </span>
              </div>
              <div className="p-0.5 px-1 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Delivery:</span>
                <span className="font-bold text-black truncate max-w-[80px]" title={destination}>{destination || "-"}</span>
              </div>
            </div>
          </div>

          {/* Item Table (8 Columns) */}
          <table className="w-full table-fixed border-collapse border border-black text-[7.5px] mb-1">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-black font-bold">
                <th className="border-r border-black py-0.5 px-0.5 text-center w-[5%]">#</th>
                <th className="border-r border-black py-0.5 px-1 text-left w-[34%]">Description of Goods</th>
                <th className="border-r border-black py-0.5 px-0.5 text-center w-[12%]">Reference</th>
                <th className="border-r border-black py-0.5 px-0.5 text-right w-[8%]">Pcs</th>
                <th className="border-r border-black py-0.5 px-0.5 text-right w-[11%]">Quantity</th>
                <th className="border-r border-black py-0.5 px-0.5 text-center w-[7%]">Unit</th>
                <th className="border-r border-black py-0.5 px-0.5 text-right w-[10%]">Rate (₹)</th>
                <th className="py-0.5 px-1 text-right w-[13%]">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {validItems.map((it, idx) => {
                const pVal = parseNumberValue(it.pcs);
                const pcsDisplay = pVal > 0
                  ? pVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : (it.pcs !== "" && it.pcs !== undefined && String(it.pcs).trim() !== "" && String(it.pcs).trim() !== "-" ? String(it.pcs) : null);

                return (
                  <tr key={it.id || idx} className="border-b border-gray-300">
                    <td className="border-r border-black py-0.5 px-0.5 text-center font-mono text-[7px]">{idx + 1}</td>
                    <td className="border-r border-black py-0.5 px-1 font-semibold text-black leading-tight text-[8px] truncate" title={it.item}>
                      {it.item || "Marble / Granite"}
                    </td>
                    <td className="border-r border-black py-0.5 px-0.5 text-center font-mono text-[7px] text-gray-700 whitespace-pre-line leading-tight">
                      {it.reference || "-"}
                    </td>
                    <td className="border-r border-black py-0.5 px-0.5 text-right font-mono text-[7.5px] whitespace-nowrap">
                      {pcsDisplay || "-"}
                    </td>
                    <td className="border-r border-black py-0.5 px-0.5 text-right font-mono font-bold text-black whitespace-nowrap text-[8px]">
                      {it.qty !== "" && it.qty !== undefined && !isNaN(Number(it.qty))
                        ? Number(it.qty).toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })
                        : "-"}
                    </td>
                    <td className="border-r border-black py-0.5 px-0.5 text-center uppercase font-medium whitespace-nowrap text-[7px]">{it.unit || "SQFT"}</td>
                    <td className="border-r border-black py-0.5 px-0.5 text-right font-mono whitespace-nowrap text-[7.5px]">
                      {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-0.5 px-1 text-right font-mono font-bold text-black whitespace-nowrap text-[8px]">
                      {Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}

              {Array.from({ length: fillerCount }).map((_, fIdx) => (
                <tr key={`filler-copy-${fIdx}`} className="border-b border-gray-200 h-4 text-transparent select-none">
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-1">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="border-r border-black py-0.5 px-0.5">&nbsp;</td>
                  <td className="py-0.5 px-1">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-gray-100 font-bold">
                <td colSpan={3} className="border-r border-black py-0.5 px-1 text-right uppercase tracking-wider text-[7px]">
                  SUBTOTAL:
                </td>
                <td className="border-r border-black py-0.5 px-0.5 text-right font-mono font-bold whitespace-nowrap text-[7.5px]">
                  {totalPcs > 0 ? totalPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                </td>
                <td className="border-r border-black py-0.5 px-0.5 text-right font-mono font-bold whitespace-nowrap text-[8px]">
                  {totalQty > 0 ? totalQty.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces }) : "-"}
                </td>
                <td className="border-r border-black py-0.5 px-0.5 text-center text-[7px]">-</td>
                <td className="border-r border-black py-0.5 px-0.5 text-right text-[7px]">-</td>
                <td className="py-0.5 px-1 text-right font-mono font-black text-black whitespace-nowrap text-[8px]">
                  ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Section: Words, Sundries, Declaration & Signatures */}
        <div className="keep-together invoice-footer-block mt-auto pt-0.5">
          <div className="flex justify-between items-start gap-1.5 border border-black p-1 mb-1 bg-white">
            <div className="flex-1 min-w-0 text-[7.5px] space-y-0.5 pr-1">
              <div>
                <span className="font-semibold text-gray-600 block text-[6.5px] uppercase">Amount in Words:</span>
                <p className="font-bold italic text-black leading-snug break-words text-[7.5px]">
                  Rupees {numberToIndianWords(grandTotal)} Only
                </p>
              </div>
              <div className="pt-1 text-[6.5px] text-gray-600 border-t border-gray-200 mt-0.5 leading-tight">
                <span className="font-semibold">Declaration:</span> Goods once sold will not be taken back. Subject to local jurisdiction.
              </div>
            </div>

            <div className="w-[140px] shrink-0 text-[7.5px] space-y-0.5 font-mono border-l border-black pl-1.5">
              <div className="flex justify-between text-gray-700">
                <span className="font-sans text-[7px]">Item Subtotal:</span>
                <span>₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {billSundries.map((s, idx) => {
                const amtVal = parseNumberValue(s.amount);
                return (
                  <div key={idx} className="flex justify-between">
                    <span className="font-sans text-[7px] truncate max-w-[80px]">{s.name}:</span>
                    <span>
                      {s.type === "SUBTRACT" ? "-" : "+"}₹{amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
              <div className="border-t-2 border-black pt-0.5 mt-0.5 flex justify-between font-bold text-[8px] bg-gray-100 px-1 py-0.5">
                <span className="uppercase font-sans">Net Total:</span>
                <span className="font-black text-black">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-1 border-t border-black flex justify-between items-end text-[7.5px]">
            <div className="text-center min-w-[90px]">
              <div className="border-t border-black pt-0.5 font-bold uppercase text-[7px] text-gray-700">
                Customer Signature
              </div>
            </div>
            <div className="text-center min-w-[110px]">
              <p className="text-[6.5px] text-gray-700 mb-2 font-medium truncate max-w-[120px]">
                For {currentCompany?.legalName || currentCompany?.name || "Bahi Khata ERP"}
              </p>
              <div className="border-t border-black pt-0.5 font-bold uppercase text-[7px]">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className={`fixed inset-0 z-[99999] bg-[#141416] w-screen h-screen flex flex-col overflow-hidden ${isMinimized ? "hidden" : ""}`}>
      <div className="bg-[#141416] w-full h-full flex flex-col overflow-hidden">
        {/* Datalist for Spare Parts Suggestions */}
        {isSpareParts && (
          <datalist id="spare_parts_suggestions">
            {sparePartsSuggestions.map((spName, sIdx) => (
              <option key={sIdx} value={spName} />
            ))}
          </datalist>
        )}

        {/* Header */}
        <div className="px-4 py-2 bg-[#1A1A1D] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
              {showPrintView
                ? `${isSpareParts ? "Spare Parts Bill" : isPurchase ? "Purchase Invoice" : "Sales Invoice"} - Print Preview`
                : (isSpareParts ? "Spare Parts Purchase Bill (Entry)" : isPurchase ? "Purchase Invoice Form" : "Sales Invoice Form")}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
              Series: {series}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* If in Print View: Show PDF, Excel, and Print in the top header */}
            {showPrintView ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* PDF Export Button */}
                <button
                  type="button"
                  id="invoice_export_pdf_btn"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="h-7 sm:h-8 px-2.5 rounded bg-white/10 hover:bg-rose-500/20 text-rose-300 border border-white/15 hover:border-rose-500/40 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
                  title={`Export PDF (${printSheetType === "half_sheet" ? "Pakka Half" : printSheetType === "a5_portrait" ? "Kacha Half" : "Kacha Full"})`}
                  aria-label="Export PDF"
                >
                  <PdfFileIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isExportingPdf ? "Exporting..." : "PDF"}</span>
                </button>

                {/* Excel Export Button */}
                <button
                  type="button"
                  id="invoice_export_excel_btn"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="h-7 sm:h-8 px-2.5 rounded bg-white/10 hover:bg-emerald-500/20 text-emerald-300 border border-white/15 hover:border-emerald-500/40 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Export Excel (.xlsx)"
                  aria-label="Export Excel"
                >
                  <ExcelFileIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isExportingExcel ? "Exporting..." : "Excel"}</span>
                </button>

                {/* Print Button (Renamed from Open Print Tab, opens dedicated print window) */}
                <button
                  type="button"
                  id="invoice_open_print_tab_btn"
                  onClick={handleOpenPrintInNewTab}
                  className="h-7 sm:h-8 px-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/30 transition cursor-pointer"
                  title="Print Invoice"
                  aria-label="Print Invoice"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0 text-black" />
                  <span>Print</span>
                </button>
              </div>
            ) : (
              /* Print View Direct & Dropdown Button - only shown when in form mode */
              <div className="relative inline-flex items-center" ref={printDropdownRef}>
                <div className="inline-flex rounded items-center bg-white/10 hover:bg-white/20 text-gray-200 font-bold text-xs uppercase transition border border-white/15 shadow-xs">
                  <button
                    type="button"
                    id="sales_print_view_direct_btn"
                    onClick={() => setShowPrintView(true)}
                    className="px-2.5 py-1.5 flex items-center gap-1.5 hover:text-white cursor-pointer"
                    title={`Open Print View (${printSheetType === "half_sheet" ? "Pakka Half" : printSheetType === "a5_portrait" ? "Kacha Half" : "Kacha Full"})`}
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print View</span>
                  </button>
                  <button
                    type="button"
                    id="sales_print_view_dropdown_btn"
                    onClick={() => setIsPrintDropdownOpen((prev) => !prev)}
                    className="px-1.5 py-1.5 border-l border-white/15 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer"
                    title="Select Sheet Type: Half (Landscape), Half (Portrait), or Full (Portrait)"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isPrintDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isPrintDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-[rgba(8,27,46,0.98)] backdrop-blur-[24px] border border-[rgba(112,185,245,0.30)] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.60)] py-1.5 z-50 text-xs">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7F98AE] border-b border-[rgba(112,185,245,0.25)]">
                      Select Print Sheet Option
                    </div>

                    <button
                      type="button"
                      id="print_sheet_option_half"
                      onClick={() => {
                        setPrintSheetType("half_sheet");
                        setShowPrintView(true);
                        setIsPrintDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-amber-500/20 hover:text-amber-300 transition-colors cursor-pointer ${
                        printSheetType === "half_sheet"
                          ? "text-amber-400 font-bold bg-amber-500/10"
                          : "text-gray-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Pakka (Half)
                        </div>
                        <div className="text-[10px] text-gray-400 pl-5">A5 Portrait (Single Bill · 148 × 210 mm)</div>
                      </div>
                      {printSheetType === "half_sheet" && <Check className="w-4 h-4 text-amber-400" />}
                    </button>

                    <button
                      type="button"
                      id="print_sheet_option_a5_portrait"
                      onClick={() => {
                        setPrintSheetType("a5_portrait");
                        setShowPrintView(true);
                        setIsPrintDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-amber-500/20 hover:text-amber-300 transition-colors cursor-pointer ${
                        printSheetType === "a5_portrait"
                          ? "text-amber-400 font-bold bg-amber-500/10"
                          : "text-gray-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Kacha (Half)
                        </div>
                        <div className="text-[10px] text-gray-400 pl-5">A5 Portrait (Single Bill · 148 × 210 mm)</div>
                      </div>
                      {printSheetType === "a5_portrait" && <Check className="w-4 h-4 text-amber-400" />}
                    </button>

                    <button
                      type="button"
                      id="print_sheet_option_full"
                      onClick={() => {
                        setPrintSheetType("full_sheet");
                        setShowPrintView(true);
                        setIsPrintDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-amber-500/20 hover:text-amber-300 transition-colors cursor-pointer ${
                        printSheetType === "full_sheet"
                          ? "text-amber-400 font-bold bg-amber-500/10"
                          : "text-gray-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Kacha (Full)
                        </div>
                        <div className="text-[10px] text-gray-400 pl-5">210 × 297 mm · Sale Invoice</div>
                      </div>
                      {printSheetType === "full_sheet" && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Minimize to Taskbar Button */}
            <button
              type="button"
              id="sales_invoice_minimize_btn"
              onClick={handleMinimize}
              className="p-1.5 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer border border-white/10 hover:border-amber-400/40 ml-1"
              title="Minimize Bill to Tabbar"
              aria-label="Minimize Bill to Tabbar"
            >
              <Minus className="w-4 h-4" />
            </button>

            <button onClick={handleModalClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {formError && (
          <div className="px-4 py-1.5 bg-rose-950/80 border-b border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Printable Invoice Layout (Half Sheet & Full Sheet) */}
        {showPrintView ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0E0E11] overflow-hidden text-black">
            {/* Print Header Bar & Controls (Hidden on paper) */}
            <div id="sales_print_header_bar" className="p-2.5 sm:p-3 bg-[#18181B] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintView(false)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white rounded flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" /> Back to Form
                </button>
                <div className="h-4 w-px bg-white/15 mx-1" />
                <span className="text-xs text-gray-400 font-medium">Format:</span>
                <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPrintSheetType("half_sheet")}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                      printSheetType === "half_sheet"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    Pakka (Half)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSheetType("a5_portrait")}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                      printSheetType === "a5_portrait"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    Kacha (Half)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSheetType("full_sheet")}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                      printSheetType === "full_sheet"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    Kacha (Full)
                  </button>
                </div>

                {/* Print Settings Toggle */}
                <button
                  type="button"
                  id="invoice_print_settings_toggle_btn"
                  onClick={() => setIsPrintSettingsOpen((prev) => !prev)}
                  className={`h-7 px-2.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    isPrintSettingsOpen
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/15"
                  }`}
                  title="Configure Print Settings (Margins, Scale, Copies, Color)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Settings</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isPrintSettingsOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {/* Print Settings Panel (Expandable) */}
            {isPrintSettingsOpen && (
              <div className="p-3 bg-[#121215] border-b border-amber-500/30 text-white text-xs print:hidden animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-5">
                    {/* Scale Option */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-semibold">Scale (Zoom):</span>
                      <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                        {[100, 95, 90, 85].map((sc) => (
                          <button
                            key={sc}
                            type="button"
                            onClick={() => setPrintScale(sc)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              printScale === sc
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            {sc}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Margins */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-semibold">Margins:</span>
                      <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                        {[
                          { id: "compact", label: "Narrow (3mm)" },
                          { id: "normal", label: "Normal (5mm)" },
                          { id: "wide", label: "Wide (8mm)" },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPrintMargin(m.id as any)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              printMargin === m.id
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Copies */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-semibold">Copies:</span>
                      <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                        {[
                          { val: 1, label: "1 (Original)" },
                          { val: 2, label: "2 (+Duplicate)" },
                          { val: 3, label: "3 (+Triplicate)" },
                        ].map((cp) => (
                          <button
                            key={cp.val}
                            type="button"
                            onClick={() => setPrintCopies(cp.val)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              printCopies === cp.val
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            {cp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Mode */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-semibold">Color:</span>
                      <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                        {[
                          { id: "color", label: "Color" },
                          { id: "monochrome", label: "B&W (High Contrast)" },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setPrintColorMode(c.id as any)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              printColorMode === c.id
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duplicate Copy Toggle (Kacha Half only) */}
                    {printSheetType === "a5_portrait" && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-semibold">Duplicate Bill:</span>
                        <div className="inline-flex rounded bg-[#202024] p-0.5 border border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowDuplicateCopy(false)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              !showDuplicateCopy
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            Hide
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDuplicateCopy(true)}
                            className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                              showDuplicateCopy
                                ? "bg-amber-500 text-black font-bold shadow-xs"
                                : "text-gray-300 hover:text-white"
                            }`}
                          >
                            Show
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <span className="text-amber-400">💡 Tip:</span>
                    <span>Click <strong>"Print"</strong> in the top header to open printer dialog directly.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Scoped Print Stylesheet */}
            <style>{`
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  overflow: visible !important;
                  height: auto !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  ${printColorMode === "monochrome" ? "filter: grayscale(100%) contrast(115%) !important;" : ""}
                }
                body * {
                  visibility: hidden !important;
                }
                .print\\:hidden, #sales_print_header_bar, header, nav, button {
                  display: none !important;
                  visibility: hidden !important;
                }
                div:has(#invoice_printable_document) {
                  visibility: visible !important;
                  background: transparent !important;
                  position: static !important;
                  overflow: visible !important;
                  height: auto !important;
                  max-height: none !important;
                  width: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                #invoice_printable_document, #invoice_printable_document * {
                  visibility: visible !important;
                }
                #invoice_printable_document {
                  position: relative !important;
                  width: 100% !important;
                  max-width: ${printSheetType === "a5_portrait" || printSheetType === "half_sheet" ? "148mm" : printSheetType === "full_sheet" ? "200mm" : "198mm"} !important;
                  min-height: auto !important;
                  height: ${printSheetType === "a5_portrait" || printSheetType === "half_sheet" ? "210mm" : "auto"} !important;
                  margin: 0 auto !important;
                  padding: ${printSheetType === "a5_portrait" || printSheetType === "half_sheet" ? "2mm 2.5mm" : "0"} !important;
                  box-sizing: border-box !important;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  transform: ${printSheetType === "a5_portrait" || printSheetType === "half_sheet" ? "none" : `scale(${printScale / 100})`} !important;
                  transform-origin: top center !important;
                }
                #print-page {
                  width: 297mm !important;
                  max-width: 297mm !important;
                  height: 210mm !important;
                  max-height: 210mm !important;
                  padding: 5mm !important;
                  box-sizing: border-box !important;
                  display: flex !important;
                  flex-direction: row !important;
                  justify-content: flex-start !important;
                  align-items: stretch !important;
                  background: white !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .bill-copy {
                  width: 142mm !important;
                  max-width: 142mm !important;
                  height: 200mm !important;
                  max-height: 200mm !important;
                  box-sizing: border-box !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .invoice-root-container {
                  width: 100% !important;
                  max-width: ${printSheetType === "a5_portrait" ? "297mm" : printSheetType === "full_sheet" ? "200mm" : "198mm"} !important;
                  margin: 0 auto !important;
                  box-sizing: border-box !important;
                  height: auto !important;
                  min-height: auto !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                table {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
                tfoot {
                  display: table-footer-group !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .keep-together, .invoice-footer-block {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                @page {
                  size: ${printSheetType === "a5_portrait" || printSheetType === "half_sheet" ? "A5 portrait" : "A4 portrait"};
                  margin: ${getPageMarginValue()};
                }
              }
            `}</style>

            {/* Scrollable Printable Document Container */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-300/40 flex justify-center items-start">
              <div
                id="invoice_printable_document"
                style={{
                  transform: printScale !== 100 && printSheetType !== "a5_portrait" && printSheetType !== "half_sheet" ? `scale(${printScale / 100})` : undefined,
                  transformOrigin: "top center",
                  filter: printColorMode === "monochrome" ? "grayscale(100%) contrast(115%)" : undefined,
                }}
                className={`bg-white text-black shadow-2xl font-sans transition-all ${
                  printSheetType === "a5_portrait" || printSheetType === "half_sheet"
                    ? "w-[148mm] max-w-[148mm] h-[210mm] min-h-[210mm] max-h-[210mm] p-1.5 sm:p-2 box-border mx-auto border border-gray-200 flex flex-col justify-between overflow-hidden"
                    : printSheetType === "full_sheet"
                    ? "w-[210mm] max-w-[210mm] min-h-[297mm] p-4 sm:p-5 text-xs leading-normal mx-auto border border-gray-200"
                    : "w-[210mm] max-w-[210mm] min-h-[297mm] p-2 sm:p-2.5 text-[15px] leading-normal box-border mx-auto border border-gray-200 flex flex-col justify-start"
                }`}
              >
                {/* ======================================================== */}
                {/* 1. PAKKA (HALF) - A5 PORTRAIT (148 × 210 mm · Single Bill) */}
                {/* ======================================================== */}
                {printSheetType === "half_sheet" && (
                  <div className="w-full h-full flex flex-col justify-between box-border">
                    {renderPakkaHalfContent()}
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. KACHA (HALF) - A5 PORTRAIT (148 × 210 mm · Single Bill) */}
                {/* ======================================================== */}
                {printSheetType === "a5_portrait" && (
                  <div className="w-full h-full flex flex-col justify-between box-border">
                    {renderKachaHalfCopy("")}
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. FULL SHEET FORMAT (A4 Standard Tax Invoice View)      */}
                {/* ======================================================== */}
                {printSheetType === "full_sheet" && (
                  <div className="border-2 border-black flex flex-col justify-between min-h-[265mm] p-4 text-black bg-white invoice-root-container">
                    <div>
                      {/* Full A4 Header */}
                      <div className="border-b-2 border-black pb-2 mb-3">
                        <div className="flex justify-between items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-black">
                              {currentCompany?.legalName || currentCompany?.name || "Bahi Khata ERP"}
                            </h1>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="border-2 border-black bg-black text-white text-xs sm:text-sm font-bold px-3.5 py-1 uppercase tracking-wider whitespace-nowrap inline-block">
                              {isSpareParts ? "SPARE PARTS BILL" : isPurchase ? "PURCHASE BILL" : "SALE INVOICE"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Info Grid: Billed To vs Inv. & Desp. Detail */}
                      <div className="grid grid-cols-12 border-2 border-black text-xs mb-3 divide-x-2 divide-black">
                        {/* Billed To */}
                        <div className="col-span-5 p-2.5 flex flex-col justify-start">
                          <span className="font-bold uppercase text-[10px] text-gray-500 block border-b border-gray-300 pb-0.5 mb-1.5">
                            {isPurchase ? "Purchased From (Vendor):" : "Billed To:"}
                          </span>
                          <p className="font-bold text-base text-black leading-tight">
                            {party || (isPurchase ? "Cash Supplier" : "Cash Customer")}
                          </p>
                          {partyLedger?.address && (
                            <p className="text-gray-700 text-xs mt-1 leading-snug">{partyLedger.address}</p>
                          )}
                          {partyLedger?.city && (
                            <p className="text-gray-700 text-xs">{partyLedger.city}</p>
                          )}
                        </div>

                        {/* Inv. & Desp. Detail */}
                        <div className="col-span-7 p-2.5">
                          <span className="font-bold uppercase text-[10px] text-gray-500 block border-b border-gray-300 pb-0.5 mb-1.5">
                            Inv. & Desp. Detail
                          </span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {/* Left Column: Bill No., Date, Pakka, Kacha, Delivery */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center pr-1">
                                <span className="text-gray-600 font-medium">Bill No. :</span>
                                <span className="font-mono font-bold text-black">{billNo}</span>
                              </div>
                              <div className="flex justify-between items-center pr-1">
                                <span className="text-gray-600 font-medium">Date :</span>
                                <span className="font-bold text-black">{formatDateDisplay(date)}</span>
                              </div>
                              <div className="flex justify-between items-center pr-1">
                                <span className="text-gray-600 font-medium">Pakka :</span>
                                <span className="font-mono font-bold text-black">
                                  {pakka && parseNumberValue(pakka) !== 0 ? `₹${formatIndianNumberWithDecimals(pakka)}` : "-"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pr-1">
                                <span className="text-gray-600 font-medium">Kacha :</span>
                                <span className={`font-mono font-bold ${parseNumberValue(kacha) < 0 ? "text-rose-700" : "text-black"}`}>
                                  {kacha && parseNumberValue(kacha) !== 0 ? `₹${formatIndianNumberWithDecimals(kacha)}` : "-"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pr-1">
                                <span className="text-gray-600 font-medium">Delivery :</span>
                                <span className="font-bold text-black truncate max-w-[120px]" title={destination}>{destination || "-"}</span>
                              </div>
                            </div>

                            {/* Right Column: Weight, Fare, Truck No., Mobile, Advance */}
                            <div className="space-y-1 border-l border-gray-200 pl-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Weight :</span>
                                <span className="font-mono font-bold text-black">
                                  {weight && String(weight).trim() !== "" ? (String(weight).toLowerCase().includes("ton") ? weight : `${weight} Ton`) : "-"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Fare :</span>
                                <span className="font-mono font-bold text-black">
                                  {fare && parseNumberValue(fare) !== 0 ? `₹${formatIndianNumberWithDecimals(fare)}/Ton` : "-"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Truck No. :</span>
                                <span className="font-mono font-bold text-black uppercase">{truck || "-"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Mobile :</span>
                                <span className="font-mono font-bold text-black">{mobile || "-"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Advance :</span>
                                <span className="font-mono font-bold text-black">
                                  {advance !== undefined && advance !== null && String(advance).trim() !== "" && String(advance).toLowerCase() !== "nan" && parseNumberValue(advance) !== 0
                                    ? `₹${formatIndianNumberWithDecimals(advance)}`
                                    : "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Items Detailed Table */}
                      <table className="w-full border-collapse border-2 border-black text-xs mb-3">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-black text-black">
                            <th className="border-r border-black p-1.5 text-center w-8">#</th>
                            <th className="border-r border-black p-1.5 text-left">Description of Goods</th>
                            <th className="border-r border-black p-1.5 text-center w-24 whitespace-nowrap">Reference</th>
                            <th className="border-r border-black p-1.5 text-right w-16">Pcs</th>
                            <th className="border-r border-black p-1.5 text-right w-20">Quantity</th>
                            <th className="border-r border-black p-1.5 text-center w-14">Unit</th>
                            <th className="border-r border-black p-1.5 text-right w-20">Rate (₹)</th>
                            <th className="p-1.5 text-right w-24">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const validItems = items.filter(it => (it.item && it.item.trim()) || parseNumberValue(it.amount) > 0 || parseNumberValue(it.qty) > 0);
                            const renderedRows = validItems.map((it, idx) => (
                              <tr key={it.id} className="border-b border-gray-300">
                                <td className="border-r border-black p-1.5 text-center font-mono">{idx + 1}</td>
                                <td className="border-r border-black p-1.5 font-bold">
                                  {it.item || "Marble / Granite"}
                                </td>
                                <td className="border-r border-black p-1.5 text-center font-mono font-medium text-gray-800 whitespace-nowrap">
                                  {it.reference ? (
                                    <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold border border-gray-300 whitespace-nowrap font-mono text-black">
                                      {it.reference}
                                    </span>
                                  ) : "-"}
                                </td>
                                <td className="border-r border-black p-1.5 text-right font-mono">
                                  {(() => {
                                    const pVal = parseNumberValue(it.pcs);
                                    return pVal > 0 || (it.pcs !== "" && it.pcs !== undefined && String(it.pcs).trim() !== "" && String(it.pcs).trim() !== "-")
                                      ? (pVal > 0 ? pVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(it.pcs))
                                      : "-";
                                  })()}
                                </td>
                                <td className="border-r border-black p-1.5 text-right font-mono font-semibold">
                                  {it.qty !== "" && it.qty !== undefined && !isNaN(Number(it.qty))
                                    ? Number(it.qty).toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })
                                    : "-"}
                                </td>
                                <td className="border-r border-black p-1.5 text-center uppercase">{it.unit}</td>
                                <td className="border-r border-black p-1.5 text-right font-mono">
                                  {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-1.5 text-right font-mono font-bold">
                                  {Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ));

                            // Minimum 8 rows to keep Item Description box at a fixed dignified height
                            const MIN_FULL_ROWS = 8;
                            const fillerCount = Math.max(0, MIN_FULL_ROWS - validItems.length);
                            const fillerRows = Array.from({ length: fillerCount }).map((_, fIdx) => (
                              <tr key={`filler-full-${fIdx}`} className="border-b border-gray-200 h-8 text-transparent select-none">
                                <td className="border-r border-black p-1.5 text-center">&nbsp;</td>
                                <td className="border-r border-black p-1.5">&nbsp;</td>
                                <td className="border-r border-black p-1.5 text-center">&nbsp;</td>
                                <td className="border-r border-black p-1.5 text-right">&nbsp;</td>
                                <td className="border-r border-black p-1.5 text-right">&nbsp;</td>
                                <td className="border-r border-black p-1.5 text-center">&nbsp;</td>
                                <td className="border-r border-black p-1.5 text-right">&nbsp;</td>
                                <td className="p-1.5 text-right">&nbsp;</td>
                              </tr>
                            ));

                            return [...renderedRows, ...fillerRows];
                          })()}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-black bg-gray-100 font-bold">
                            <td colSpan={3} className="border-r border-black p-1.5 text-right uppercase">SUBTOTAL:</td>
                            <td className="border-r border-black p-1.5 text-right font-mono font-bold">
                              {totalPcs > 0 ? totalPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                            </td>
                            <td className="border-r border-black p-1.5 text-right font-mono font-bold">
                              {totalQty > 0 ? totalQty.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces }) : "-"}
                            </td>
                            <td className="border-r border-black p-1.5"></td>
                            <td className="border-r border-black p-1.5 text-right"></td>
                            <td className="p-1.5 text-right font-mono font-bold text-sm">
                              ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Footer Section: Lower Financials, Words, Declaration & Signatures (Kept together on page break) */}
                    <div className="keep-together invoice-footer-block mt-auto pt-2">
                      {/* Lower Financials & Terms Split */}
                      <div className="grid grid-cols-12 border-2 border-black mb-3 divide-x-2 divide-black">
                        {/* Words & Declaration */}
                        <div className="col-span-7 p-2.5 flex flex-col justify-between space-y-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase block">Invoice Amount in Words:</span>
                            <p className="font-bold text-black italic text-sm mt-0.5">{numberToIndianWords(grandTotal)}</p>
                          </div>

                          <div className="text-[10px] text-gray-600 space-y-0.5">
                            <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                          </div>
                        </div>

                        {/* Bill Sundries & Net Amount */}
                        <div className="col-span-5 p-2.5 flex flex-col justify-between text-xs space-y-1">
                          <div className="space-y-1 font-mono">
                            <div className="flex justify-between text-gray-700 pb-1 border-b border-gray-200">
                              <span className="font-sans font-medium">Subtotal:</span>
                              <span className="font-bold">₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {billSundries.map((s, idx) => {
                              const amtVal = parseNumberValue(s.amount);
                              return (
                                <div key={idx} className="flex justify-between py-0.5">
                                  <span className="font-sans text-[11px] font-medium text-gray-700">{s.name}:</span>
                                  <span className="font-mono font-bold text-black">
                                    {s.type === "SUBTRACT" ? "-" : "+"}₹{amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="border-t-2 border-black pt-2 mt-2 bg-gray-100 p-2 border border-black flex justify-between items-center font-bold text-sm">
                            <span className="uppercase">Net Total (₹):</span>
                            <span className="font-mono text-base font-black">
                              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Full Sheet Footer & Signatures */}
                      <div className="border-t-2 border-black pt-3 flex justify-between items-end text-xs">
                        <div className="text-center min-w-[150px]">
                          <div className="h-10"></div>
                          <div className="border-t border-black pt-1 font-bold uppercase">Customer's Signature</div>
                        </div>
                        <div className="text-center min-w-[200px]">
                          <p className="text-[11px] text-gray-700 mb-10">
                            For <strong>{currentCompany?.legalName || currentCompany?.name || "Bahi Khata ERP"}</strong>
                          </p>
                          <div className="border-t border-black pt-1 font-bold uppercase">Authorised Signatory</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSaveInvoice} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs text-gray-200">
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
              {/* Top Series, Location, Inv No, Date & Party Bar */}
              <div className="flex flex-wrap items-end gap-2 bg-[#18181B] p-2.5 rounded-lg border border-white/5">
                {/* Series: Increased width so series names like GST SALES (Default) do not cut off */}
                <div className="w-64 sm:w-72 md:w-80 shrink-0">
                  <label className="block text-[11px] uppercase font-bold text-gray-400 mb-0.5">Series</label>
                  <div className="flex items-center gap-1">
                    <select
                      id="sales_series_dropdown"
                      value={series}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_SERIES__') {
                          setIsSeriesSettingsOpen(true);
                          e.target.value = series;
                          return;
                        }
                        handleSeriesChange(e.target.value);
                      }}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2.5 py-1.5 text-white text-xs sm:text-sm font-semibold focus:border-[#2588E8] focus:outline-none cursor-pointer"
                    >
                      <option value="">Series</option>
                      <option value="__ADD_SERIES__" className="text-amber-400 font-bold bg-[#142820]">+ Configure Voucher Series...</option>
                      {availableSeriesList.map((s) => (
                        <option key={s.id} value={s.seriesName}>
                          {s.seriesName} {s.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      id="sales_series_settings_btn"
                      onClick={() => setIsSeriesSettingsOpen(true)}
                      title="Open Series Settings (Prefix, Suffix, Start No, Digit, Default toggle, Bill Sundries)"
                      className="p-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] hover:text-[#52C7FF] border border-[rgba(112,185,245,0.25)] rounded transition cursor-pointer shrink-0"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="w-36 sm:w-44 shrink-0">
                  <label className="block text-[11px] uppercase font-bold text-gray-400 mb-0.5">Location</label>
                  <select
                    id="sales_location_dropdown"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2.5 py-1.5 text-white text-xs sm:text-sm focus:border-[#2588E8] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Location</option>
                    {activeLocations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} {loc.isDefault ? "(Default)" : ""}
                      </option>
                    ))}
                    {location && !activeLocations.some((l) => l.name === location) && (
                      <option value={location}>{location}</option>
                    )}
                  </select>
                </div>
                <div className="w-24 sm:w-28 shrink-0">
                  <label className="block text-[11px] uppercase font-bold text-gray-400 mb-0.5">
                    {isPurchase ? "Bill No *" : "Inv No *"}
                  </label>
                  <input
                    id="sales_bill_no_input"
                    type="text"
                    required
                    value={billNo}
                    onChange={e => setBillNo(e.target.value)}
                    className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-36 sm:w-40 shrink-0">
                  <label className="block text-[11px] uppercase font-bold text-gray-400 mb-0.5">Date *</label>
                  <DateInput
                    required
                    value={date}
                    onChange={(val) => setDate(val)}
                    size="sm"
                    className="w-full !h-[34px] !bg-[#202024] !border-white/10 rounded !px-2 text-white font-mono text-xs sm:text-sm focus-within:!border-amber-500"
                  />
                </div>
                {/* Party / Customer: Width reduced proportionally */}
                <div className="w-56 sm:w-64 lg:w-72 shrink-0">
                  <label className="block text-[11px] uppercase font-bold text-gray-400 mb-0.5">
                    {isSpareParts ? "Supplier / Store Vendor *" : isPurchase ? "Supplier / Vendor Party *" : "Party / Customer *"}
                  </label>
                  <PartySelectDropdown
                    value={party}
                    filterType={isPurchase ? 'CREDITOR' : 'DEBTOR'}
                    inputClassName="!text-sm !py-1.5"
                    onChange={(val) => {
                      setParty(val);
                      if (formError) setFormError(null);
                    }}
                    placeholder={isPurchase ? "Select or type Vendor / Supplier..." : "Select or type Customer..."}
                  />
                </div>
              </div>

              {/* Despatch Detail Section (Shifted above Item List) */}
              <div className="bg-[#18181B] p-2.5 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Despatch Detail
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* 1. Pakka */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-emerald-400 mb-0.5">
                      Pakka
                    </label>
                    <input
                      type="text"
                      id="despatch_pakka"
                      value={pakka}
                      onFocus={() => {
                        const clean = String(pakka).replace(/,/g, "").trim();
                        if (!isNaN(Number(clean)) && clean !== "") {
                          setPakka(clean);
                        }
                      }}
                      onBlur={handlePakkaBlur}
                      onChange={(e) => handlePakkaChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#202024] border border-emerald-500/30 rounded px-2.5 py-1.5 text-emerald-300 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* 2. Kacha - Supports Negative Values */}
                  <div>
                    <label className={`block text-[11px] uppercase font-semibold ${parseNumberValue(kacha) < 0 ? "text-rose-400" : "text-amber-400"} mb-0.5`}>
                      Kacha
                    </label>
                    <input
                      type="text"
                      id="despatch_kacha"
                      value={kacha}
                      onFocus={() => {
                        const clean = String(kacha).replace(/,/g, "").trim();
                        if (!isNaN(Number(clean)) && clean !== "") {
                          setKacha(clean);
                        }
                      }}
                      onBlur={handleKachaBlur}
                      onChange={(e) => handleKachaChange(e.target.value)}
                      placeholder="0.00"
                      className={`w-full bg-[#202024] border ${
                        parseNumberValue(kacha) < 0
                          ? "border-rose-500/60 text-rose-300 focus:border-rose-400"
                          : "border-amber-500/30 text-amber-300 focus:border-amber-500"
                      } rounded px-2.5 py-1.5 font-mono text-sm focus:outline-none`}
                      title={
                        parseNumberValue(kacha) < 0
                          ? "Negative Kacha: Pakka amount exceeds Grand Total"
                          : "Auto calculated: Grand Total - Pakka"
                      }
                    />
                  </div>

                  {/* 3. Weight */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      Weight
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="any"
                        id="despatch_weight"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 pr-12 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-2.5 text-xs font-bold text-amber-400 pointer-events-none uppercase">
                        Ton
                      </span>
                    </div>
                  </div>

                  {/* 4. Fare */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      Fare
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        id="despatch_fare"
                        value={fare}
                        onFocus={() => {
                          const clean = String(fare).replace(/,/g, "").trim();
                          if (!isNaN(Number(clean)) && clean !== "") {
                            setFare(clean);
                          }
                        }}
                        onBlur={() => {
                          setFare(formatIndianNumberWithDecimals(fare));
                        }}
                        onChange={(e) => setFare(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 pr-14 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-2.5 text-xs font-bold text-amber-400 pointer-events-none uppercase">
                        /Ton
                      </span>
                    </div>
                  </div>

                  {/* 5. Truck No. */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      {isSpareParts ? "Machine / Equipment" : "Truck No."}
                    </label>
                    <input
                      type="text"
                      id="despatch_truck_no"
                      value={truck}
                      onChange={(e) => setTruck(e.target.value.toUpperCase())}
                      placeholder={isSpareParts ? "e.g. Gangsaw #1" : "RJ-14-GA-0000"}
                      className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono text-sm uppercase focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 6. Mobile No. */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      Mobile No.
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs font-semibold text-amber-400/80 pointer-events-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        id="despatch_mobile_no"
                        value={mobile.replace(/^\+91\s*/, "")}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                          setMobile(digits ? `+91 ${digits}` : "");
                        }}
                        placeholder="98765 43210"
                        className="w-full bg-[#202024] border border-white/10 rounded pl-11 pr-2.5 py-1.5 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 7. Advance */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      Advance
                    </label>
                    <input
                      type="text"
                      id="despatch_advance"
                      value={advance}
                      onFocus={() => {
                        const clean = String(advance).replace(/[₹,\s]/g, "").trim();
                        if (!isNaN(Number(clean)) && clean !== "" && clean.toLowerCase() !== "nan") {
                          setAdvance(clean);
                        } else if (clean.toLowerCase() === "nan") {
                          setAdvance("");
                        }
                      }}
                      onBlur={() => {
                        const formatted = formatIndianNumberWithDecimals(advance);
                        setAdvance(formatted.toLowerCase() === "nan" ? "" : formatted);
                      }}
                      onChange={(e) => setAdvance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 8. Delivery */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-gray-400 mb-0.5">
                      Delivery
                    </label>
                    <input
                      type="text"
                      id="despatch_delivery"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder={isSpareParts ? "Main Store / Bin Location" : "City / Site / Address"}
                      className="w-full bg-[#202024] border border-white/10 rounded px-2.5 py-1.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Item Table matching the exact screenshot layout */}
              <div className="space-y-1.5">
                <div className="overflow-x-auto border border-[rgba(112,185,245,0.25)] rounded-lg max-h-64 sm:max-h-80 overflow-y-auto scroll-smooth bg-[#05101C]/85 shadow-md">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#7F98AE] text-xs uppercase font-mono tracking-wider border-b border-[rgba(112,185,245,0.25)] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10 min-w-[38px]">#</th>
                        <th className="py-2.5 px-3 text-left min-w-[210px]">Item Description</th>
                        <th className="py-2.5 px-3 text-left w-44 min-w-[140px]">Ledger</th>
                        <th className="py-2.5 px-3 text-center w-48 min-w-[150px]">Reference</th>
                        <th className="py-2.5 px-3 text-right w-28 min-w-[95px]">Pcs</th>
                        <th className="py-2.5 px-3 text-right w-28 min-w-[95px]">Quantity</th>
                        <th className="py-2.5 px-3 text-center w-16 min-w-[55px]">Unit</th>
                        <th className="py-2.5 px-3 text-center w-20 min-w-[72px]">Tax %</th>
                        <th className="py-2.5 px-3 text-right w-28 min-w-[95px]">Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right w-36 min-w-[120px]">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right w-32 min-w-[110px]">Pakka Amt</th>
                        <th className="py-2.5 px-3 text-center w-16 min-w-[65px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40 bg-[#05101C]/60">
                      {items.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-[rgba(57,167,255,0.04)] transition-colors">
                          {/* 1. Row Index # */}
                          <td className="py-2 px-3 text-center font-mono text-[#7F98AE] text-[13px]">{idx + 1}</td>

                          {/* 2. Item Description */}
                          <td className="py-2 px-3 align-middle text-left">
                            {customItemRows[idx] ? (
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  id={`sales_item_input_${idx}`}
                                  list={isSpareParts ? "spare_parts_suggestions" : undefined}
                                  value={row.item}
                                  onChange={(e) => handleItemChange(idx, "item", e.target.value)}
                                  onFocus={(e) => {
                                    requestAnimationFrame(() => {
                                      e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                    });
                                  }}
                                  className="w-full h-[34px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] focus:border-[#2588E8] rounded-md px-2.5 text-[#FFFFFF] font-semibold text-[13.5px] focus:outline-none pr-7 scroll-mt-12"
                                  placeholder={isSpareParts ? "Spare Part name..." : "Item name..."}
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomItemRows((prev) => ({ ...prev, [idx]: false }))}
                                  title="Switch back to Master Dropdown"
                                  className="absolute right-1 text-[#7F98AE] hover:text-[#FFFFFF] px-1.5 py-0.5 text-xs font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                             <SearchableDropdown
                                id={`sales_item_dropdown_${idx}`}
                                value={row.item}
                                onChange={(val) => handleItemSelect(idx, val)}
                                onFocus={(e) => {
                                  requestAnimationFrame(() => {
                                    e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                  });
                                }}
                                options={
                                  isSpareParts
                                    ? [
                                        ...sparePartsSuggestions.map((sp) => ({
                                          value: sp,
                                          label: sp,
                                          badge: 'SPARE',
                                        })),
                                        ...(row.item && !sparePartsSuggestions.includes(row.item)
                                          ? [{ value: row.item, label: row.item }]
                                          : []),
                                      ]
                                    : [
                                        ...masterItems.map((mi) => ({
                                          value: mi.name,
                                          label: mi.name,
                                          subLabel: mi.code ? `Code: ${mi.code}` : undefined,
                                          badge: mi.primaryUnit,
                                        })),
                                        ...(row.item && !masterItems.some((mi) => mi.name === row.item)
                                          ? [{ value: row.item, label: row.item }]
                                          : []),
                                      ]
                                }
                                placeholder={isSpareParts ? "-- Select Spare Part --" : "-- Select Item --"}
                                addOptionLabel={isSpareParts ? "+ Add Spare Part (Master)..." : "+ Add Item (Item Master)..."}
                                onAddOption={() => {
                                  if (isSpareParts) {
                                    setQuickSparePartRowIndex(idx);
                                    setQuickSparePartModalOpen(true);
                                  } else {
                                    setQuickItemRowIndex(idx);
                                    setQuickItemModalOpen(true);
                                  }
                                }}
                                customOptionLabel="+ Type Custom Item..."
                                onCustomOption={() => {
                                  setCustomItemRows((prev) => ({ ...prev, [idx]: true }));
                                }}
                                buttonClassName="h-[34px] text-[13px]"
                              />
                            )}
                          </td>

                          {/* 3. Ledger Column */}
                          <td className="py-2 px-3 align-middle text-left">
                            <SearchableDropdown
                              id={`sales_item_ledger_${idx}`}
                              value={row.ledger || ""}
                              onChange={(val) => handleItemChange(idx, "ledger", val)}
                              onFocus={(e) => {
                                requestAnimationFrame(() => {
                                  e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                });
                              }}
                              options={[
                                ...availableLedgers.map((ldg) => ({
                                  value: ldg,
                                  label: ldg,
                                })),
                                ...(row.ledger && !availableLedgers.includes(row.ledger)
                                  ? [{ value: row.ledger, label: row.ledger }]
                                  : []),
                              ]}
                              placeholder="Select Ledger"
                              addOptionLabel="+ Add Account Ledger..."
                              onAddOption={() => {
                                setQuickLedgerRowIndex(idx);
                                setQuickLedgerModalOpen(true);
                              }}
                              buttonClassName="h-[34px] text-[13px]"
                            />
                          </td>

                          {/* 4. Reference Column - Multi-line Reference supporting up to 50 lines with Enter key navigation */}
                          <td className="py-2 px-2.5 align-top text-center">
                            <textarea
                              id={`sales_item_ref_${idx}`}
                              rows={Math.min(Math.max((row.reference || "").split("\n").length, 1), 5)}
                              value={row.reference || ""}
                              onChange={(e) => {
                                const lines = e.target.value.split("\n");
                                if (lines.length > 50) {
                                  handleItemChange(idx, "reference", lines.slice(0, 50).join("\n"));
                                } else {
                                  handleItemChange(idx, "reference", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const textarea = e.currentTarget;
                                  const { selectionStart, value } = textarea;
                                  const beforeCursor = value.substring(0, selectionStart);
                                  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
                                  const afterCursor = value.substring(selectionStart);
                                  const nextNewline = afterCursor.indexOf("\n");
                                  const lineEnd = nextNewline === -1 ? value.length : selectionStart + nextNewline;
                                  const currentLineText = value.substring(lineStart, lineEnd).trim();

                                  if (currentLineText === "") {
                                    // When Enter is pressed on an empty line -> Shift focus to next field (Pcs)
                                    e.preventDefault();

                                    // Clean up trailing newline if cursor is at the end
                                    if (value.endsWith("\n") && selectionStart === value.length) {
                                      const cleaned = value.replace(/\n+$/, "");
                                      handleItemChange(idx, "reference", cleaned);
                                    }

                                    const nextInput = document.getElementById(`sales_item_pcs_${idx}`) as HTMLInputElement | null;
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select?.();
                                    } else {
                                      const qtyInput = document.getElementById(`sales_item_qty_${idx}`) as HTMLInputElement | null;
                                      qtyInput?.focus();
                                    }
                                  } else {
                                    // Line has text -> Enter creates next line in same field
                                    const lines = value.split("\n");
                                    if (lines.length >= 50) {
                                      e.preventDefault();
                                    }
                                  }
                                }
                              }}
                              onFocus={(e) => {
                                requestAnimationFrame(() => {
                                  e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                });
                              }}
                              placeholder="Reference..."
                              className="w-full min-h-[32px] text-left font-mono text-xs text-[#F1F7FC] bg-[#0D2B4A]/80 border border-[rgba(112,185,245,0.25)] hover:border-[rgba(112,185,245,0.45)] focus:border-[#2588E8] focus:bg-[#11355B] rounded-md px-2 py-1 placeholder:text-[#7F98AE]/50 placeholder:italic focus:outline-none transition-colors scroll-mt-12 resize-y leading-snug"
                              title="Reference: Type text and press Enter for next line (up to 50 lines). Press Enter on empty line to move to Pcs."
                            />
                          </td>

                          {/* 5. Pcs Column */}
                          <td className="py-2 px-3 align-middle text-right">
                            {(() => {
                              const unitInfo = getItemUnitInfo(row.item);
                              const rawPcs = row.pcs !== undefined && row.pcs !== null ? String(row.pcs) : "";
                              const cleanPcs = rawPcs.replace(/,/g, "").trim();
                              const isRowFocused = focusedPcsRow === idx;
                              const displayPcs = isRowFocused
                                ? cleanPcs
                                : cleanPcs !== "" && !isNaN(Number(cleanPcs))
                                ? Number(cleanPcs).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : rawPcs;

                              return (
                                <input
                                  type="text"
                                  id={`sales_item_pcs_${idx}`}
                                  value={displayPcs}
                                  onFocus={(e) => {
                                    setFocusedPcsRow(idx);
                                    requestAnimationFrame(() => {
                                      e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                    });
                                  }}
                                  onChange={(e) => handleItemChange(idx, "pcs", e.target.value)}
                                  onBlur={(e) => {
                                    setFocusedPcsRow(null);
                                    const clean = e.target.value.replace(/,/g, "").trim();
                                    if (clean !== "" && !isNaN(Number(clean))) {
                                      handleItemChange(
                                        idx,
                                        "pcs",
                                        Number(clean).toLocaleString("en-IN", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                      );
                                    }
                                  }}
                                  className="w-full h-[32px] text-right px-2 font-mono text-[13.5px] rounded transition scroll-mt-12 bg-transparent text-[#B7C9D9] border border-transparent hover:border-[rgba(112,185,245,0.25)] focus:border-[#2588E8] focus:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl focus:outline-none"
                                  placeholder="0.00"
                                  title={
                                    unitInfo.formulaDescription
                                      ? `Dual Unit: ${unitInfo.alternateUnit || "PCS"} (${unitInfo.formulaDescription})`
                                      : `Pcs / Alternate Unit (${unitInfo.alternateUnit || "PCS"})`
                                  }
                                />
                              );
                            })()}
                          </td>

                          {/* 6. Quantity Column */}
                          <td className="py-2 px-3 align-middle text-right">
                            {(() => {
                              const unitInfo = getItemUnitInfo(row.item);
                              const dec = getItemDec(row.item);
                              const rawQty = row.qty !== undefined && row.qty !== null ? String(row.qty) : "";
                              const cleanQty = rawQty.replace(/,/g, "").trim();
                              const isRowFocused = focusedQtyRow === idx;
                              const displayQty = isRowFocused
                                ? cleanQty
                                : cleanQty !== "" && !isNaN(Number(cleanQty))
                                ? Number(cleanQty).toLocaleString("en-IN", {
                                    minimumFractionDigits: dec,
                                    maximumFractionDigits: dec,
                                  })
                                : rawQty;

                              return (
                                <input
                                  type="text"
                                  value={displayQty}
                                  onFocus={(e) => {
                                    setFocusedQtyRow(idx);
                                    requestAnimationFrame(() => {
                                      e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                    });
                                  }}
                                  onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                                  onBlur={(e) => {
                                    setFocusedQtyRow(null);
                                    const clean = e.target.value.replace(/,/g, "").trim();
                                    if (clean !== "" && !isNaN(Number(clean))) {
                                      handleItemChange(
                                        idx,
                                        "qty",
                                        Number(clean).toLocaleString("en-IN", {
                                          minimumFractionDigits: dec,
                                          maximumFractionDigits: dec,
                                        })
                                      );
                                    }
                                  }}
                                  className="w-full h-[32px] text-right bg-transparent px-2 text-[#FFFFFF] font-mono font-bold text-[13.5px] focus:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl focus:border-[#2588E8] rounded border border-transparent hover:border-[rgba(112,185,245,0.25)] scroll-mt-12 focus:outline-none"
                                  placeholder="0.00"
                                  title={
                                    unitInfo.formulaDescription
                                      ? `Main Unit: ${row.unit || unitInfo.mainUnit} (${unitInfo.formulaDescription})`
                                      : "Main Unit Quantity"
                                  }
                                />
                              );
                            })()}
                          </td>

                          {/* 7. Unit Column */}
                          <td className="py-2 px-3 align-middle text-center">
                            <span
                              className="font-mono text-xs uppercase text-[#7F98AE] font-semibold select-none cursor-default"
                              title="Main Unit (Auto from Item Master)"
                            >
                              {row.unit || (isSpareParts ? "NOS" : "SQFT")}
                            </span>
                          </td>

                          {/* 8. Tax % Dropdown */}
                          <td className="py-2 px-2 align-middle text-center">
                            <select
                              value={row.taxPercent !== undefined && row.taxPercent !== null && row.taxPercent !== "" ? String(row.taxPercent) : ""}
                              onChange={(e) => handleItemChange(idx, "taxPercent", e.target.value)}
                              className="w-full h-[32px] bg-[rgba(18,48,76,0.55)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-emerald-400/60 focus:border-emerald-400 rounded px-1.5 text-[12px] text-emerald-400 font-semibold focus:outline-none cursor-pointer"
                              title="Tax % (from Item Master)"
                            >
                              <option value="">--</option>
                              {taxPercentOptions.map((p) => (
                                <option key={p} value={String(p)}>{p}%</option>
                              ))}
                              {/* If current row has a custom % not in standard list */}
                              {row.taxPercent !== undefined && row.taxPercent !== "" &&
                                !taxPercentOptions.includes(Number(row.taxPercent)) && (
                                  <option value={String(row.taxPercent)}>{row.taxPercent}%</option>
                                )}
                            </select>
                          </td>

                          {/* 8. Rate (₹) Column */}
                          <td className="py-2 px-3 align-middle text-right">
                            <div className="relative flex items-center h-[32px]">
                              <span className="absolute left-1.5 text-[#7F98AE] text-xs font-mono select-none pointer-events-none">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.rate}
                                onFocus={(e) => {
                                  requestAnimationFrame(() => {
                                    e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                  });
                                }}
                                onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                                onBlur={(e) => {
                                  const clean = String(e.target.value).replace(/,/g, "").trim();
                                  if (clean !== "" && !isNaN(Number(clean))) {
                                    handleItemChange(idx, "rate", Number(clean).toFixed(2));
                                  }
                                }}
                                className="w-full h-full text-right bg-transparent pl-4 pr-1.5 text-[#F1F7FC] font-mono text-[13.5px] focus:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl focus:border-[#2588E8] rounded border border-transparent hover:border-[rgba(112,185,245,0.25)] scroll-mt-12 focus:outline-none"
                                placeholder="0.00"
                                title="Rate (₹)"
                              />
                            </div>
                          </td>

                          {/* 9. Amount (₹) Column */}
                          <td className="py-2 px-3 align-middle text-right">
                            <div className="relative flex items-center h-[32px]">
                              <span className="absolute left-1.5 text-[#2588E8]/80 text-xs font-mono font-bold select-none pointer-events-none">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.amount !== undefined && row.amount !== null ? row.amount : ""}
                                onFocus={(e) => {
                                  requestAnimationFrame(() => {
                                    e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                  });
                                }}
                                onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                                onBlur={(e) => {
                                  const clean = String(e.target.value).replace(/,/g, "").trim();
                                  if (clean !== "" && !isNaN(Number(clean))) {
                                    handleItemChange(idx, "amount", Number(clean).toFixed(2));
                                  }
                                }}
                                className="w-full h-full text-right bg-transparent pl-4 pr-1.5 text-[#2588E8] font-mono font-bold text-[13.5px] focus:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl focus:border-[#2588E8] rounded border border-transparent hover:border-[rgba(112,185,245,0.25)] scroll-mt-12 focus:outline-none"
                                placeholder="0.00"
                                title="Item Amount (₹)"
                              />
                            </div>
                          </td>

                          {/* 10. Pakka Amount – saved to bill, no total */}
                          <td className="py-2 px-2 align-middle text-right">
                            <div className="relative flex items-center h-[32px]">
                              <span className="absolute left-1.5 text-amber-400/70 text-xs font-mono select-none pointer-events-none">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.pakkaAmount !== undefined && row.pakkaAmount !== null ? row.pakkaAmount : ""}
                                onFocus={(e) => {
                                  requestAnimationFrame(() => {
                                    e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                                  });
                                }}
                                onChange={(e) => handleItemChange(idx, "pakkaAmount", e.target.value)}
                                onBlur={(e) => {
                                  const clean = String(e.target.value).replace(/,/g, "").trim();
                                  if (clean !== "" && !isNaN(Number(clean))) {
                                    handleItemChange(idx, "pakkaAmount", Number(clean).toFixed(2));
                                  }
                                }}
                                className="w-full h-full text-right bg-transparent pl-4 pr-1.5 text-amber-400 font-mono text-[13.5px] focus:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl focus:border-amber-400 rounded border border-transparent hover:border-amber-400/30 scroll-mt-12 focus:outline-none"
                                placeholder="0.00"
                                title="Pakka Amount (saved only, not totalled)"
                              />
                            </div>
                          </td>

                          {/* 11. Action Column */}
                          <td className="py-2 px-3 align-middle text-center">
                            <div className="h-[32px] flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => addItemRow(idx)}
                                title="Add Line Below"
                                className="p-1 rounded text-[#2588E8] hover:text-[#c5e4af] hover:bg-[#0D2B4A] active:scale-95 transition cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                title="Delete Line"
                                className="p-1 rounded text-[#7F98AE] hover:text-[#FF647C] hover:bg-rose-500/20 active:scale-95 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={12} className="py-4 px-3 text-center text-[#7F98AE] text-sm">
                            No item lines.{" "}
                            <button
                              type="button"
                              onClick={() => addItemRow()}
                              className="text-[#2588E8] hover:text-[#c5e4af] hover:underline inline-flex items-center gap-1 font-semibold ml-1 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> Add Item Line
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10 font-mono bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] shadow-md">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right font-mono font-bold text-xs uppercase tracking-wider text-[#7F98AE]">
                          SUBTOTAL:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#B7C9D9] text-sm" title="Total Pcs">
                          {totalPcs > 0 ? totalPcs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#FFFFFF] text-sm" title="Total Qty">
                          {totalQty.toLocaleString("en-IN", { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#7F98AE] text-xs"></td>{/* Unit */}
                        <td className="py-2.5 px-3 text-center text-[#7F98AE] text-xs"></td>{/* Tax% */}
                        <td className="py-2.5 px-3 text-right text-[#7F98AE] text-xs"></td>{/* Rate */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#2588E8] text-sm" title="Total Item Amount">
                          ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#7F98AE] text-xs"></td>{/* Pakka Amt – no total */}
                        <td className="py-2.5 px-3 text-center"></td>{/* Action */}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Bill Sundries Section - Shifted to Right Side */}
              <div className="flex justify-end w-full">
                <div className="w-full max-w-3xl bg-[#18181B] p-2.5 rounded-lg border border-white/10 space-y-2 ml-auto shadow-md">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-gray-200">Bill Sundries &amp; Additional Charges</span>
                      {billSundries.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-amber-400 font-mono font-bold">
                          {billSundries.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBillSundries([...billSundries, { name: "", amount: 0, type: "ADD", rate: 0, isPercentage: false, calculateOn: "SUB_TOTAL" }])}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs font-bold uppercase flex items-center gap-1 cursor-pointer border border-white/10"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-400" /> Add Sundry
                      </button>
                    </div>
                  </div>

                  {billSundries.length > 0 && (
                    <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase font-mono text-gray-400 px-1 pb-1 border-b border-white/5">
                      <div className="w-48 sm:w-56 shrink-0">Sundry Ledger</div>
                      <div className="w-28 shrink-0">Calc On</div>
                      <div className="w-28 shrink-0">Type</div>
                      <div className="w-24 shrink-0 text-center">Rate / %</div>
                      <div className="w-28 shrink-0 text-right">Amount (₹)</div>
                      <div className="w-8 shrink-0 text-center">Del</div>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {billSundries.map((sundry, sIdx) => {
                      const isCustomMode = customSundryRows[sIdx];
                      const upperName = (sundry.name || "").toUpperCase().trim();
                      const isRoundOff = upperName.includes("ROUND") || sundry.type === "ADD_LESS";
                      const isCalculatedByRate = Boolean(sundry.isPercentage || (sundry.rate !== undefined && sundry.rate !== "" && Number(sundry.rate) > 0));
                      const isEditableBase = isCalculatedByRate && !isRoundOff;

                      const getBaseForSundry = (baseType?: string) => {
                        if (baseType === "PAKKA") return parseNumberValue(pakka);
                        if (baseType === "KACHA") return parseNumberValue(kacha);
                        return itemTotal;
                      };

                      return (
                        <div key={sIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-sm bg-white/2 p-1.5 rounded border border-white/5 hover:border-white/10 transition">
                          {/* 1. Account Ledger Dropdown or Custom Text (no edit button) */}
                          <div className="w-48 sm:w-56 shrink-0">
                            {isCustomMode ? (
                              <div className="relative flex items-center w-full">
                                <input
                                  type="text"
                                  value={sundry.name}
                                  onChange={(e) => {
                                    const copy = [...billSundries];
                                    copy[sIdx].name = e.target.value;
                                    setBillSundries(copy);
                                  }}
                                  placeholder="Sundry name..."
                                  className="w-full bg-[#202024] border border-amber-500/40 rounded px-2.5 py-1 text-white text-xs focus:border-amber-500 focus:outline-hidden pr-6"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomSundryRows((prev) => ({ ...prev, [sIdx]: false }))}
                                  title="Switch back to Ledger Dropdown"
                                  className="absolute right-1 text-gray-400 hover:text-white px-1 text-xs font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <select
                                value={sundry.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "__CUSTOM__") {
                                    setCustomSundryRows((prev) => ({ ...prev, [sIdx]: true }));
                                    return;
                                  }
                                  const copy = [...billSundries];
                                  copy[sIdx].name = val;

                                  const upper = val.toUpperCase();
                                  if (upper.includes("DISCOUNT") || upper.includes("REBATE") || upper.includes("LESS")) {
                                    copy[sIdx].type = "SUBTRACT";
                                  } else if (upper.includes("ROUND")) {
                                    copy[sIdx].type = "ADD_LESS";
                                  } else {
                                    copy[sIdx].type = "ADD";
                                  }

                                  // Check if configured in active series!
                                  const activeConf = availableSeriesList.find((s) => s.seriesName === series);
                                  const seriesSundry = activeConf?.defaultSundries?.find(
                                    (ds) => ds.name.toUpperCase().trim() === upper.trim()
                                  );

                                  const baseVal = getBaseForSundry(copy[sIdx].calculateOn);

                                  if (seriesSundry) {
                                    copy[sIdx].type = seriesSundry.type;
                                    copy[sIdx].isPercentage = seriesSundry.isPercentage;
                                    copy[sIdx].rate = seriesSundry.amount;
                                    if (seriesSundry.isPercentage) {
                                      const r = Number(seriesSundry.amount) || 0;
                                      copy[sIdx].amount = Number(((baseVal * r) / 100).toFixed(2));
                                    } else {
                                      copy[sIdx].amount = Number(seriesSundry.amount) || 0;
                                    }
                                  } else {
                                    // Check for % in name
                                    const match = upper.match(/(\d+(?:\.\d+)?)\s*%/);
                                    if (match) {
                                      const rate = parseFloat(match[1]);
                                      copy[sIdx].rate = rate;
                                      copy[sIdx].isPercentage = true;
                                      copy[sIdx].amount = Number(((baseVal * rate) / 100).toFixed(2));
                                    }
                                  }
                                  setBillSundries(copy);
                                }}
                                className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2.5 py-1 text-white text-xs focus:border-[#2588E8] focus:outline-hidden cursor-pointer"
                              >
                                <option value="">-- Select Ledger --</option>
                                {sundry.name &&
                                  !sundryTaxLedgers.some((l) => l.name === sundry.name) &&
                                  !sundryExpenseLedgers.some((l) => l.name === sundry.name) &&
                                  !otherSundryLedgers.some((l) => l.name === sundry.name) && (
                                    <option value={sundry.name}>{sundry.name}</option>
                                  )}

                                <optgroup label="Taxes & Surcharges (GST)">
                                  {sundryTaxLedgers.length > 0 ? (
                                    sundryTaxLedgers.map((l) => (
                                      <option key={l.id} value={l.name}>
                                        {l.name}
                                      </option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="CGST 9%">CGST 9%</option>
                                      <option value="SGST 9%">SGST 9%</option>
                                      <option value="IGST 18%">IGST 18%</option>
                                    </>
                                  )}
                                </optgroup>

                                <optgroup label="Expenses & Charges">
                                  <option value="FREIGHT / TRANSPORT CHARGES">FREIGHT / TRANSPORT CHARGES</option>
                                  <option value="LOADING & PACKING CHARGES">LOADING & PACKING CHARGES</option>
                                  <option value="INSURANCE CHARGES">INSURANCE CHARGES</option>
                                  <option value="DISCOUNT">DISCOUNT</option>
                                  <option value="ROUND OFF">ROUND OFF</option>
                                  {sundryExpenseLedgers.map((l) => (
                                    <option key={l.id} value={l.name}>
                                      {l.name}
                                    </option>
                                  ))}
                                </optgroup>

                                {otherSundryLedgers.length > 0 && (
                                  <optgroup label="All Company Ledgers">
                                    {otherSundryLedgers.map((l) => (
                                      <option key={l.id} value={l.name}>
                                        {l.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                <option value="__CUSTOM__">+ Custom Name...</option>
                              </select>
                            )}
                          </div>

                          {/* 2. Calculate On Dropdown: Pakka, Kacha, Sub Total */}
                          <div className="w-28 shrink-0">
                            <select
                              disabled={!isEditableBase}
                              value={isEditableBase ? (sundry.calculateOn || "SUB_TOTAL") : ""}
                              onChange={(e) => {
                                const newBase = e.target.value as "SUB_TOTAL" | "PAKKA" | "KACHA";
                                const copy = [...billSundries];
                                copy[sIdx].calculateOn = newBase;
                                const recalculated = recalculateSundries(copy, itemTotal, series, pakka, kacha);
                                setBillSundries(recalculated);
                              }}
                              className={`w-full border rounded px-2 py-1 text-xs font-medium focus:border-[#2588E8] focus:outline-hidden transition ${
                                isEditableBase
                                  ? "bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)] text-amber-300 cursor-pointer hover:border-[rgba(112,185,245,0.4)]"
                                  : "bg-white/5 border-transparent text-gray-500 cursor-not-allowed select-none"
                              }`}
                              title={
                                isEditableBase
                                  ? "Select Base: Sub Total, Pakka, or Kacha"
                                  : isRoundOff
                                  ? "Round off calculates on final bill amount"
                                  : "Manual fixed amount sundry"
                              }
                            >
                              {isEditableBase ? (
                                <>
                                  <option value="SUB_TOTAL">Sub Total</option>
                                  <option value="PAKKA">Pakka</option>
                                  <option value="KACHA">Kacha</option>
                                </>
                              ) : (
                                <option value="">-- N/A --</option>
                              )}
                            </select>
                          </div>

                          {/* 3. Type Selector */}
                          <div className="w-28 shrink-0">
                            <select
                              value={sundry.type || "ADD"}
                              onChange={(e) => {
                                const copy = [...billSundries];
                                copy[sIdx].type = e.target.value as any;
                                setBillSundries(copy);
                              }}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2 py-1 text-gray-300 text-xs focus:border-[#2588E8] focus:outline-hidden"
                            >
                              <option value="ADD">Add (+)</option>
                              <option value="SUBTRACT">Subtract (-)</option>
                              <option value="ADD_LESS">Add / Less (+/-)</option>
                            </select>
                          </div>

                          {/* 4. Rate / Percentage Selector */}
                          <div className="w-24 shrink-0 flex items-center gap-1 justify-center">
                            {(() => {
                              const rawRate = sundry.rate !== undefined && sundry.rate !== null ? String(sundry.rate) : "";
                              const cleanRate = rawRate.replace(/,/g, "").trim();
                              const isRateFocused = focusedSundryRateIdx === sIdx;
                              const displayRate = isRateFocused
                                ? cleanRate
                                : cleanRate !== "" && !isNaN(Number(cleanRate))
                                ? Number(cleanRate).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : rawRate;

                              return (
                                <input
                                  type="text"
                                  value={displayRate}
                                  onFocus={() => setFocusedSundryRateIdx(sIdx)}
                                  onChange={(e) => {
                                    const newRate = e.target.value;
                                    const copy = [...billSundries];
                                    copy[sIdx].rate = newRate;
                                    if (copy[sIdx].isPercentage) {
                                      const numRate = parseNumberValue(newRate) || 0;
                                      const base = getBaseForSundry(copy[sIdx].calculateOn);
                                      copy[sIdx].amount = Number(((base * numRate) / 100).toFixed(2)).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                    }
                                    setBillSundries(copy);
                                  }}
                                  onBlur={(e) => {
                                    setFocusedSundryRateIdx(null);
                                    const clean = e.target.value.replace(/,/g, "").trim();
                                    if (clean !== "" && !isNaN(Number(clean))) {
                                      const copy = [...billSundries];
                                      copy[sIdx].rate = Number(clean).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                      setBillSundries(copy);
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-16 bg-[#202024] border border-white/10 rounded px-1.5 py-1 text-right text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                                  title="Configured rate or percentage (Thousand separator & 2 decimals)"
                                />
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...billSundries];
                                copy[sIdx].isPercentage = !copy[sIdx].isPercentage;
                                if (copy[sIdx].isPercentage) {
                                  const r = parseNumberValue(copy[sIdx].rate) || 0;
                                  const base = getBaseForSundry(copy[sIdx].calculateOn);
                                  copy[sIdx].amount = Number(((base * r) / 100).toFixed(2)).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                                }
                                setBillSundries(copy);
                              }}
                              className={`px-1.5 py-0.5 rounded text-xs font-bold transition cursor-pointer border ${
                                sundry.isPercentage
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-white/5 text-gray-400 border-white/10'
                              }`}
                              title="Toggle Percentage (%) vs Fixed Amount (₹)"
                            >
                              {sundry.isPercentage ? '%' : '₹'}
                            </button>
                          </div>

                          {/* 5. Calculated Amount */}
                          <div className="w-28 shrink-0">
                            {(() => {
                              const rawAmt = sundry.amount !== undefined && sundry.amount !== null ? String(sundry.amount) : "";
                              const cleanAmt = rawAmt.replace(/,/g, "").trim();
                              const isAmtFocused = focusedSundryAmountIdx === sIdx;
                              const displayAmt = isAmtFocused
                                ? cleanAmt
                                : cleanAmt !== "" && !isNaN(Number(cleanAmt))
                                ? Number(cleanAmt).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : cleanAmt.toLowerCase() === "nan" ? "0.00" : rawAmt;

                              return (
                                <input
                                  type="text"
                                  value={displayAmt}
                                  onFocus={() => setFocusedSundryAmountIdx(sIdx)}
                                  onChange={(e) => {
                                    const copy = [...billSundries];
                                    copy[sIdx].amount = e.target.value;
                                    setBillSundries(copy);
                                  }}
                                  onBlur={(e) => {
                                    setFocusedSundryAmountIdx(null);
                                    const clean = e.target.value.replace(/,/g, "").trim();
                                    if (clean !== "" && !isNaN(Number(clean))) {
                                      const copy = [...billSundries];
                                      copy[sIdx].amount = Number(clean).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                      setBillSundries(copy);
                                    }
                                  }}
                                  className="w-full bg-[#202024] border border-white/10 rounded px-2 py-1 text-right text-white font-mono text-sm focus:border-amber-500 focus:outline-hidden"
                                  placeholder="0.00"
                                  title="Bill Sundry Amount (Thousand separator & 2 decimals)"
                                />
                              );
                            })()}
                          </div>

                          {/* 6. Delete Button */}
                          <div className="w-8 shrink-0 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setBillSundries(billSundries.filter((_, i) => i !== sIdx))}
                              className="text-gray-500 hover:text-rose-400 p-1 cursor-pointer rounded hover:bg-rose-500/10 transition"
                              title="Delete Sundry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sticky Action & Summary Bar */}
            <div className="bg-[#18181B] border-t border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-gray-400">Grand Total:</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-amber-400">
                  ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {isSubmitting ? "Saving..." : "Save Invoice"}
                </button>
                <button
                  type="button"
                  id="sales_save_and_print_btn"
                  onClick={(e) => handleSaveInvoice(e, true)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
                  title="Save invoice and immediately open print view"
                >
                  <Printer className="w-3.5 h-3.5" /> {isSubmitting ? "Saving..." : "Save & Print"}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 font-bold uppercase text-xs tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Sales Series Settings Modal (Exclusive for Sales Series, No Vouchers/Purchase, No Fix Account) */}
      {isSeriesSettingsOpen && (
        <SalesSeriesSettingsModal
          isOpen={isSeriesSettingsOpen}
          onClose={() => setIsSeriesSettingsOpen(false)}
          fiscalYearShort={currentFiscalYear?.name?.slice(-2) || "26"}
          ledgers={ledgers}
          focusSeriesName={series}
          onSeriesConfigUpdated={(activeSeriesName) => {
            const freshList = voucherSeriesService.getSeriesForVoucherType("SALES");
            setAvailableSeriesList(freshList);
            const chosen =
              activeSeriesName ||
              series ||
              freshList.find((s) => s.isDefault)?.seriesName ||
              freshList[0]?.seriesName;
            if (chosen) {
              setSeries(chosen);
              const conf = freshList.find((s) => s.seriesName === chosen);
              if (conf && !initialData) {
                const fyShort = currentFiscalYear?.name?.slice(-2) || "26";
                setBillNo(voucherSeriesService.formatVoucherNumber(conf, fyShort, conf.nextNumber));
                if (conf.defaultSundries && conf.defaultSundries.length > 0) {
                  const initialSundries = conf.defaultSundries.map((s) => ({
                    name: s.name,
                    amount: 0,
                    type: s.type,
                    rate: s.amount,
                    isPercentage: s.isPercentage,
                    calculateOn: "SUB_TOTAL" as const,
                  }));
                  setBillSundries(recalculateSundries(initialSundries, itemTotal, conf.seriesName, pakka, kacha));
                }
              }
            }
          }}
        />
      )}

      {/* Full Original Item Master Modal */}
      <FullItemMasterModal
        isOpen={quickItemModalOpen}
        initialName=""
        onClose={() => setQuickItemModalOpen(false)}
        onCreated={handleItemCreated}
      />

      {/* Full Original Ledger Modal */}
      <FullLedgerMasterModal
        isOpen={quickLedgerModalOpen}
        initialName=""
        defaultGroupId={isPurchase ? "grp-sundry-creditors" : "grp-sundry-debtors"}
        onClose={() => {
          setQuickLedgerModalOpen(false);
          setQuickLedgerRowIndex(null);
        }}
        onCreated={async (newLedger) => {
          if (quickLedgerRowIndex !== null) {
            handleItemChange(quickLedgerRowIndex, "ledger", newLedger.name);
            setTimeout(() => {
              document.getElementById(`sales_item_ledger_${quickLedgerRowIndex}`)?.focus();
            }, 60);
          }
          setQuickLedgerModalOpen(false);
          setQuickLedgerRowIndex(null);
        }}
      />

      {/* Full Original Spare Part Modal */}
      <FullSparePartModal
        isOpen={quickSparePartModalOpen}
        initialName=""
        onClose={() => {
          setQuickSparePartModalOpen(false);
          setQuickSparePartRowIndex(null);
        }}
        onCreated={(part) => {
          if (quickSparePartRowIndex !== null && quickSparePartRowIndex >= 0 && quickSparePartRowIndex < items.length) {
            handleItemSelect(quickSparePartRowIndex, part.name);
            handleItemChange(quickSparePartRowIndex, "unit", part.unit || "NOS");
            if (part.unitCost) {
              handleItemChange(quickSparePartRowIndex, "rate", String(part.unitCost));
            }
            setTimeout(() => {
              const el =
                document.getElementById(`sales_item_dropdown_${quickSparePartRowIndex}`) ||
                document.getElementById(`sales_item_input_${quickSparePartRowIndex}`);
              el?.focus();
            }, 70);
          }
          setQuickSparePartModalOpen(false);
          setQuickSparePartRowIndex(null);
        }}
      />

      {/* Escape Close Confirmation Modal */}
      <FormCloseConfirmModal
        isOpen={showEscapeConfirm}
        title={isPurchase ? "Save Purchase Bill Before Closing?" : "Save Sales Invoice Before Closing?"}
        message={`Do you want to save ${isPurchase ? 'Purchase Bill' : 'Sales Invoice'} "${billNo.trim() || 'this bill'}" for "${party.trim() || 'customer'}" before closing this form?`}
        onConfirmSave={handleEscapeSave}
        onDiscard={() => {
          setShowEscapeConfirm(false);
          setMinimizedInvoice(null);
          onClose();
        }}
        onCancel={() => setShowEscapeConfirm(false)}
      />
    </div>,
    document.body
  );
};

