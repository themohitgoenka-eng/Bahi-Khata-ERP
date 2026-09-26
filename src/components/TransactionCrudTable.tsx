import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Download, Printer, Edit2, Trash2,
  FileText, Calendar, ArrowUpDown, ChevronRight, X,
  CheckCircle2, Clock, AlertTriangle, Check, AlertCircle, MoreVertical, MapPin, Package,
  Truck, Receipt, Phone, Scale, ChevronDown, ChevronUp, Layers, ExternalLink
} from 'lucide-react';
import { db, TransactionRecord } from '../db';
import { PartySelectDropdown } from './PartySelectDropdown';
import { DateInputDDMMYYYY } from './DateInputDDMMYYYY';
import { formatDateDisplay } from '../utils/dateUtils';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import { useApp } from '../context/AppContext';
import { ExportEngine } from '../services/exportEngine';
import { PdfFileIcon, ExcelFileIcon } from './common/DocumentIcons';
import { Company, FiscalYear } from '../types';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';

export interface TransactionCrudTableProps {
  formType: 'sales_quotation' | 'sales_challan' | 'sales_invoice' | string;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}

export const TransactionCrudTable: React.FC<TransactionCrudTableProps> = ({
  formType,
  title,
  subtitle,
  icon,
}) => {
  const { showNotification, inventoryItems, currentCompany, currentFiscalYear, locations, minimizedInvoice } = useApp();
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [openInPrintView, setOpenInPrintView] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<{
    record: TransactionRecord;
    top: number;
    left: number;
  } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<TransactionRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Close floating options menu on scroll, resize or click outside
  useEffect(() => {
    if (!activeActionMenu) return;
    const handleClose = () => setActiveActionMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeActionMenu]);

  // Form State for Quotation / Challan
  const initialFormState = {
    refNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    amount: 0,
    secondaryVal: 0,
    extra1: '',
    status: formType === 'sales_quotation' ? 'Draft' : 'Dispatched',
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Load records from db
  const loadRecords = async () => {
    setLoading(true);
    try {
      const all = await db.transactions.where('formType').equals(formType).toArray();
      // Sort newest first
      all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(all);
    } catch (err) {
      console.error('Error loading records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [formType, inventoryItems]);

  useEffect(() => {
    const handleMasterUpdate = () => {
      loadRecords();
    };
    window.addEventListener('master-updated', handleMasterUpdate);
    return () => window.removeEventListener('master-updated', handleMasterUpdate);
  }, [formType]);

  // Helper to determine decimal places for record from its items matched in Item Master
  const getRecordDecimals = useCallback(
    (rec: TransactionRecord): number => {
      if (rec.notes) {
        try {
          const parsed = JSON.parse(rec.notes);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            const decList: number[] = [];
            for (const it of parsed.items) {
              if (!it.item && !it.itemId) continue;
              const cleanItemName = String(it.item || '').trim().toLowerCase();
              const found = inventoryItems.find(
                (m) =>
                  (it.itemId && m.id === it.itemId) ||
                  (cleanItemName && m.name.trim().toLowerCase() === cleanItemName) ||
                  (cleanItemName && m.code && m.code.trim().toLowerCase() === cleanItemName) ||
                  (cleanItemName && m.name.trim().toLowerCase().includes(cleanItemName)) ||
                  (cleanItemName && cleanItemName.includes(m.name.trim().toLowerCase()))
              );
              if (
                found &&
                found.decimalPlaces !== undefined &&
                found.decimalPlaces !== null &&
                found.decimalPlaces !== '' &&
                !isNaN(Number(found.decimalPlaces))
              ) {
                decList.push(Number(found.decimalPlaces));
              }
            }
            if (decList.length > 0) {
              return Math.max(...decList);
            }
          }
        } catch {}
      }
      return 2;
    },
    [inventoryItems]
  );

  // Generate next automatic reference number
  const nextRefNo = useMemo(() => {
    const prefix =
      formType === 'sales_quotation' ? 'QT-2026-' :
      formType === 'sales_challan' ? 'DC-2026-' :
      formType === 'spare_parts_purchase' ? 'SP-PUR-' :
      formType === 'purchase_invoice' ? 'PUR-2026-' : 'INV-2026-';
    const count = records.length + 1;
    return `${prefix}${String(count).padStart(3, '0')}`;
  }, [formType, records]);


  // Handle open modal for create
  const handleOpenCreate = () => {
    setOpenInPrintView(false);
    if (formType === 'sales_invoice' || formType === 'purchase_invoice' || formType === 'spare_parts_purchase') {
      setSelectedRecord(null);
      setIsInvoiceModalOpen(true);
    } else {
      setSelectedRecord(null);
      setFormData({
        ...initialFormState,
        refNo: nextRefNo,
        status: formType === 'sales_quotation' ? 'Draft' : 'Dispatched',
      });
      setIsModalOpen(true);
    }
  };

  // Handle open modal for edit
  const handleOpenEdit = (rec: TransactionRecord) => {
    setSelectedRecord(rec);
    setOpenInPrintView(false);
    if (formType === 'sales_invoice' || formType === 'purchase_invoice' || formType === 'spare_parts_purchase') {
      setIsInvoiceModalOpen(true);
    } else {
      setFormData({
        refNo: rec.refNo,
        date: rec.date,
        partyName: rec.partyName,
        amount: rec.amount,
        secondaryVal: rec.secondaryVal || 0,
        extra1: rec.extra1 || '',
        status: rec.status || (formType === 'sales_quotation' ? 'Draft' : 'Dispatched'),
        notes: rec.notes || '',
      });
      setIsModalOpen(true);
    }
  };

  // Handle open modal directly in Print View
  const handleOpenPrintView = (rec: TransactionRecord) => {
    setSelectedRecord(rec);
    setOpenInPrintView(true);
    setIsInvoiceModalOpen(true);
    setActiveActionMenu(null);
  };

  // Helper to suppress serialized internal invoice JSON from rendering in table
  const isInternalJsonNotes = (notes?: string) => {
    if (!notes) return false;
    const trimmed = notes.trim();
    if (trimmed.startsWith('{') && (trimmed.includes('"formType"') || trimmed.includes('"series"') || trimmed.includes('"location"'))) {
      return true;
    }
    return false;
  };

  // Helper to extract location for record
  const getRecordLocation = useCallback((rec: TransactionRecord): string => {
    if (rec.notes) {
      try {
        const parsed = JSON.parse(rec.notes);
        if (parsed?.location && typeof parsed.location === 'string' && parsed.location.trim()) {
          return parsed.location.trim();
        }
      } catch {}
    }
    const def = locations?.find((l) => l.isDefault)?.name || locations?.[0]?.name;
    return def || 'Main Godown';
  }, [locations]);

  // Helper to extract item summary for record
  const getRecordItemsSummary = (rec: TransactionRecord) => {
    if (rec.notes) {
      try {
        const parsed = JSON.parse(rec.notes);
        if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
          const validItems = parsed.items
            .map((it: any) => String(it.item || it.name || '').trim())
            .filter(Boolean);
          if (validItems.length > 0) {
            if (validItems.length === 1) {
              return {
                primary: validItems[0],
                count: 1,
                tooltip: validItems[0],
                extraText: '',
              };
            }
            return {
              primary: validItems[0],
              count: validItems.length,
              tooltip: validItems.join(', '),
              extraText: `+${validItems.length - 1} more`,
            };
          }
        }
      } catch {}
    }
    if (rec.notes && !isInternalJsonNotes(rec.notes)) {
      return { primary: rec.notes, count: 1, tooltip: rec.notes, extraText: '' };
    }
    return { primary: '-', count: 0, tooltip: '-', extraText: '' };
  };

  // Helper component for expanded row slide-down details
  const renderExpandedRowDetails = (rec: TransactionRecord) => {
    let parsed: any = null;
    if (rec.notes) {
      try {
        parsed = JSON.parse(rec.notes);
      } catch {
        parsed = null;
      }
    }

    const rawItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    // Strictly filter out blank/empty item rows so they are never displayed
    const items = rawItems.filter((r) => {
      if (!r) return false;
      const hasItem = Boolean(r.item && String(r.item).trim());
      const hasRef = Boolean(r.reference && String(r.reference).trim());
      const hasDesc = Boolean(r.description && String(r.description).trim());
      const hasLedger = Boolean((r.ledger || r.salesAc) && String(r.ledger || r.salesAc).trim());
      const hasQty = r.qty !== undefined && r.qty !== null && String(r.qty).trim() !== "" && Number(String(r.qty).replace(/,/g, "")) !== 0;
      const hasPcs = r.pcs !== undefined && r.pcs !== null && String(r.pcs).trim() !== "" && Number(String(r.pcs).replace(/,/g, "")) !== 0;
      const hasRate = r.rate !== undefined && r.rate !== null && String(r.rate).trim() !== "" && Number(String(r.rate).replace(/,/g, "")) !== 0;
      const hasAmount = r.amount !== undefined && r.amount !== null && String(r.amount).trim() !== "" && Number(String(r.amount).replace(/,/g, "")) !== 0;
      return hasItem || hasRef || hasDesc || hasLedger || hasQty || hasPcs || hasRate || hasAmount;
    });

    const billSundries: any[] = Array.isArray(parsed?.billSundries) ? parsed.billSundries : [];

    const vehicle = parsed?.truck || rec.extra1 || '';
    const destination = parsed?.destination || '';
    const weight = parsed?.weight || '';
    const fare = parsed?.fare;
    const advance = parsed?.advance;
    const mobile = parsed?.mobile || '';
    const pakka = rec.pakka || parsed?.pakka;
    const kacha = rec.kacha || parsed?.kacha;
    const defaultLedger = parsed?.salesAc || '';

    // Calculate items summary
    const totalPcs = items.reduce((acc, it) => acc + (Number(String(it.pcs || 0).replace(/,/g, '')) || 0), 0);
    const totalQty = items.reduce((acc, it) => acc + (Number(String(it.qty || 0).replace(/,/g, '')) || 0), 0);
    const itemsSubtotal = items.reduce((acc, it) => acc + (Number(String(it.amount || 0).replace(/,/g, '')) || 0), 0);

    // Sundries net
    const netSundries = billSundries.reduce((acc, bs) => {
      const amt = Number(String(bs.amount || 0).replace(/,/g, '')) || 0;
      if (bs.type === 'SUBTRACT') return acc - amt;
      return acc + amt;
    }, 0);

    const dec = getRecordDecimals(rec);

    return (
      <div className="w-full px-5 py-5 bg-[#05101C] border-t border-b border-[rgba(112,185,245,0.25)] text-sm text-[#FFFFFF] space-y-4 min-h-[220px]">
        {/* 1. Despatch Details - Inline Strip (Sequence matching Sale Bill Form: Pakka, Kacha, Weight, Fare, Truck No., Mobile No., Advance, Delivery) */}
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2 py-3 px-4 bg-[#07182B] rounded-xl border border-[rgba(112,185,245,0.25)] text-[13.5px] min-h-[48px] shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[#F2C94C] uppercase tracking-wider text-xs shrink-0 mr-1.5">
            <Truck className="w-4.5 h-4.5 text-[#F2C94C]" />
            <span>Despatch Detail:</span>
          </div>

          {/* 1. Pakka */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Pakka:</span>
            <span className="font-mono font-bold text-[#2588E8]">
              {(() => {
                if (!pakka || String(pakka).trim() === '') return '-';
                const str = String(pakka).trim();
                if (str.includes('%')) return str;
                const num = Number(str.replace(/,/g, ''));
                if (isNaN(num) || num === 0) return '-';
                return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              })()}
            </span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 2. Kacha */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Kacha:</span>
            <span className="font-mono font-bold text-[#F2C94C]">
              {(() => {
                if (!kacha || String(kacha).trim() === '') return '-';
                const str = String(kacha).trim();
                if (str.includes('%')) return str;
                const num = Number(str.replace(/,/g, ''));
                if (isNaN(num) || num === 0) return '-';
                return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              })()}
            </span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 3. Weight */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Weight:</span>
            <span className="font-mono text-[#FFFFFF]">
              {(() => {
                if (!weight) return '-';
                const str = String(weight).trim();
                if (str === '' || str === '-' || str.toLowerCase() === 'nan') return '-';
                const lower = str.toLowerCase();
                if (lower.includes('ton') || lower.includes('mt') || lower.includes('kg')) {
                  return str;
                }
                return `${str} Ton`;
              })()}
            </span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 4. Fare */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Fare:</span>
            <span className="font-mono text-[#2588E8]">
              {(() => {
                if (fare === undefined || fare === null) return '-';
                const str = String(fare).trim();
                if (
                  str === '' ||
                  str === '-' ||
                  str.toLowerCase() === 'nan' ||
                  str.toLowerCase() === 'null' ||
                  str.toLowerCase() === 'undefined' ||
                  str.toLowerCase() === 'nil' ||
                  str.toLowerCase() === 'na' ||
                  str.toLowerCase() === 'n/a'
                ) {
                  return '-';
                }
                const clean = str.replace(/[₹,\s]/g, '');
                const num = Number(clean);
                if (isNaN(num)) {
                  return clean.toLowerCase() === 'nan' ? '-' : str;
                }
                return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/Ton`;
              })()}
            </span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 5. Truck No. */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">{formType === 'spare_parts_purchase' ? 'Machine:' : 'Truck No:'}</span>
            <span className="font-mono font-semibold text-[#FFFFFF]">{vehicle || '-'}</span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 6. Mobile No. */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Mobile:</span>
            <span className="font-mono text-[#FFFFFF]">{mobile || '-'}</span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 7. Advance */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Advance:</span>
            <span className="font-mono text-[#F2C94C]">
              {(() => {
                if (advance === undefined || advance === null) return '-';
                const str = String(advance).trim();
                if (
                  str === '' ||
                  str === '-' ||
                  str.toLowerCase() === 'nan' ||
                  str.toLowerCase() === 'null' ||
                  str.toLowerCase() === 'undefined' ||
                  str.toLowerCase() === 'nil' ||
                  str.toLowerCase() === 'na' ||
                  str.toLowerCase() === 'n/a'
                ) {
                  return '-';
                }
                const clean = str.replace(/[₹,\s]/g, '');
                const num = Number(clean);
                if (isNaN(num)) {
                  return clean.toLowerCase() === 'nan' ? '-' : str;
                }
                return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              })()}
            </span>
          </div>
          <span className="text-[rgba(112,185,245,0.2)]">•</span>

          {/* 8. Delivery */}
          <div className="flex items-center gap-1">
            <span className="text-[#7F98AE]">Delivery:</span>
            <span className="text-[#FFFFFF]">{destination || '-'}</span>
          </div>
        </div>

        {/* 2. Items Description Table (Expanded Detail) */}
        {items.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-[rgba(112,185,245,0.25)] bg-[#07182B]/70">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#7F98AE] text-[10.5px] uppercase font-mono tracking-wider border-b border-[rgba(112,185,245,0.25)] leading-tight">
                  <th className="py-0.5 px-3 text-center w-12 whitespace-nowrap">#</th>
                  <th className="py-0.5 px-3 min-w-[220px]">Item Description</th>
                  <th className="py-0.5 px-3 min-w-[160px]">Ledger</th>
                  <th className="py-0.5 px-3 min-w-[120px] whitespace-nowrap">Reference</th>
                  <th className="py-0.5 px-3 text-right min-w-[90px] whitespace-nowrap">Pcs</th>
                  <th className="py-0.5 px-3 text-right min-w-[100px] whitespace-nowrap">Quantity</th>
                  <th className="py-0.5 px-3 text-center min-w-[70px] whitespace-nowrap">Unit</th>
                  <th className="py-0.5 px-3 text-right min-w-[100px] whitespace-nowrap">Rate (₹)</th>
                  <th className="py-0.5 px-3 text-right min-w-[110px] whitespace-nowrap">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40 bg-[#05101C]/70">
                {items.map((it, idx) => {
                  const itPcs = it.pcs !== undefined && it.pcs !== null && it.pcs !== '' ? Number(String(it.pcs).replace(/,/g, '')) : null;
                  const itQty = Number(String(it.qty || 0).replace(/,/g, '')) || 0;
                  const itRate = Number(String(it.rate || 0).replace(/,/g, '')) || 0;
                  const itAmt = Number(String(it.amount || 0).replace(/,/g, '')) || 0;
                  const itemLedger = it.ledger || it.salesAc || defaultLedger || '-';

                  return (
                    <tr key={it.id || idx} className="hover:bg-[rgba(57,167,255,0.06)] transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-[#7F98AE] text-[13.5px] whitespace-nowrap">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#FFFFFF] min-w-[220px]">
                        <div className="text-[14px] leading-snug">{it.item || it.name || '-'}</div>
                        {it.description && (
                          <div className="text-xs text-[#7F98AE] font-normal mt-0.5">{it.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#F1F7FC] text-[13.5px] min-w-[160px]">
                        <span className="block" title={itemLedger}>
                          {itemLedger}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#B7C9D9] text-[13px] whitespace-nowrap min-w-[120px]">
                        {it.reference ? (
                          <span className="px-2 py-1 rounded bg-[#0D2B4A] text-xs text-[#F1F7FC] border border-[rgba(112,185,245,0.25)] whitespace-nowrap font-medium">
                            {it.reference}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#B7C9D9] whitespace-nowrap min-w-[90px]">
                        {itPcs !== null && !isNaN(itPcs) ? itPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#FFFFFF] whitespace-nowrap min-w-[100px]">
                        {itQty.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs uppercase text-[#7F98AE] whitespace-nowrap min-w-[70px]">
                        {it.unit || (formType === 'sales_challan' ? 'PCS' : 'SQFT')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#B7C9D9] whitespace-nowrap min-w-[100px]">
                        {itRate > 0 ? `₹${itRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#2588E8] whitespace-nowrap min-w-[110px]">
                        ₹{itAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] font-mono font-bold text-xs">
                  <td colSpan={4} className="py-1 px-3 text-right uppercase tracking-wider text-[#7F98AE]">
                    Subtotal:
                  </td>
                  <td className="py-1 px-3 text-right text-[#B7C9D9]">
                    {totalPcs > 0 ? totalPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="py-1 px-3 text-right text-[#FFFFFF]">
                    {totalQty.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="py-1 px-3 text-right text-[#2588E8]">
                    ₹{itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-4.5 px-4 rounded-xl bg-[#07182B]/70 border border-[rgba(112,185,245,0.25)] text-center text-[#7F98AE] text-sm">
            No line items recorded for this bill.
          </div>
        )}

        {/* 3. Bill Sundries & Totals - Inline Line Bar (Aligned in the same line) */}
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2 py-3 px-4.5 bg-[#07182B] rounded-xl border border-[rgba(112,185,245,0.25)] text-[13.5px] min-h-[48px] shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[#2588E8] uppercase tracking-wider text-xs shrink-0 mr-1">
            <Receipt className="w-4.5 h-4.5 text-[#2588E8]" />
            <span>Bill Sundry:</span>
          </div>
          {billSundries.length > 0 ? (
            billSundries.map((bs, bIdx) => {
              const bsAmt = Number(String(bs.amount || 0).replace(/,/g, '')) || 0;
              const isSub = bs.type === 'SUBTRACT';
              return (
                <span key={bIdx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#09213A] border border-[rgba(112,185,245,0.25)] font-mono text-[13px]">
                  <span className="text-[#F1F7FC] font-medium">{bs.name || 'Sundry'}</span>
                  {bs.rate !== undefined && bs.rate !== null && bs.rate !== '' && (
                    <span className="text-[#7F98AE]">({bs.rate}%)</span>
                  )}
                  <span className={isSub ? 'text-[#FF647C] font-bold' : 'text-[#2588E8] font-bold'}>
                    {isSub ? '-' : '+'}₹{bsAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              );
            })
          ) : (
            <span className="text-[#7F98AE] italic text-xs">None</span>
          )}

          {billSundries.length > 0 && <span className="text-[rgba(112,185,245,0.25)]">•</span>}

          {/* Sundry Net */}
          {billSundries.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-[13px]">
              <span className="text-[#7F98AE]">Sundry Net:</span>
              <span className={netSundries < 0 ? 'text-[#FF647C] font-bold' : 'text-[#2588E8] font-bold'}>
                {netSundries < 0 ? '-' : '+'}₹{Math.abs(netSundries).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <span className="text-[rgba(112,185,245,0.25)]">•</span>

          {/* Net Total */}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-[#7F98AE]">Net Total:</span>
            <span className="text-[#2588E8] font-bold text-base">
              {formType === 'sales_challan'
                ? `${Number(rec.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })} SQFT`
                : `₹${Number(rec.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Handle direct PDF & Excel export for a transaction row
  const handleDirectExport = async (rec: TransactionRecord, exportType: 'pdf' | 'excel') => {
    try {
      let parsedNotes: any = null;
      if (rec.notes) {
        try {
          parsedNotes = JSON.parse(rec.notes);
        } catch {
          parsedNotes = null;
        }
      }

      const company: Company = currentCompany || {
        id: 'comp-1',
        name: 'Bahi Khata ERP',
        address: 'RIICO Industrial Area, Phase II',
        city: 'Kishangarh',
        state: 'Rajasthan',
        pincode: '305801',
        phone: '+91 98290 12345',
        email: 'info@bahikhataerp.com',
        gstin: '08AAAAA0000A1Z5',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const fiscalYear: FiscalYear = currentFiscalYear || {
        id: 'fy-2026-2027',
        name: '2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isClosed: false,
        isCurrent: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isSpareParts = formType === 'spare_parts_purchase';
      const isChallan = formType === 'sales_challan';
      const isQuotation = formType === 'sales_quotation';
      const docTitle = isSpareParts
        ? 'Spare Parts Purchase Bill'
        : isChallan
        ? 'Delivery Challan'
        : isQuotation
        ? 'Sales Quotation'
        : 'Tax Invoice';

      const parseNum = (v: any) => {
        if (v === undefined || v === null || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
      };

      const rawItems = Array.isArray(parsedNotes?.items) && parsedNotes.items.length > 0
        ? parsedNotes.items
        : [
            {
              item: rec.partyName ? `Material / Goods (${rec.partyName})` : 'Goods & Material',
              reference: rec.extra1 || '-',
              qty: rec.secondaryVal || 1,
              unit: isChallan ? 'PCS' : isSpareParts ? 'NOS' : 'SQFT',
              pcs: isChallan ? rec.secondaryVal : '-',
              rate: rec.secondaryVal ? (rec.amount / rec.secondaryVal).toFixed(2) : rec.amount.toFixed(2),
              amount: rec.amount.toFixed(2),
            },
          ];

      const columns = [
        { header: 'S.No', dataKey: 'sno', align: 'center' as const },
        { header: 'Description / Item Name', dataKey: 'item', align: 'left' as const },
        { header: 'Ref / Brand', dataKey: 'ref', align: 'left' as const },
        { header: 'Qty', dataKey: 'qty', align: 'right' as const },
        { header: 'Unit', dataKey: 'unit', align: 'center' as const },
        { header: 'Pcs', dataKey: 'pcs', align: 'right' as const },
        { header: 'Rate (₹)', dataKey: 'rate', align: 'right' as const },
        { header: 'Amount (₹)', dataKey: 'amount', align: 'right' as const },
      ];

      const data = rawItems.map((it: any, idx: number) => ({
        sno: idx + 1,
        item: it.item || 'Item',
        ref: it.reference || '-',
        qty: parseNum(it.qty).toFixed(2),
        unit: it.unit || (isChallan ? 'PCS' : 'SQFT'),
        pcs: it.pcs ? parseNum(it.pcs).toFixed(2) : '-',
        rate: parseNum(it.rate).toFixed(2),
        amount: parseNum(it.amount).toFixed(2),
      }));

      const totalQty = rawItems.reduce((acc: number, curr: any) => acc + parseNum(curr.qty), 0);
      const totalPcs = rawItems.reduce((acc: number, curr: any) => acc + parseNum(curr.pcs), 0);
      const subTotal = rawItems.reduce((acc: number, curr: any) => acc + parseNum(curr.amount), 0);

      const summaryRows: Record<string, any>[] = [
        {
          sno: '',
          item: 'ITEM SUB-TOTAL',
          ref: '',
          qty: totalQty.toFixed(2),
          unit: '',
          pcs: totalPcs > 0 ? totalPcs.toFixed(2) : '-',
          rate: '',
          amount: subTotal.toFixed(2),
        },
      ];

      if (Array.isArray(parsedNotes?.billSundries)) {
        parsedNotes.billSundries.forEach((s: any) => {
          const amt = parseNum(s.amount);
          if (amt !== 0) {
            summaryRows.push({
              sno: '',
              item: `${s.name} (${s.type})`,
              ref: '',
              qty: '',
              unit: '',
              pcs: '',
              rate: '',
              amount: (s.type === 'SUBTRACT' ? -amt : amt).toFixed(2),
            });
          }
        });
      }

      const grandTotal = parsedNotes?.totalAmount !== undefined ? parseNum(parsedNotes.totalAmount) : rec.amount;
      summaryRows.push({
        sno: '',
        item: 'GRAND TOTAL (₹)',
        ref: '',
        qty: '',
        unit: '',
        pcs: '',
        rate: '',
        amount: grandTotal.toFixed(2),
      });

      const cleanRefNo = (rec.refNo || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateFormatted = formatDateDisplay(rec.date);

      const exportOptions = {
        company,
        fiscalYear,
        reportTitle: `${docTitle} (${rec.refNo || 'Draft'})`,
        subtitle: `Party: ${rec.partyName || 'Cash / Counter'} | Date: ${dateFormatted} | Vehicle: ${rec.extra1 || 'N/A'}`,
        periodText: `Dated: ${dateFormatted}`,
        columns,
        data,
        summaryRows,
        customFilename: `${cleanRefNo}_${dateFormatted.replace(/\//g, '-')}`,
      };

      if (exportType === 'pdf') {
        const res = await ExportEngine.exportToPdf(exportOptions);
        if (res && res.saved) {
          showNotification(`PDF downloaded: ${res.filename}`, 'success');
        }
      } else {
        const res = await ExportEngine.exportToExcel(exportOptions);
        if (res && res.saved) {
          showNotification(`Excel file downloaded: ${res.filename}`, 'success');
        }
      }
    } catch (err) {
      console.error('Direct export error:', err);
      showNotification(`Failed to export ${exportType.toUpperCase()}`, 'error');
    }
  };

  // Handle Delete
  const handleDelete = async (id?: number | string) => {
    if (!id) return;
    try {
      await db.transactions.delete(id);
      showNotification('Record deleted successfully', 'info');
      loadRecords();
    } catch (err) {
      console.error('Delete error:', err);
      showNotification('Failed to delete record', 'error');
    }
  };

  // Handle Save for Quotation / Challan
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.partyName || !formData.partyName.trim()) {
      setFormError('Please select or enter a Customer / Recipient Name');
      showNotification('Customer / Recipient is required', 'error');
      return;
    }

    if (!formData.refNo || !formData.refNo.trim()) {
      setFormError('Reference number is required');
      showNotification('Reference number is required', 'error');
      return;
    }

    const payload: TransactionRecord = {
      formType,
      refNo: formData.refNo.trim(),
      partyName: formData.partyName.trim(),
      date: formData.date,
      amount: Number(formData.amount) || 0,
      secondaryVal: Number(formData.secondaryVal) || 0,
      extra1: formData.extra1,
      status: formData.status,
      notes: formData.notes,
      createdAt: selectedRecord?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    try {
      if (selectedRecord?.id) {
        await db.transactions.put({ ...payload, id: selectedRecord.id });
      } else {
        await db.transactions.add(payload);
      }

      setIsModalOpen(false);
      setSelectedRecord(null);
      showNotification(
        `${formType === 'sales_quotation' ? 'Quotation' : 'Challan'} ${payload.refNo} saved successfully!`,
        'success'
      );
      loadRecords();
    } catch (err) {
      console.error('Save error:', err);
      setFormError('Failed to save record. Please check fields.');
      showNotification('Failed to save record', 'error');
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      let parsed: any = null;
      if (r.notes) {
        try {
          parsed = JSON.parse(r.notes);
        } catch {}
      }
      const loc = (parsed?.location || '').toLowerCase();
      const items = Array.isArray(parsed?.items)
        ? parsed.items.map((it: any) => String(it.item || it.name || '')).join(' ').toLowerCase()
        : '';
      const plainNotes = (!isInternalJsonNotes(r.notes) ? (r.notes || '') : '').toLowerCase();

      return (
        r.refNo.toLowerCase().includes(term) ||
        r.partyName.toLowerCase().includes(term) ||
        loc.includes(term) ||
        items.includes(term) ||
        plainNotes.includes(term)
      );
    });
  }, [records, searchTerm]);

  // Aggregate Totals
  const totalAmount = useMemo(() => filteredRecords.reduce((acc, r) => acc + (r.amount || 0), 0), [filteredRecords]);
  const totalSecondary = useMemo(() => filteredRecords.reduce((acc, r) => acc + (r.secondaryVal || 0), 0), [filteredRecords]);

  // Keyboard navigation for CRUD records table
  const { selectedIndex, setSelectedIndex, getRowProps } = useTableKeyboardNavigation({
    totalRows: filteredRecords.length,
    tableId: 'transaction-crud-table',
    enabled: !isModalOpen && !isInvoiceModalOpen,
    onEnter: (idx) => {
      const rec = filteredRecords[idx];
      if (rec) {
        setExpandedRowId((prev) => (prev === rec.id ? null : (rec.id ?? null)));
      }
    },
  });

  return (
    <div className="space-y-2 w-full">
      {/* Top Header & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] text-[#2588E8]">
            {icon || <FileText className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#FFFFFF] uppercase tracking-wider">{title}</h1>
            <p className="text-[11px] text-[#B7C9D9] hidden sm:block">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-3 py-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-[#2588E8]/20 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {formType === 'sales_quotation' ? 'New Quotation' :
               formType === 'sales_challan' ? 'New Challan' :
               formType === 'spare_parts_purchase' ? 'New Spare Parts Purchase' :
               formType === 'purchase_invoice' ? 'New Purchase Bill' : 'New Invoice'}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="text-[10px] uppercase font-bold text-[#7F98AE] tracking-wider">Total Records</div>
          <div className="text-base font-bold font-mono text-[#FFFFFF]">{filteredRecords.length}</div>
        </div>
        <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="text-[10px] uppercase font-bold text-[#7F98AE] tracking-wider">
            {formType === 'sales_quotation' ? 'Total Quotation (₹)' :
             formType === 'sales_challan' ? 'Total Net Sqft' :
             formType === 'spare_parts_purchase' || formType === 'purchase_invoice' ? 'Total Purchases (₹)' : 'Total Billing (₹)'}
          </div>
          <div className="text-base font-bold font-mono text-[#2588E8]">
            {formType === 'sales_challan'
              ? `${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SQFT`
              : `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
        <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="text-[10px] uppercase font-bold text-[#7F98AE] tracking-wider">
            {formType === 'sales_quotation' ? 'Total Sqft' :
             formType === 'sales_challan' ? 'Total Slabs Count' :
             formType === 'spare_parts_purchase' ? 'Total Items / Qty' :
             formType === 'purchase_invoice' ? 'Total Sqft Purchased' : 'Total Sqft Billed'}
          </div>
          <div className="text-base font-bold font-mono text-[#2588E8]">
            {totalSecondary.toLocaleString('en-IN', { minimumFractionDigits: formType === 'sales_challan' ? 2 : 2, maximumFractionDigits: formType === 'sales_challan' ? 2 : 2 })} {formType === 'sales_challan' ? 'Pcs' : formType === 'spare_parts_purchase' ? 'Items' : 'Sqft'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl/75 border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#7F98AE] absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search bill no, party, item, location..."
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-8 pr-7 py-1 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:border-[#2588E8] focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1.5 text-[#7F98AE] hover:text-[#FFFFFF] cursor-pointer text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-[#7F98AE] font-mono">
          Showing <span className="text-[#2588E8] font-bold">{filteredRecords.length}</span> of {records.length} records
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[rgba(13,38,62,0.58)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* 2. THEAD: Define exact column widths */}
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-mono text-[10.5px] uppercase tracking-wider border-b border-[rgba(112,185,245,0.25)] h-7 leading-tight">
              <tr>
                {/* S.No Column: 50px Width */}
                <th className="px-3 py-0.5 w-[50px] text-center">#</th>

                {/* Invoice No Column: 140px Width */}
                <th className="px-3 py-0.5 w-[140px]">
                  {formType === 'sales_quotation' ? 'Quotation No' :
                   formType === 'sales_challan' ? 'Challan No' :
                   formType === 'spare_parts_purchase' ? 'Bill / Invoice No' :
                   formType === 'purchase_invoice' ? 'Purchase Bill No' : 'Invoice No'}
                </th>

                {/* Date Column: 110px Width */}
                <th className="px-3 py-0.5 w-[110px]">Date</th>

                {/* Location Column: 140px Width */}
                <th className="px-3 py-0.5 w-[140px]">Location</th>

                {/* Party Column: Auto/Remaining Flexible Width */}
                <th className="px-3 py-0.5 min-w-[200px]">
                  {formType === 'spare_parts_purchase' || formType === 'purchase_invoice' ? 'Supplier / Vendor' : 'Customer / Party'}
                </th>

                {/* Item Column: 180px Width */}
                <th className="px-3 py-0.5 w-[180px]">Item</th>

                {/* Total Qty Column: 110px Width */}
                <th className="px-3 py-0.5 w-[110px] text-right">
                  {formType === 'sales_challan' ? 'Slabs Count' :
                   formType === 'spare_parts_purchase' ? 'Items Qty' : 'Total Qty'}
                </th>

                {/* Inv Amount Column: 130px Width */}
                <th className="px-3 py-0.5 w-[130px] text-right">
                  {formType === 'sales_quotation' ? 'Quotation Amt (₹)' :
                   formType === 'sales_challan' ? 'Net Sqft' :
                   formType === 'spare_parts_purchase' || formType === 'purchase_invoice' ? 'Purchase Amt (₹)' : 'Inv. Amt (₹)'}
                </th>

                {/* Actions Column: 100px Width */}
                <th className="px-3 py-0.5 w-[100px] text-center">Actions</th>
              </tr>
            </thead>
            {/* 3. TBODY: Set exact row heights */}
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#7F98AE] text-sm">Loading records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#7F98AE]">
                    <p className="mb-2 text-sm">No records found for this view</p>
                    <button
                      onClick={handleOpenCreate}
                      className="px-3.5 py-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] rounded-xl font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create First Entry
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, index) => {
                  const isExpanded = expandedRowId === rec.id;
                  const isSelected = index === selectedIndex;
                  return (
                    <React.Fragment key={rec.id || index}>
                      <tr
                        data-table-id="transaction-crud-table"
                        data-row-idx={index}
                        onClick={() => {
                          setSelectedIndex(index);
                          setExpandedRowId((prev) => (prev === rec.id ? null : (rec.id ?? null)));
                        }}
                        className={`h-12 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                            : isExpanded
                            ? 'bg-[rgba(57,167,255,0.09)] hover:bg-[rgba(37,136,232,0.12)]'
                            : 'hover:bg-[rgba(57,167,255,0.06)]'
                        }`}
                      >
                        {/* Har cell mein py-2 (8px top-bottom padding) */}
                        <td className="px-3 py-2 text-center text-[#7F98AE] font-mono">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title={isExpanded ? 'Collapse Details' : 'Expand Details (Despatch, Items, Bill Sundries)'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId((prev) => (prev === rec.id ? null : (rec.id ?? null)));
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isExpanded ? 'bg-[#2588E8]/20 text-[#2588E8]' : 'hover:bg-[rgba(57,167,255,0.15)] text-[#7F98AE] hover:text-[#FFFFFF]'
                              }`}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#2588E8]' : ''}`} />
                            </button>
                            <span>{index + 1}</span>
                          </div>
                        </td>

                        <td className="px-3 py-2 font-mono font-bold text-[#2588E8]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(rec);
                            }}
                            title="Click to edit bill"
                            className="text-[#2588E8] hover:text-[#52C7FF] underline underline-offset-4 decoration-[#2588E8]/80 hover:decoration-[#52C7FF] cursor-pointer transition text-left"
                          >
                            {rec.refNo}
                          </button>
                        </td>

                        <td className="px-3 py-2 font-mono text-[#B7C9D9] whitespace-nowrap">
                          {formatDateDisplay(rec.date)}
                        </td>

                        <td className="px-3 py-2 text-[#F1F7FC] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
                            <span className="truncate max-w-[130px] text-[13px] font-semibold text-[#F1F7FC]" title={getRecordLocation(rec)}>
                              {getRecordLocation(rec)}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2 font-semibold text-[#FFFFFF] truncate max-w-[250px]" title={rec.partyName}>
                          <div>{rec.partyName}</div>
                          {rec.notes && !isInternalJsonNotes(rec.notes) && (
                            <div className="text-[11px] text-[#7F98AE] truncate max-w-[240px] font-normal">{rec.notes}</div>
                          )}
                        </td>

                        <td className="px-3 py-2 text-[#FFFFFF] truncate max-w-[180px]">
                          {(() => {
                            const itemInfo = getRecordItemsSummary(rec);
                            if (itemInfo.primary === '-') {
                              return <span className="text-[#7F98AE]">-</span>;
                            }
                            return (
                              <div title={itemInfo.tooltip} className="truncate flex items-center gap-1">
                                <span className="text-[13px] font-medium text-[#FFFFFF] truncate">{itemInfo.primary}</span>
                                {itemInfo.extraText && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1B3E2F] text-[#2588E8] border border-[rgba(112,185,245,0.25)] shrink-0">
                                    {itemInfo.extraText}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-2 text-right font-mono text-[#B7C9D9] whitespace-nowrap">
                          {(() => {
                            const isPcs = formType === 'sales_challan';
                            const dec = getRecordDecimals(rec);
                            const secDec = isPcs ? 2 : dec;
                            return rec.secondaryVal !== undefined && rec.secondaryVal !== null && rec.secondaryVal !== ''
                              ? `${Number(rec.secondaryVal).toLocaleString('en-IN', { minimumFractionDigits: secDec, maximumFractionDigits: secDec })} ${
                                  formType === 'sales_challan' ? 'Pcs' : formType === 'spare_parts_purchase' ? 'Items' : 'Sqft'
                                }`
                              : '-';
                          })()}
                        </td>

                        <td className="px-3 py-2 text-right font-mono font-bold text-[#FFFFFF] whitespace-nowrap">
                          {(() => {
                            const dec = getRecordDecimals(rec);
                            return formType === 'sales_challan'
                              ? `${Number(rec.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })} SQFT`
                              : `₹${Number(rec.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
                          })()}
                        </td>

                        <td className="px-3 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              title="Edit Record"
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1.5 rounded-lg hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#2588E8] transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              title="Delete Record"
                              onClick={() => handleDelete(rec.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-[#7F98AE] hover:text-[#FF647C] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {/* 3-Dot Options Menu Button */}
                            <button
                              type="button"
                              title="More Options (PDF, Excel, Print View)"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeActionMenu?.record.id === rec.id) {
                                  setActiveActionMenu(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const menuHeight = 145;
                                  const menuWidth = 144;
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;
                                  setActiveActionMenu({
                                    record: rec,
                                    top: openUpwards ? rect.top - menuHeight - 4 : rect.bottom + 6,
                                    left: Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth)),
                                  });
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                activeActionMenu?.record.id === rec.id
                                  ? 'bg-[#2588E8]/20 text-[#2588E8]'
                                  : 'hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF]'
                              }`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Slide Down Expanded Row Details */}
                      {isExpanded && (
                        <tr className="bg-[#05101C] border-b border-[rgba(112,185,245,0.25)]">
                          <td colSpan={9} className="p-0">
                            {renderExpandedRowDetails(rec)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Options Menu (Teleported to document.body so it is NEVER cut off) */}
      {activeActionMenu && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${activeActionMenu.top}px`,
            left: `${activeActionMenu.left}px`,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-36 bg-[#0E241B] border border-[rgba(112,185,245,0.25)] rounded-xl shadow-2xl py-1.5 text-left backdrop-blur-xl ring-1 ring-black/50"
        >
          <button
            type="button"
            onClick={() => {
              handleDirectExport(activeActionMenu.record, 'pdf');
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(57,167,255,0.15)] hover:text-[#2588E8] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <PdfFileIcon className="w-4 h-4 shrink-0" />
            <span>Pdf</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleDirectExport(activeActionMenu.record, 'excel');
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[rgba(57,167,255,0.15)] hover:text-[#2588E8] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <ExcelFileIcon className="w-4 h-4 shrink-0" />
            <span>Excel</span>
          </button>
          <div className="h-px bg-[rgba(112,185,245,0.12)] my-1" />
          <button
            type="button"
            onClick={() => {
              handleOpenPrintView(activeActionMenu.record);
              setActiveActionMenu(null);
            }}
            className="w-full px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-amber-500/15 hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Print View</span>
          </button>
        </div>,
        document.body
      )}

      {/* Sales & Spare Parts Invoice Dedicated Modal */}
      {(isInvoiceModalOpen || (minimizedInvoice && minimizedInvoice.formType === formType)) && (
        <SalesInvoiceModal
          initialData={selectedRecord}
          nextBillNo={nextRefNo}
          formType={formType === 'spare_parts_purchase' ? 'spare_parts_purchase' : formType === 'purchase_invoice' ? 'purchase_invoice' : 'sales_invoice'}
          defaultPrintView={openInPrintView}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedRecord(null);
            setOpenInPrintView(false);
            loadRecords();
          }}
          onSaveSuccess={() => {
            setIsInvoiceModalOpen(false);
            setSelectedRecord(null);
            setOpenInPrintView(false);
            loadRecords();
          }}
        />
      )}

      {/* Quotation & Delivery Challan Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2588E8]" />
                <h2 className="text-base font-bold text-[#FFFFFF] uppercase tracking-wider">
                  {selectedRecord ? 'Edit' : 'New'}{' '}
                  {formType === 'sales_quotation' ? 'Sales Quotation Form' : 'Sales Delivery Challan Form'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(37, 136, 232, 0.10)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="px-6 py-2.5 bg-rose-950/80 border-b border-rose-500/40 text-[#FF647C] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#FF647C] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {/* Reference Number & Entry Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                    {formType === "sales_quotation" ? "Quotation No *" : "Challan No *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.refNo}
                    onChange={(e) => setFormData({ ...formData, refNo: e.target.value })}
                    className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 font-mono text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                    Entry Date *
                  </label>
                  <DateInputDDMMYYYY
                    required
                    value={formData.date}
                    onChange={(newVal) => setFormData({ ...formData, date: newVal })}
                    className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8]"
                  />
                </div>
              </div>

              {/* Customer / Recipient Party */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                  Customer Name / Recipient *
                </label>
                <PartySelectDropdown
                  required
                  placeholder="Select or search Customer..."
                  value={formData.partyName}
                  onChange={(val) => setFormData({ ...formData, partyName: val })}
                  inputClassName="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8]"
                />
              </div>

              {/* Amount & Secondary Metric (Sqft / Slabs) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                    {formType === "sales_quotation" ? "Quotation Total (₹) *" : "Net Sqft / Weight *"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 font-mono text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                    {formType === "sales_quotation" ? "Total Sqft" : "Total Slabs / Pcs Count (2 Decimals)"}
                  </label>
                  <input
                    type="number"
                    step={formType === "sales_challan" ? "0.01" : "any"}
                    value={formData.secondaryVal}
                    onChange={(e) => setFormData({ ...formData, secondaryVal: e.target.value === "" ? 0 : Number(e.target.value) })}
                    onBlur={(e) => {
                      if (formType === "sales_challan" && e.target.value !== "" && !isNaN(Number(e.target.value))) {
                        setFormData({ ...formData, secondaryVal: Number(Number(e.target.value).toFixed(2)) });
                      }
                    }}
                    className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 font-mono text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Extra Field: Validity (Days) for Quotation OR Vehicle No for Challan */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                  {formType === "sales_quotation" ? "Validity (Days)" : "Vehicle / Truck Number"}
                </label>
                <input
                  type="text"
                  value={formData.extra1}
                  placeholder={formType === "sales_quotation" ? "e.g. 15 Days" : "RJ-14-GA-8821"}
                  onChange={(e) => setFormData({ ...formData, extra1: e.target.value })}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none"
                />
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none cursor-pointer"
                >
                  {(formType === "sales_quotation" 
                    ? ["Draft", "Sent", "Approved", "Rejected"] 
                    : ["Dispatched", "In Transit", "Delivered", "Cancelled"]
                  ).map((st) => (
                    <option key={st} value={st} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">{st}</option>
                  ))}
                </select>
              </div>

              {/* Notes & Remarks */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-[#7F98AE] mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Specific delivery notes or terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-[#FFFFFF] focus:ring-1 focus:ring-[#2588E8] focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[rgba(112,185,245,0.25)] flex justify-end gap-2.5">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold uppercase rounded-xl shadow-md cursor-pointer transition"
                >
                  Save Record
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] font-bold uppercase rounded-xl cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
