import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryEngine, ItemStockSummary } from '../../services/inventoryEngine';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { ExportEngine } from '../../services/exportEngine';
import { InventoryItem } from '../../types';
import { WastageRecordModal } from './WastageRecordModal';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  Package,
  Plus,
  FileDown,
  Printer,
  Search,
  Scissors,
  Layers,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Save,
  BookOpen,
  X,
  MapPin,
  Calculator,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const StockSummaryView: React.FC = () => {
  const { currentCompany, currentFiscalYear, inventoryItems, locations, setActiveTab, showNotification, refreshActiveData } = useApp();

  const [stockSummaries, setStockSummaries] = useState<ItemStockSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals
  const [addItemModalOpen, setAddItemModalOpen] = useState<boolean>(false);
  const [wastageModalOpen, setWastageModalOpen] = useState<boolean>(false);
  const [selectedItemForWastage, setSelectedItemForWastage] = useState<InventoryItem | null>(null);

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

  // New Item Form
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [primaryUnit, setPrimaryUnit] = useState<string>('SQFT');
  const [alternateUnit, setAlternateUnit] = useState<string>('PCS');
  const [conversionFactor, setConversionFactor] = useState<number>(4);
  const [openingQty, setOpeningQty] = useState<number | string>('');
  const [openingRate, setOpeningRate] = useState<number | string>('');
  const [openingAmount, setOpeningAmount] = useState<number | string>('');
  const lastEditedFieldRef = useRef<'qty' | 'rate' | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<number>(500);

  // Auto-calculation logic for Opening Stock
  // Formula: Qty × Rate = Amount
  // 1. Enter Rate & Amount -> Quantity auto-calculates (Amount / Rate), Rate preserved.
  // 2. Enter Quantity & Rate -> Amount auto-calculates (Qty × Rate), Qty & Rate preserved.
  // 3. Enter Quantity & Amount -> Rate auto-calculates (Amount / Qty), Qty preserved.
  const handleOpeningQtyChange = (val: string) => {
    setOpeningQty(val);
    lastEditedFieldRef.current = 'qty';

    if (val === '') return;

    const q = parseFloat(val);
    if (isNaN(q)) return;

    const r = parseFloat(String(openingRate));
    const a = parseFloat(String(openingAmount));
    const hasRate = !isNaN(r) && r > 0;
    const hasAmount = !isNaN(a) && a >= 0;

    if (hasRate) {
      setOpeningAmount(Number((q * r).toFixed(2)));
    } else if (hasAmount && q > 0) {
      setOpeningRate(Number((a / q).toFixed(2)));
    }
  };

  const handleOpeningRateChange = (val: string) => {
    setOpeningRate(val);
    lastEditedFieldRef.current = 'rate';

    if (val === '') return;

    const r = parseFloat(val);
    if (isNaN(r)) return;

    const q = parseFloat(String(openingQty));
    const a = parseFloat(String(openingAmount));
    const hasQty = !isNaN(q) && q > 0;
    const hasAmount = !isNaN(a) && a >= 0;

    if (hasQty) {
      setOpeningAmount(Number((q * r).toFixed(2)));
    } else if (hasAmount && r > 0) {
      setOpeningQty(Number((a / r).toFixed(3)));
    }
  };

  const handleOpeningAmountChange = (val: string) => {
    setOpeningAmount(val);

    if (val === '') return;

    const a = parseFloat(val);
    if (isNaN(a)) return;

    const q = parseFloat(String(openingQty));
    const r = parseFloat(String(openingRate));
    const hasQty = !isNaN(q) && q > 0;
    const hasRate = !isNaN(r) && r > 0;

    // If user previously modified Rate: keep Rate fixed, calculate Quantity!
    // If user previously modified Quantity: keep Quantity fixed, calculate Rate!
    if (lastEditedFieldRef.current === 'rate') {
      if (hasRate) {
        setOpeningQty(Number((a / r).toFixed(3)));
      } else if (hasQty) {
        setOpeningRate(Number((a / q).toFixed(2)));
      }
    } else if (lastEditedFieldRef.current === 'qty') {
      if (hasQty) {
        setOpeningRate(Number((a / q).toFixed(2)));
      } else if (hasRate) {
        setOpeningQty(Number((a / r).toFixed(3)));
      }
    } else {
      if (hasRate && !hasQty) {
        setOpeningQty(Number((a / r).toFixed(3)));
      } else if (hasQty && !hasRate) {
        setOpeningRate(Number((a / q).toFixed(2)));
      } else if (hasRate) {
        setOpeningQty(Number((a / r).toFixed(3)));
      }
    }
  };

  const loadStockData = async () => {
    setLoading(true);
    try {
      const data = await inventoryEngine.getStockSummary();
      setStockSummaries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, [currentCompany, currentFiscalYear]);

  const filteredSummaries = stockSummaries.filter((s) => {
    const matchesSearch =
      s.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item.primaryUnit.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalValuation = filteredSummaries.reduce((sum, s) => sum + s.closingValue, 0);
  const totalWastageQty = filteredSummaries.reduce((sum, s) => sum + s.wastageQty, 0);

  // Keyboard navigation for Stock Summary table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredSummaries.length,
    tableId: 'stock-summary-table',
    enabled: !addItemModalOpen && !wastageModalOpen && !confirmModal.isOpen,
  });

  const handleCreateItem = () => {
    if (!name.trim() || !code.trim()) {
      showNotification('Please enter Item Name and Code.', 'error');
      return;
    }
    if (!currentCompany) return;

    setConfirmModal({
      isOpen: true,
      type: 'ADD',
      title: 'Confirm Add Inventory Item',
      message: `Are you sure you want to register new inventory item "${name.trim()}" (${code.trim().toUpperCase()})?`,
      details: [
        { label: 'Item Name', value: name.trim() },
        { label: 'Item Code', value: code.trim().toUpperCase() },
        { label: 'Unit', value: `${primaryUnit} ${alternateUnit ? `(${alternateUnit})` : ''}` },
        { label: 'Opening Stock', value: `${openingQty || 0} ${primaryUnit} @ ₹${openingRate || 0} (Total: ₹${openingAmount || 0})` },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const now = new Date().toISOString();
          const chosenLoc = locations.find((l) => l.id === defaultLocationId);
          let opQty = parseFloat(String(openingQty)) || 0;
          let opRate = parseFloat(String(openingRate)) || 0;
          let opVal = parseFloat(String(openingAmount)) || 0;
          if (opQty === 0 && opRate > 0 && opVal > 0) {
            opQty = Math.round((opVal / opRate) * 1000) / 1000;
          }
          if (opRate === 0 && opQty > 0 && opVal > 0) {
            opRate = Math.round((opVal / opQty) * 100) / 100;
          }
          if (opVal === 0 && opQty > 0 && opRate > 0) {
            opVal = Math.round(opQty * opRate * 100) / 100;
          }
          const item: InventoryItem = {
            id: `item-${Date.now()}`,
            uuid: uuidv4(),
            companyId: currentCompany.id,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            primaryUnit,
            alternateUnit: alternateUnit.trim() || undefined,
            conversionFactor: Number(conversionFactor) || undefined,
            openingQuantity: opQty,
            openingQty: opQty,
            openingRate: opRate,
            openingValue: opVal,
            defaultLocationId: defaultLocationId || undefined,
            defaultGodown: chosenLoc ? chosenLoc.name : undefined,
            reorderLevel: Number(reorderLevel) || 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          await dbStorage.saveInventoryItem(item);
          await dbStorage.logAudit('CREATE', 'INVENTORY', item.id, `Created inventory item: ${item.name} (${item.code})`);
          showNotification(`Item "${item.name}" registered successfully.`, 'success');
          setAddItemModalOpen(false);
          // Reset form
          setName('');
          setCode('');
          setOpeningQty('');
          setOpeningRate('');
          setOpeningAmount('');
          lastEditedFieldRef.current = null;
          setDefaultLocationId('');
          await refreshActiveData();
          await loadStockData();
        } catch (err: any) {
          showNotification(err.message || 'Failed to create item.', 'error');
        }
      },
    });
  };

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Inventory Stock Valuation Summary',
      periodText: `Total Items: ${filteredSummaries.length} | Net Value: ₹${totalValuation.toLocaleString('en-IN')}`,
      columns: [
        { header: 'Item Code', dataKey: 'code' },
        { header: 'Item Name & Specs', dataKey: 'name' },
        { header: 'Opening Qty', dataKey: 'opening', align: 'right' },
        { header: 'Inward', dataKey: 'inward', align: 'right' },
        { header: 'Outward', dataKey: 'outward', align: 'right' },
        { header: 'Wastage', dataKey: 'wastage', align: 'right' },
        { header: 'Closing Stock', dataKey: 'closing', align: 'right' },
        { header: 'Alt Qty', dataKey: 'altQty', align: 'right' },
        { header: 'Rate (₹)', dataKey: 'rate', align: 'right' },
        { header: 'Value (₹)', dataKey: 'value', align: 'right' },
      ],
      data: filteredSummaries.map((s) => ({
        code: s.item.code,
        name: s.item.name,
        opening: `${s.openingQty} ${s.item.primaryUnit}`,
        inward: `${s.inwardQty}`,
        outward: `${s.outwardQty}`,
        wastage: `${s.wastageQty}`,
        closing: `${s.closingQty} ${s.item.primaryUnit}`,
        altQty: s.closingAltQty ? `${s.closingAltQty} ${s.item.alternateUnit}` : '-',
        rate: s.valuationRate.toFixed(2),
        value: s.closingValue,
      })),
      summaryRows: [
        {
          code: 'TOTAL',
          name: `${filteredSummaries.length} Inventory Items`,
          opening: '',
          inward: '',
          outward: '',
          wastage: `${totalWastageQty}`,
          closing: '',
          altQty: '',
          rate: '',
          value: totalValuation,
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Stock Summary Report',
      columns: [
        { header: 'Item Code', dataKey: 'code' },
        { header: 'Item Name', dataKey: 'name' },
        { header: 'Primary Unit', dataKey: 'unit' },
        { header: 'Opening Qty', dataKey: 'openingQty' },
        { header: 'Inward Qty (Purchases)', dataKey: 'inwardQty' },
        { header: 'Outward Qty (Sales)', dataKey: 'outwardQty' },
        { header: 'Wastage / Loss Qty', dataKey: 'wastageQty' },
        { header: 'Closing Stock Qty', dataKey: 'closingQty' },
        { header: 'Alternate Qty', dataKey: 'altQty' },
        { header: 'Valuation Rate (INR)', dataKey: 'rate' },
        { header: 'Closing Stock Valuation (INR)', dataKey: 'value' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: filteredSummaries.map((s) => ({
        code: s.item.code,
        name: s.item.name,
        unit: s.item.primaryUnit,
        openingQty: s.openingQty,
        inwardQty: s.inwardQty,
        outwardQty: s.outwardQty,
        wastageQty: s.wastageQty,
        closingQty: s.closingQty,
        altQty: s.closingAltQty ? `${s.closingAltQty} ${s.item.alternateUnit}` : '',
        rate: s.valuationRate,
        value: s.closingValue,
        status: s.status,
      })),
    });
  };

  return (
    <div className="space-y-2" id="stock_summary_view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] flex items-center justify-center text-[#2588E8] shadow-xs">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#FFFFFF] tracking-wide flex items-center gap-2">
              Inventory Stock Summary &amp; Multi-Unit Valuation
            </h1>
            <p className="text-[10.5px] text-[#7F98AE] hidden sm:block">
              Real-time stock valuation with dual unit conversions and wastage auditing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <PdfFileIcon className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => {
              setSelectedItemForWastage(null);
              setWastageModalOpen(true);
            }}
            className="flex items-center gap-1 bg-[#421d23] hover:bg-rose-900 text-[#fca5a5] px-2.5 py-1 rounded-lg border border-rose-800/50 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Scissors className="w-3 h-3" />
            Record Wastage
          </button>
          <button
            onClick={() => setAddItemModalOpen(true)}
            className="flex items-center gap-1 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Item
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase tracking-wider">Total Stock Valuation</div>
            <div className="text-base font-mono font-bold text-[#2588E8]">
              ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase tracking-wider">Total Items Listed</div>
            <div className="text-base font-mono font-bold text-[#FFFFFF]">
              {filteredSummaries.length} Products
            </div>
          </div>
        </div>
        <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase tracking-wider">Total Wastage</div>
            <div className="text-base font-mono font-bold text-[#fca5a5]">
              {totalWastageQty} Units
            </div>
          </div>
        </div>
        <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#7F98AE] font-bold uppercase tracking-wider">Reorder Alerts</div>
            <div className="text-base font-mono font-bold text-[#2588E8]">
              {filteredSummaries.filter((s) => s.status !== 'NORMAL').length} Items
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl text-xs shadow-sm">
        <div className="relative sm:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#7F98AE] absolute left-3 top-2" />
          <input
            type="text"
            placeholder="Search stone/item name, code, or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl pl-9 pr-3 py-1 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
          />
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="NORMAL">Normal / Sufficient Stock</option>
            <option value="LOW_STOCK">Low Stock (Reorder Needed)</option>
            <option value="OUT_OF_STOCK">Out of Stock (Zero / Negative)</option>
          </select>
        </div>
      </div>

      {/* Stock Summary Table */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] uppercase text-[10.5px] tracking-wider leading-tight">
              <tr>
                <th className="py-0.5 px-3">Code</th>
                <th className="py-0.5 px-3">Item Name &amp; Dimensions</th>
                <th className="py-0.5 px-3 text-right">Opening</th>
                <th className="py-0.5 px-3 text-right text-[#2588E8]">Inward (Pur)</th>
                <th className="py-0.5 px-3 text-right text-[#2588E8]">Outward (Sal)</th>
                <th className="py-0.5 px-3 text-right text-[#fca5a5]">Wastage</th>
                <th className="py-0.5 px-3 text-right font-bold text-[#FFFFFF]">Closing Stock</th>
                <th className="py-0.5 px-3 text-right text-[#2588E8]">Alt Unit Qty</th>
                <th className="py-0.5 px-3 text-right">Rate (₹)</th>
                <th className="py-0.5 px-3 text-right font-bold text-[#2588E8]">Valuation (₹)</th>
                <th className="py-0.5 px-3 text-center">Status</th>
                <th className="py-0.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[#7F98AE]">
                    No inventory items found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={s.item.id}
                      data-table-id="stock-summary-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition-colors cursor-pointer leading-tight ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(18,48,76,0.42)] backdrop-blur-xl'
                      }`}
                    >
                    <td className="py-1 px-3 font-mono font-bold text-[#2588E8] whitespace-nowrap text-xs">
                      {s.item.code}
                    </td>
                    <td className="py-1 px-3 font-medium text-[#FFFFFF] max-w-xs text-xs">
                      <div>{s.item.name}</div>
                      {s.item.alternateUnit && s.item.conversionFactor && (
                        <div className="text-[10px] text-[#7F98AE] font-mono">
                          1 {s.item.alternateUnit} = {s.item.conversionFactor} {s.item.primaryUnit}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-[#B7C9D9] text-xs">
                      {s.openingQty} {s.item.primaryUnit}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-[#2588E8] text-xs">
                      {s.inwardQty > 0 ? `+${s.inwardQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-[#2588E8] text-xs">
                      {s.outwardQty > 0 ? `-${s.outwardQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-[#fca5a5] text-xs">
                      {s.wastageQty > 0 ? `-${s.wastageQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      {s.closingQty} <span className="text-[10px] text-[#7F98AE]">{s.item.primaryUnit}</span>
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-semibold text-[#2588E8] text-xs">
                      {s.closingAltQty ? `${s.closingAltQty} ${s.item.alternateUnit}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-[#B7C9D9] text-xs">
                      ₹{s.valuationRate.toFixed(2)}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                      ₹{s.closingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-3 text-center">
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          s.status === 'NORMAL'
                            ? 'bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                            : s.status === 'LOW_STOCK'
                            ? 'bg-[#382b13] text-[#fde047] border border-amber-700/40'
                            : 'bg-[#421d23] text-[#fca5a5] border border-rose-800/40'
                        }`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedItemForWastage(s.item);
                            setWastageModalOpen(true);
                          }}
                          title="Record Breakage / Wastage"
                          className="p-1.5 rounded-lg bg-[#421d23] hover:bg-rose-900 text-[#fca5a5] border border-rose-800/40 transition cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveTab('stock_ledger')}
                          title="View Item Stock Ledger"
                          className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#2588E8] border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {filteredSummaries.length > 0 && (
              <tfoot className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF] font-bold border-t border-[rgba(112,185,245,0.25)]">
                <tr>
                  <td colSpan={9} className="py-3 px-3.5 text-right font-semibold">
                    Grand Closing Inventory Valuation:
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-[#2588E8] text-sm">
                    ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add New Item Modal */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-5 w-full max-w-lg space-y-4 text-xs text-[#FFFFFF] shadow-2xl">
            <div className="flex justify-between items-center border-b border-[rgba(112,185,245,0.25)] pb-3">
              <h3 className="font-bold text-[#FFFFFF] text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#2588E8]" />
                Add New Inventory Item
              </h3>
              <button onClick={() => setAddItemModalOpen(false)} className="text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Makrana Pure White Marble Slab"
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Item Code *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. MKR-001"
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] font-mono uppercase focus:outline-hidden focus:border-[#2588E8]"
                  />
                </div>
              </div>

              {/* Multi-Unit Definition */}
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2">
                <div className="text-[11px] font-bold text-[#2588E8] uppercase">Dual Unit of Measurement</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#7F98AE] mb-0.5">Primary Unit</label>
                    <select
                      value={primaryUnit}
                      onChange={(e) => setPrimaryUnit(e.target.value)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg p-1.5 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8]"
                    >
                      <option value="SQFT">SQFT (Square Feet)</option>
                      <option value="SQMT">SQMT (Square Metre)</option>
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="TON">TON (Metric Tonnes)</option>
                      <option value="KG">KG (Kilograms)</option>
                      <option value="BOX">BOX (Boxes)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7F98AE] mb-0.5">Alternate Unit</label>
                    <input
                      type="text"
                      value={alternateUnit}
                      onChange={(e) => setAlternateUnit(e.target.value)}
                      placeholder="e.g. PCS or SLAB"
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg p-1.5 text-[#FFFFFF] uppercase focus:outline-hidden focus:border-[#2588E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7F98AE] mb-0.5">Conversion Factor</label>
                    <input
                      type="number"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg p-1.5 text-[#FFFFFF] font-mono focus:outline-hidden focus:border-[#2588E8]"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[#7F98AE] italic">
                  Rule: 1 {alternateUnit || 'Alt Unit'} = {conversionFactor} {primaryUnit}
                </div>
              </div>

              {/* Opening Stock, Rate & Amount */}
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-bold text-[#FFFFFF] flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-[#2588E8]" />
                  <span>Opening Stock &amp; Valuation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1">
                      Opening Qty ({primaryUnit})
                    </label>
                    <input
                      id="stock_summary_opening_qty"
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={openingQty}
                      onChange={(e) => handleOpeningQtyChange(e.target.value)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg p-2 text-xs text-[#FFFFFF] font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                    />
                    {alternateUnit && conversionFactor > 0 && Number(openingQty) > 0 && (
                      <div className="mt-1 text-[10px] text-[#2588E8] font-mono">
                        ≈ {(Number(openingQty) / conversionFactor).toFixed(2)} {alternateUnit}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1">
                      Cost Rate (₹ per {primaryUnit})
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-mono text-[#7F98AE]">₹</span>
                      <input
                        id="stock_summary_opening_rate"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={openingRate}
                        onChange={(e) => handleOpeningRateChange(e.target.value)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-6 pr-2 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1">
                      Total Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-mono text-[#7F98AE]">₹</span>
                      <input
                        id="stock_summary_opening_amount"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={openingAmount}
                        onChange={(e) => handleOpeningAmountChange(e.target.value)}
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-6 pr-2 py-2 text-xs font-mono font-bold text-[#2588E8] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1">Reorder Level ({primaryUnit})</label>
                <input
                  type="number"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] font-mono text-xs focus:outline-hidden focus:border-[#2588E8]"
                />
              </div>

              {/* Default Storage Godown */}
              <div>
                <label className="block text-[11px] font-bold text-[#7F98AE] uppercase mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#2588E8]" />
                  Default Storage Godown / Location
                </label>
                <select
                  value={defaultLocationId}
                  onChange={(e) => setDefaultLocationId(e.target.value)}
                  className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-2 text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8]"
                >
                  <option value="">-- No Specific Godown --</option>
                  {locations.filter((l) => l.isActive).map((loc) => (
                    <option key={loc.id} value={loc.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                      {loc.name} ({loc.code}) - {loc.type}{loc.isDefault ? ' ★ (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[rgba(112,185,245,0.25)]">
              <button
                onClick={() => setAddItemModalOpen(false)}
                className="bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-4 py-2 rounded-xl text-xs font-semibold border border-[rgba(112,185,245,0.25)] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                className="bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md text-xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Inventory Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wastage Modal */}
      {wastageModalOpen && (
        <WastageRecordModal
          item={selectedItemForWastage}
          onClose={() => setWastageModalOpen(false)}
          onSuccess={() => {
            loadStockData();
            refreshActiveData();
          }}
        />
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
