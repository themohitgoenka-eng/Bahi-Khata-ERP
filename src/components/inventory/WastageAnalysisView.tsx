import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { ExportEngine } from '../../services/exportEngine';
import { WastageRecord } from '../../types';
import { WastageRecordModal } from './WastageRecordModal';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { formatDateDisplay } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  Scissors,
  Plus,
  FileDown,
  Printer,
  Calendar,
  AlertTriangle,
  Layers,
  FileCheck,
  Trash2,
} from 'lucide-react';

export const WastageAnalysisView: React.FC = () => {
  const { currentCompany, currentFiscalYear, inventoryItems, refreshActiveData, showNotification } = useApp();

  const [records, setRecords] = useState<WastageRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

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

  const loadWastageRecords = async () => {
    setLoading(true);
    try {
      const data = await dbStorage.getWastageRecords();
      setRecords(
        [...data].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWastageRecords();
  }, [currentCompany, currentFiscalYear]);

  // Keyboard navigation for Wastage Analysis table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: records.length,
    tableId: 'wastage-analysis-table',
    enabled: !modalOpen && !confirmModal.isOpen,
  });

  const handleDeleteRecord = (r: WastageRecord) => {
    const itm = inventoryItems.find((i) => i.id === r.itemId);
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Delete Wastage Incident',
      message: `Are you sure you want to delete this wastage record of ${r.quantity} ${itm?.primaryUnit || 'units'} for "${itm?.name || 'Item'}"?`,
      details: [
        { label: 'Date', value: formatDateDisplay(r.date) },
        { label: 'Item', value: itm ? `${itm.name} (${itm.code})` : 'Item' },
        { label: 'Quantity', value: `${r.quantity} ${itm?.primaryUnit || 'Units'}` },
        { label: 'Reason', value: r.reason || '-' },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await dbStorage.deleteWastageEntry(r.id);
          showNotification('Wastage record deleted successfully.', 'info');
          await loadWastageRecords();
          await refreshActiveData();
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete wastage record.', 'error');
        }
      },
    });
  };

  const totalQuantity = records.reduce((s, r) => s + r.quantity, 0);

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Inventory Wastage & Breakage Audit Register',
      periodText: `Total Wastage Events: ${records.length} | Net Lost Quantity: ${totalQuantity}`,
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Item Name & Code', dataKey: 'item' },
        { header: 'Wastage Type', dataKey: 'type' },
        { header: 'Qty Lost', dataKey: 'qty', align: 'right' },
        { header: 'Reason / Incident Note', dataKey: 'reason' },
        { header: 'Accounting Voucher', dataKey: 'voucher' },
      ],
      data: records.map((r) => {
        const itm = inventoryItems.find((i) => i.id === r.itemId);
        return {
          date: formatDateDisplay(r.date),
          item: itm ? `${itm.name} (${itm.code})` : 'Unknown Item',
          type: r.wastageType.replace('_', ' '),
          qty: `${r.quantity} ${itm?.primaryUnit || 'Units'}`,
          reason: r.reason,
          voucher: r.accountingVoucherId ? 'Loss Voucher Posted' : 'Physical Adjustment Only',
        };
      }),
      summaryRows: [
        {
          date: 'TOTAL',
          item: `${records.length} Incident Logs`,
          type: '',
          qty: `${totalQuantity} Units`,
          reason: '',
          voucher: '',
        },
      ],
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: 'Material Wastage, Breakage & Loss Audit Register',
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Material / Item Code', dataKey: 'item' },
        { header: 'Damage Type', dataKey: 'type' },
        { header: 'Lost Qty', dataKey: 'qty', align: 'right' },
        { header: 'Inspection Note / Reason', dataKey: 'reason' },
        { header: 'Voucher Status', dataKey: 'voucher' },
      ],
      data: records.map((r) => {
        const itm = inventoryItems.find((i) => i.id === r.itemId);
        return {
          date: formatDateDisplay(r.date),
          item: itm ? `${itm.name} (${itm.code})` : 'Unknown Item',
          type: r.wastageType.replace('_', ' '),
          qty: `${r.quantity} ${itm?.primaryUnit || 'Units'}`,
          reason: r.reason,
          voucher: r.accountingVoucherId ? 'Loss Voucher Posted' : 'Physical Adjustment Only',
        };
      }),
      summaryRows: [
        {
          date: 'TOTAL',
          item: `${records.length} Incident Logs`,
          type: '',
          qty: `${totalQuantity} Units`,
          reason: '',
          voucher: '',
        },
      ],
    });
  };

  return (
    <div className="space-y-2" id="wastage_analysis_view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#421d23] border border-rose-800/40 flex items-center justify-center text-[#fca5a5] shadow-xs">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#FFFFFF] tracking-wide flex items-center gap-2">
              Wastage, Breakage &amp; Cutting Loss Audit Register
            </h1>
            <p className="text-[10.5px] text-[#7F98AE] hidden sm:block">
              Log and review material losses, marble slab edge damages, transit cracks, and factory cutting scrap.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 bg-[#421d23] hover:bg-rose-900 text-[#fca5a5] border border-rose-800/50 font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Record New Wastage
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] uppercase text-[10.5px] tracking-wider leading-tight">
              <tr>
                <th className="py-0.5 px-3">Date</th>
                <th className="py-0.5 px-3">Item Name</th>
                <th className="py-0.5 px-3">Wastage Category</th>
                <th className="py-0.5 px-3 text-right font-bold text-[#fca5a5]">Lost Quantity</th>
                <th className="py-0.5 px-3">Incident Notes / Cause</th>
                <th className="py-0.5 px-3 text-center">Accounting Impact</th>
                <th className="py-0.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#7F98AE]">
                    No wastage or breakage incidents recorded for this period.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const isSelected = idx === selectedIndex;
                  const itm = inventoryItems.find((i) => i.id === r.itemId);

                  return (
                    <tr
                      key={r.id}
                      data-table-id="wastage-analysis-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition cursor-pointer leading-tight text-xs ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(18,48,76,0.42)] backdrop-blur-xl'
                      }`}
                    >
                      <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-xs">{formatDateDisplay(r.date)}</td>
                      <td className="py-1 px-3 font-medium text-[#FFFFFF] text-xs">
                        {itm?.name || 'Inventory Item'}
                        <span className="text-[10px] text-[#7F98AE] font-mono block">({itm?.code})</span>
                      </td>
                      <td className="py-1 px-3">
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-[#421d23] text-[#fca5a5] border border-rose-800/40 uppercase">
                          {r.wastageType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-bold text-[#fca5a5] text-xs">
                        {r.quantity} <span className="text-[10px] text-[#7F98AE]">{itm?.primaryUnit || 'SQFT'}</span>
                      </td>
                      <td className="py-1 px-3 text-[#B7C9D9] text-xs">{r.reason}</td>
                      <td className="py-1 px-3 text-center">
                        {r.accountingVoucherId ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2588E8] bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] px-1.5 py-0.2 rounded-md">
                            <FileCheck className="w-3 h-3" /> P&amp;L Expensed
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#7F98AE]">Stock Qty Deducted</span>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right">
                        <button
                          onClick={() => handleDeleteRecord(r)}
                          title="Delete Wastage Entry"
                          className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#421d23] text-[#7F98AE] hover:text-[#fca5a5] border border-[rgba(112,185,245,0.25)] hover:border-rose-800/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <WastageRecordModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            loadWastageRecords();
            refreshActiveData();
          }}
        />
      )}

      {/* Confirmation Modal */}
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
