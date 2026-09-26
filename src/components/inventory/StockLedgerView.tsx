import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryEngine, ItemStockMovement } from '../../services/inventoryEngine';
import { ExportEngine } from '../../services/exportEngine';
import { formatDateDisplay } from '../../utils/dateUtils';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import {
  Layers,
  FileDown,
  Printer,
  Calendar,
  Package,
  TrendingDown,
  TrendingUp,
  Scissors,
  MapPin,
} from 'lucide-react';

export const StockLedgerView: React.FC = () => {
  const { currentCompany, currentFiscalYear, inventoryItems, locations } = useApp();

  const [selectedItemId, setSelectedItemId] = useState<string>(inventoryItems[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [movements, setMovements] = useState<ItemStockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const selectedItem = inventoryItems.find((i) => i.id === selectedItemId) || inventoryItems[0];

  useEffect(() => {
    if (!selectedItemId && inventoryItems.length > 0) {
      setSelectedItemId(inventoryItems[0].id);
    }
  }, [inventoryItems, selectedItemId]);

  useEffect(() => {
    const loadLedger = async () => {
      if (!selectedItem) return;
      setLoading(true);
      try {
        const data = await inventoryEngine.getStockLedger(selectedItem.id);
        setMovements(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadLedger();
  }, [selectedItemId, selectedItem, currentCompany, currentFiscalYear]);

  const filteredMovements = movements.filter((m) => {
    if (selectedLocationId === 'ALL') return true;
    if (m.locationId === selectedLocationId) return true;
    const loc = locations.find((l) => l.id === selectedLocationId);
    if (loc && m.godown === loc.name) return true;
    return false;
  });

  const handleExportPdf = () => {
    if (!currentCompany || !currentFiscalYear || !selectedItem) return;
    ExportEngine.exportToPdf({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Stock Ledger: ${selectedItem.name} (${selectedItem.code})`,
      subtitle: `Primary Unit: ${selectedItem.primaryUnit} ${selectedItem.alternateUnit ? `| Alternate: ${selectedItem.alternateUnit}` : ''}`,
      periodText: `Movement Entries: ${filteredMovements.length}`,
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Ref / Voucher', dataKey: 'voucherNo' },
        { header: 'Godown / Location', dataKey: 'godown' },
        { header: 'Type', dataKey: 'movementType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Inward Qty', dataKey: 'inward', align: 'right' },
        { header: 'Outward Qty', dataKey: 'outward', align: 'right' },
        { header: 'Wastage Qty', dataKey: 'wastage', align: 'right' },
        { header: 'Balance Qty', dataKey: 'balance', align: 'right' },
      ],
      data: filteredMovements.map((m) => ({
        date: formatDateDisplay(m.date),
        voucherNo: m.voucherNo,
        godown: m.godown || (m.locationId ? locations.find((l) => l.id === m.locationId)?.name : '-'),
        movementType: m.movementType,
        particulars: m.particulars,
        inward: m.inwardQty > 0 ? `${m.inwardQty} ${selectedItem.primaryUnit}` : '',
        outward: m.outwardQty > 0 ? `${m.outwardQty} ${selectedItem.primaryUnit}` : '',
        wastage: m.wastageQty > 0 ? `${m.wastageQty} ${selectedItem.primaryUnit}` : '',
        balance: `${m.runningBalance} ${selectedItem.primaryUnit}`,
      })),
    });
  };

  const handleExportExcel = () => {
    if (!currentCompany || !currentFiscalYear || !selectedItem) return;
    ExportEngine.exportToExcel({
      company: currentCompany,
      fiscalYear: currentFiscalYear,
      reportTitle: `Stock Ledger - ${selectedItem.name}`,
      subtitle: `Code: ${selectedItem.code || '-'} | Category: ${selectedItem.category} | Unit: ${selectedItem.primaryUnit}`,
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Location / Godown', dataKey: 'godown' },
        { header: 'Type', dataKey: 'movementType' },
        { header: 'Particulars', dataKey: 'particulars' },
        { header: 'Inward (+)', dataKey: 'inward', align: 'right' },
        { header: 'Outward (-)', dataKey: 'outward', align: 'right' },
        { header: 'Wastage (-)', dataKey: 'wastage', align: 'right' },
        { header: 'Balance', dataKey: 'balance', align: 'right' },
      ],
      data: movements.map((m) => ({
        date: formatDateDisplay(m.date),
        godown: m.godown || (m.locationId ? locations.find((l) => l.id === m.locationId)?.name : '-'),
        movementType: m.movementType,
        particulars: m.particulars,
        inward: m.inwardQty > 0 ? `${m.inwardQty} ${selectedItem.primaryUnit}` : '',
        outward: m.outwardQty > 0 ? `${m.outwardQty} ${selectedItem.primaryUnit}` : '',
        wastage: m.wastageQty > 0 ? `${m.wastageQty} ${selectedItem.primaryUnit}` : '',
        balance: `${m.runningBalance} ${selectedItem.primaryUnit}`,
      })),
    });
  };

  return (
    <div className="space-y-2" id="stock_ledger_view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] flex items-center justify-center text-[#2588E8] shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#FFFFFF] tracking-wide flex items-center gap-2">
              Stock Ledger &amp; Item Movements
            </h1>
            <p className="text-[10.5px] text-[#7F98AE] hidden sm:block">
              Chronological audit trail of all physical receipt, issue, and wastage stock movement entries.
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
            onClick={ExportEngine.printReport}
            className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#2588E8]" />
            Print
          </button>
        </div>
      </div>

      {/* Select Item & Location Bar */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3 py-1.5 rounded-xl text-xs flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-0.5">
            Select Inventory Item:
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1 text-[#2588E8] font-bold focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
          >
            {inventoryItems.map((itm) => (
              <option key={itm.id} value={itm.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                {itm.name} ({itm.code}) - {itm.primaryUnit}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px]">
          <label className="block text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#2588E8]" />
            Filter by Godown:
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1 text-[#FFFFFF] font-medium focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
          >
            <option value="ALL" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">All Godowns &amp; Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        {selectedItem && (
          <div className="flex items-center gap-2.5 text-xs bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-1 rounded-lg border border-[rgba(112,185,245,0.25)]">
            <div>
              <span className="text-[#7F98AE] text-[10px]">Primary: </span>
              <span className="font-bold text-[#FFFFFF]">{selectedItem.primaryUnit}</span>
            </div>
            {selectedItem.alternateUnit && (
              <div>
                <span className="text-[#7F98AE] text-[10px]">Alt: </span>
                <span className="font-bold text-[#2588E8]">
                  1 {selectedItem.alternateUnit} = {selectedItem.conversionFactor} {selectedItem.primaryUnit}
                </span>
              </div>
            )}
            <div>
              <span className="text-[#7F98AE] text-[10px]">Rate: </span>
              <span className="font-bold text-[#2588E8]">₹{selectedItem.openingRate}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stock Ledger Movements Table */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] font-semibold border-b border-[rgba(112,185,245,0.25)] uppercase text-[10.5px] tracking-wider leading-tight">
              <tr>
                <th className="py-0.5 px-3.5">Date</th>
                <th className="py-0.5 px-3.5">Ref / Voucher #</th>
                <th className="py-0.5 px-3.5">Godown / Location</th>
                <th className="py-0.5 px-3.5">Movement Type</th>
                <th className="py-0.5 px-3.5">Particulars / Party</th>
                <th className="py-0.5 px-3.5 text-right text-[#2588E8]">Inward Qty</th>
                <th className="py-0.5 px-3.5 text-right text-[#2588E8]">Outward Qty</th>
                <th className="py-0.5 px-3.5 text-right text-[#fca5a5]">Wastage Qty</th>
                <th className="py-0.5 px-3.5 text-right font-bold text-[#FFFFFF]">Running Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#7F98AE]">
                    No movement records found for this inventory item {selectedLocationId !== 'ALL' ? 'at selected location' : ''}.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-[rgba(18,48,76,0.42)] backdrop-blur-xl transition leading-tight text-xs">
                    <td className="py-1 px-3 font-mono text-[#B7C9D9] whitespace-nowrap text-xs">{formatDateDisplay(m.date)}</td>
                    <td className="py-1 px-3 font-mono font-bold text-[#2588E8] whitespace-nowrap text-xs">
                      {m.voucherNo}
                    </td>
                    <td className="py-1 px-3 text-[#B7C9D9] text-xs">
                      <span className="flex items-center gap-1 font-mono text-[10.5px] text-[#2588E8]">
                        <MapPin className="w-3 h-3 text-[#2588E8] shrink-0" />
                        {m.godown || (m.locationId ? locations.find((l) => l.id === m.locationId)?.name : 'Main Yard')}
                      </span>
                    </td>
                    <td className="py-1 px-3">
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          m.movementType === 'INWARD'
                            ? 'bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                            : m.movementType === 'OUTWARD'
                            ? 'bg-[#0f2e24] text-[#2588E8] border border-[rgba(37, 136, 232, 0.20)]'
                            : m.movementType === 'WASTAGE'
                            ? 'bg-[#421d23] text-[#fca5a5] border border-rose-800/40'
                            : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#B7C9D9] border border-[rgba(112,185,245,0.25)]'
                        }`}
                      >
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-1 px-3 text-[#FFFFFF] font-medium text-xs">{m.particulars}</td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                      {m.inwardQty > 0 ? `+${m.inwardQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#2588E8] text-xs">
                      {m.outwardQty > 0 ? `-${m.outwardQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#fca5a5] text-xs">
                      {m.wastageQty > 0 ? `-${m.wastageQty}` : '-'}
                    </td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-[#FFFFFF] text-xs">
                      {m.runningBalance}{' '}
                      <span className="text-[10px] text-[#7F98AE]">{selectedItem?.primaryUnit}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
