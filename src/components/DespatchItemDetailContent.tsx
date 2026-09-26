import React from "react";
import type { InvoiceItemRow } from "./SalesInvoiceModal";

interface DespatchItemDetailContentProps {
  layout?: "landscape" | "portrait";
  billNo: string;
  date: string;
  pakka?: string;
  kacha?: string;
  weight?: string;
  fare?: string;
  advance?: string;
  truck?: string;
  mobile?: string;
  destination?: string;
  formatDateDisplay: (d: string) => string;
  parseNumberValue: (val: any) => number;
  formatIndianNumberWithDecimals: (val: any) => string;
  groupedAlphabeticalItems: Array<{
    name: string;
    lines: InvoiceItemRow[];
    totalPcs: number;
    totalQty: number;
    unit: string;
  }>;
  billDecimalPlaces: number;
  totalPcs: number;
  totalQty: number;
  items: InvoiceItemRow[];
  reference?: string;
}

export const DespatchItemDetailContent: React.FC<DespatchItemDetailContentProps> = ({
  layout = "landscape",
  billNo,
  date,
  reference,
  pakka,
  kacha,
  weight,
  fare,
  advance,
  truck,
  mobile,
  destination,
  formatDateDisplay,
  parseNumberValue,
  formatIndianNumberWithDecimals,
  groupedAlphabeticalItems,
  billDecimalPlaces,
  totalPcs,
  totalQty,
  items,
}) => {
  const isLandscape = layout === "landscape";

  return (
    <div className={`flex flex-col justify-between w-full h-full text-black bg-white ${isLandscape ? "text-[13.5px] sm:text-[14px]" : "text-[11px] sm:text-[11.5px]"} leading-normal px-1 py-0.5 box-border`}>
      {/* TOP SECTION: DESPATCH - DETAIL */}
      <div className="flex flex-col mb-1 shrink-0">
        {/* Section Heading */}
        <div className={`bg-black text-white text-center py-0.5 px-2 font-black ${isLandscape ? "text-[13px] sm:text-[13.5px] tracking-wider" : "text-xs tracking-wider"} uppercase mb-1`}>
          DESPATCH - DETAIL
        </div>

        {/* Side-by-Side: Bill Details (Left) & Transport Particulars (Right) */}
        <div className={`grid grid-cols-12 gap-1.5 ${isLandscape ? "text-[12.5px] sm:text-[13px]" : "text-[10.5px] sm:text-[11px]"}`}>
          {/* Left: Bill Details - Strong border including left outer border */}
          <div className="col-span-5 border border-black border-l-2 bg-white flex flex-col box-border">
            <div className={`bg-gray-100 px-2 py-0.5 border-b border-black font-bold uppercase tracking-wider ${isLandscape ? "text-[12px]" : "text-[10px]"}`}>
              Bill Particulars
            </div>
            <div className="p-1.5 space-y-0.5 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center whitespace-nowrap">
                <span className="font-semibold text-gray-700 shrink-0">Bill No. :</span>
                <span className="font-mono font-bold text-black whitespace-nowrap">{billNo}</span>
              </div>
              <div className="flex justify-between items-center whitespace-nowrap">
                <span className="font-semibold text-gray-700 shrink-0">Date :</span>
                <span className="font-semibold text-black whitespace-nowrap">{formatDateDisplay(date)}</span>
              </div>
              {reference && (
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Ref :</span>
                  <span className="font-mono font-bold text-black whitespace-nowrap">{reference}</span>
                </div>
              )}
              <div className="flex justify-between items-center whitespace-nowrap">
                <span className="font-semibold text-gray-700 shrink-0">Pakka :</span>
                <span className="font-mono font-bold text-black whitespace-nowrap">
                  {pakka && parseNumberValue(pakka) !== 0 ? `₹${formatIndianNumberWithDecimals(pakka)}` : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center whitespace-nowrap">
                <span className="font-semibold text-gray-700 shrink-0">Kacha :</span>
                <span className={`font-mono font-bold whitespace-nowrap ${parseNumberValue(kacha) < 0 ? "text-rose-700" : "text-black"}`}>
                  {kacha && parseNumberValue(kacha) !== 0 ? `₹${formatIndianNumberWithDecimals(kacha)}` : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Transport Particulars */}
          <div className="col-span-7 border border-black bg-white flex flex-col box-border">
            <div className={`bg-gray-100 px-2 py-0.5 border-b border-black font-bold uppercase tracking-wider ${isLandscape ? "text-[12px]" : "text-[10px]"}`}>
              Transport Particulars
            </div>
            <div className="grid grid-cols-2 divide-x divide-black p-1.5 flex-1 items-center">
              {/* Left Column: Weight, Fare, Advance */}
              <div className="pr-1.5 space-y-0.5">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Weight :</span>
                  <span className="font-mono font-bold text-black truncate ml-1">
                    {weight && String(weight).trim() !== "" ? (String(weight).toLowerCase().includes("ton") ? weight : `${weight} Ton`) : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Fare :</span>
                  <span className="font-mono font-bold text-black truncate ml-1">
                    {fare && parseNumberValue(fare) !== 0 ? `₹${formatIndianNumberWithDecimals(fare)}/Ton` : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Advance :</span>
                  <span className="font-mono font-bold text-black truncate ml-1">
                    {advance !== undefined && advance !== null && String(advance).trim() !== "" && String(advance).toLowerCase() !== "nan" && parseNumberValue(advance) !== 0
                      ? `₹${formatIndianNumberWithDecimals(advance)}`
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Right Column: Truck No., Mobile, Delivery */}
              <div className="pl-1.5 space-y-0.5">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Truck No. :</span>
                  <span className="font-mono font-bold text-black uppercase truncate ml-1">{truck || "-"}</span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Mobile :</span>
                  <span className="font-mono font-bold text-black truncate ml-1">{mobile || "-"}</span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="font-semibold text-gray-700 shrink-0">Delivery :</span>
                  <span className="font-bold text-black truncate max-w-[85px] sm:max-w-[140px] ml-1" title={destination}>{destination || "-"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: ITEM - DETAIL */}
      <div className="flex flex-col flex-1 min-h-0 justify-between">
        {/* Section Heading */}
        <div className={`bg-black text-white text-center py-0.5 px-2 font-black ${isLandscape ? "text-[13px] sm:text-[13.5px] tracking-wider" : "text-xs tracking-wider"} uppercase mb-1 shrink-0`}>
          ITEM - DETAIL
        </div>

        {/* Line Items Table with explicit border-l on first column to guarantee left outer border in print */}
        <table className={`w-full table-fixed border-collapse border border-black ${isLandscape ? "text-[13.5px] sm:text-[14px]" : "text-[11px] sm:text-[11.5px]"} mb-0 bg-white box-border`}>
          <thead>
            <tr className="bg-gray-100 border-b border-black text-black">
              <th className="border-l border-r border-black py-0.5 px-1.5 text-center w-[6%]">#</th>
              <th className="border-r border-black py-0.5 px-2 text-center w-[40%]">Item</th>
              <th className="border-r border-black py-0.5 px-1 text-center w-[16%] whitespace-nowrap">Ref</th>
              <th className="border-r border-black py-0.5 px-1 text-center w-[18%] whitespace-nowrap">Pcs</th>
              <th className="border-r border-black py-0.5 px-1.5 text-center w-[20%] whitespace-nowrap">Qty</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let rowIdx = 0;
              const rows: React.ReactNode[] = [];
              groupedAlphabeticalItems.forEach((group) => {
                group.lines.forEach((it) => {
                  rowIdx += 1;
                  rows.push(
                    <tr key={it.id} className="border-b border-gray-300 h-[26px] sm:h-[28px]">
                      <td className="border-l border-r border-black py-[3px] px-1.5 text-center font-mono">{rowIdx}</td>
                      <td className="border-r border-black py-[3px] px-2 truncate">
                        <span className="font-semibold text-black">{it.item || "Marble / Granite"}</span>
                      </td>
                      <td className={`border-r border-black py-[3px] px-1.5 text-center font-mono text-gray-700 ${isLandscape ? "text-[12px]" : "text-[10px]"}`}>
                        {it.reference ? (
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 whitespace-pre-line font-mono font-medium text-black leading-tight text-center">
                            {it.reference}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="border-r border-black py-[3px] px-2 text-right font-mono">
                        {(() => {
                          const pVal = parseNumberValue(it.pcs);
                          return pVal > 0 || (it.pcs !== "" && it.pcs !== undefined && String(it.pcs).trim() !== "" && String(it.pcs).trim() !== "-")
                            ? (pVal > 0 ? pVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(it.pcs))
                            : "-";
                        })()}
                      </td>
                      <td className="border-r border-black py-[3px] px-2 text-right font-mono font-bold text-black">
                        {it.qty !== "" && it.qty !== undefined && !isNaN(Number(it.qty))
                          ? `${Number(it.qty).toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })} ${it.unit || "SQFT"}`
                          : "-"}
                      </td>
                    </tr>
                  );
                });
                if (groupedAlphabeticalItems.length > 1) {
                  rows.push(
                    <tr key={`group-subtotal-${group.name}`} className={`border-b-2 border-black bg-amber-50/70 font-semibold leading-tight ${isLandscape ? "text-[13px]" : "text-[11px]"}`}>
                      <td colSpan={3} className={`border-l border-r border-black ${isLandscape ? "py-1 pr-3 pl-1.5 text-[12px]" : "py-0.5 pr-2.5 pl-1 text-[10px]"} text-right uppercase tracking-wider font-bold text-gray-800`}>
                        TOTAL:
                      </td>
                      <td className="border-r border-black py-1 px-2 text-right font-mono font-bold text-black">
                        {group.totalPcs > 0 ? group.totalPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="border-r border-black py-1 px-2 text-right font-mono font-bold text-black">
                        {group.totalQty > 0 ? `${group.totalQty.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })} ${group.unit}` : "-"}
                      </td>
                    </tr>
                  );
                }
              });

              // Balanced number of rows: 10 in portrait (210mm height) and 7 in landscape
              const MIN_ROWS = isLandscape ? 7 : 10;
              const fillerCount = Math.max(0, MIN_ROWS - rows.length);
              for (let f = 0; f < fillerCount; f++) {
                rows.push(
                  <tr key={`filler-row-${f}`} className="border-b border-gray-200 h-[26px] sm:h-[28px] text-transparent select-none">
                    <td className="border-l border-r border-black py-[3px] px-1.5 text-center">&nbsp;</td>
                    <td className="border-r border-black py-[3px] px-2">&nbsp;</td>
                    <td className="border-r border-black py-[3px] px-1.5 text-center">&nbsp;</td>
                    <td className="border-r border-black py-[3px] px-2 text-right">&nbsp;</td>
                    <td className="border-r border-black py-[3px] px-2 text-right">&nbsp;</td>
                  </tr>
                );
              }

              return rows;
            })()}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 border-b-2 border-black bg-amber-100 print:bg-amber-100 font-bold leading-tight ${isLandscape ? "text-[14px] sm:text-[14.5px]" : "text-[11.5px]"}`}>
              <td colSpan={3} className={`border-l border-r border-black ${isLandscape ? "py-1.5 sm:py-2 pr-3 pl-1.5 text-[12.5px] sm:text-[13px]" : "py-1 pr-2.5 pl-1 text-[10.5px]"} text-right uppercase tracking-wider font-black text-black`}>
                TOTAL:
              </td>
              <td className="border-r border-black py-1.5 sm:py-2 px-2 text-right font-mono font-black text-black">
                {totalPcs > 0 ? totalPcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
              </td>
              <td className="border-r border-black py-1.5 sm:py-2 px-2 text-right font-mono font-black text-black">
                {totalQty > 0 ? `${totalQty.toLocaleString('en-IN', { minimumFractionDigits: billDecimalPlaces, maximumFractionDigits: billDecimalPlaces })} ${items[0]?.unit || "SQFT"}` : "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
