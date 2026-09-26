import html2canvas from "html2canvas";
import { toCanvas, toPng } from "html-to-image";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { Company, FiscalYear } from "../types";
import type { InvoiceItemRow } from "../components/SalesInvoiceModal";

export interface InvoiceExportData {
  company?: Company | null;
  fiscalYear?: FiscalYear | null;
  billNo: string;
  date: string;
  formType?: string;
  isSpareParts?: boolean;
  isPurchase?: boolean;
  party: string;
  partyLedger?: any;
  items: InvoiceItemRow[];
  groupedAlphabeticalItems?: Array<{
    name: string;
    lines: InvoiceItemRow[];
    totalPcs: number;
    totalQty: number;
    unit: string;
  }>;
  billSundries: Array<{
    id: string;
    name: string;
    type: "add" | "sub";
    amount: string;
    rate?: string;
    ledger?: string;
  }>;
  subtotal: number;
  grandTotal: number;
  pakka?: string;
  kacha?: string;
  weight?: string;
  fare?: string;
  advance?: string;
  truck?: string;
  mobile?: string;
  destination?: string;
  series?: string;
  location?: string;
  reference?: string;
  billDecimalPlaces?: number;
  totalPcs?: number;
  totalQty?: number;
  printSheetType: "half_sheet" | "a5_portrait" | "full_sheet";
  printScale?: number;
  copies?: number;
  copyLabel?: string;
}

/**
 * Downloads a blob safely using standard anchor trigger
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Normalizes modern oklch/lab colors to standard rgb/hex in cloned DOM elements
 * to protect html2canvas from color parser exceptions.
 */
function sanitizeOklchInDocument(clonedDoc: Document) {
  try {
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");

    const normalizeColor = (colorStr: string): string => {
      if (!colorStr || typeof colorStr !== "string" || !colorStr.includes("oklch")) {
        return colorStr;
      }
      return colorStr.replace(/oklch\([^)]+\)/g, (match) => {
        if (ctx) {
          try {
            ctx.fillStyle = match;
            const res = ctx.fillStyle;
            if (res && !res.includes("oklch")) {
              return res;
            }
          } catch {
            // ignore and use fallback
          }
        }
        return "#111827"; // safe standard neutral dark
      });
    };

    // 1. Process all <style> tags in the cloned document
    const styleTags = clonedDoc.querySelectorAll("style");
    styleTags.forEach((tag) => {
      if (tag.textContent && tag.textContent.includes("oklch")) {
        tag.textContent = normalizeColor(tag.textContent);
      }
    });

    // 2. Process all elements and override computed oklch colors with normalized rgb
    const all = clonedDoc.querySelectorAll("*");
    all.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style) {
        const computed = window.getComputedStyle(htmlEl);
        const styleProps = [
          "color",
          "backgroundColor",
          "borderColor",
          "borderTopColor",
          "borderBottomColor",
          "borderLeftColor",
          "borderRightColor",
          "outlineColor",
        ];
        for (const prop of styleProps) {
          const val = (computed as any)[prop];
          if (val && typeof val === "string" && val.includes("oklch")) {
            (htmlEl.style as any)[prop] = normalizeColor(val);
          }
        }
      }
    });
  } catch (e) {
    console.warn("sanitizeOklchInDocument encountered non-fatal warning:", e);
  }
}

/**
 * High-fidelity element capture engine:
 * 1. Uses browser-native SVG foreignObject via html-to-image (fully supports modern CSS and oklch colors).
 * 2. If font loading fails, retries with skipFonts to avoid CORS/sandbox restrictions.
 * 3. Falls back to html2canvas with active oklch color sanitization.
 */
async function captureElementToCanvas(
  docEl: HTMLElement,
  scale: number = 2.5
): Promise<HTMLCanvasElement> {
  // Temporarily reset preview styling so the capture engine captures
  // a clean, 100% unclipped, 1:1 layout without outer shadows, preview borders, or CSS zoom scaling
  const prevTransform = docEl.style.transform;
  const prevBoxShadow = docEl.style.boxShadow;
  const prevBorder = docEl.style.border;
  const prevMargin = docEl.style.margin;

  docEl.style.transform = "none";
  docEl.style.boxShadow = "none";
  docEl.style.border = "none";
  docEl.style.margin = "0";

  // Use full scroll dimensions to guarantee no right-edge column or bottom footer gets clipped
  const captureWidth = Math.ceil(Math.max(docEl.scrollWidth, docEl.offsetWidth, docEl.clientWidth));
  const captureHeight = Math.ceil(Math.max(docEl.scrollHeight, docEl.offsetHeight, docEl.clientHeight));

  try {
    try {
      // Primary: html-to-image toCanvas with skipFonts: true and explicit full bounds
      return await toCanvas(docEl, {
        pixelRatio: scale,
        backgroundColor: "#ffffff",
        skipFonts: true,
        fontEmbedCSS: "",
        cacheBust: true,
        width: captureWidth,
        height: captureHeight,
        style: {
          transform: "none",
          boxShadow: "none",
          border: "none",
          margin: "0",
        },
      });
    } catch (err1) {
      console.warn("toCanvas primary attempt failed, retrying toPng fallback...", err1);
      try {
        // Secondary: toPng dataURL with skipFonts
        const dataUrl = await toPng(docEl, {
          pixelRatio: scale,
          backgroundColor: "#ffffff",
          skipFonts: true,
          fontEmbedCSS: "",
          width: captureWidth,
          height: captureHeight,
          style: {
            transform: "none",
            boxShadow: "none",
            border: "none",
            margin: "0",
          },
        });
        return await new Promise<HTMLCanvasElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.drawImage(img, 0, 0);
              resolve(c);
            } else {
              reject(new Error("Unable to create canvas 2d context"));
            }
          };
          img.onerror = reject;
          img.src = dataUrl;
        });
      } catch (err2) {
        console.warn("html-to-image failed, falling back to sanitized html2canvas...", err2);
        // Tertiary: html2canvas with oklch sanitizer
        return await html2canvas(docEl, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: captureWidth,
          height: captureHeight,
          windowWidth: captureWidth,
          windowHeight: captureHeight,
          onclone: (clonedDoc) => {
            sanitizeOklchInDocument(clonedDoc);
          },
        });
      }
    }
  } finally {
    docEl.style.transform = prevTransform;
    docEl.style.boxShadow = prevBoxShadow;
    docEl.style.border = prevBorder;
    docEl.style.margin = prevMargin;
  }
}

/**
 * Captures the exact DOM preview element (#invoice_printable_document)
 * and exports it as a 100% pixel-perfect PDF matching preview layout.
 */
export async function exportInvoicePreviewToExactPdf(
  elementId: string,
  data: InvoiceExportData,
  options?: {
    customFilename?: string;
    scale?: number;
    onProgress?: (msg: string) => void;
  }
): Promise<{ success: boolean; filename: string }> {
  const docEl = document.getElementById(elementId);
  if (!docEl) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  const cleanBillNo = (data.billNo || "INVOICE").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = (data.date || "").replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename =
    options?.customFilename ||
    `${cleanBillNo}_${data.printSheetType === "half_sheet" ? "Pakka_Half" : data.printSheetType === "a5_portrait" ? "Kacha_Half" : "Kacha_Full"}_${dateStr}.pdf`;

  options?.onProgress?.("Rendering preview layout to high-resolution canvas...");

  // Capture element using robust engine (html-to-image + sanitized html2canvas fallback)
  const canvas = await captureElementToCanvas(docEl, options?.scale || 2.5);

  options?.onProgress?.("Generating PDF document...");

  const isA5 = data.printSheetType === "a5_portrait" || data.printSheetType === "half_sheet";
  const isHalfSheet = data.printSheetType === "half_sheet";
  const isLandscape = false;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: isA5 ? "a5" : "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginMm = isA5 ? 0 : 4;

  const printableW = pageWidth - marginMm * 2;
  const printableH = pageHeight - marginMm * 2;

  // Single page height in canvas pixels based on printable aspect ratio
  const pageCanvasHeight = (printableH * canvas.width) / printableW;

  // Half sheet occupies full A4 (Section 1 top, Section 2 bottom).
  // Kacha Half (isLandscape) must strictly be on 1 single A4 Landscape sheet with 2 copies.
  // A5 should only paginate if content is genuinely > 1.25x single page height.
  // Full sheet should paginate only if content is > 1.08x single page height.
  const isMultiPage = !isHalfSheet && !isLandscape && canvas.height > pageCanvasHeight * (isA5 ? 1.25 : 1.08);

  if (!isMultiPage) {
    // Calculate scaled dimensions to preserve exact aspect ratio and fit page cleanly
    const imgRatio = canvas.width / canvas.height;
    let renderW = printableW;
    let renderH = printableW / imgRatio;

    if (renderH > printableH) {
      // If it slightly overflows the page, scale down to fit cleanly on one sheet
      renderH = printableH;
      renderW = printableH * imgRatio;
    }

    // Position coordinates:
    // - isLandscape: 0, 0 (exact full A4 landscape fit)
    // - half_sheet & full_sheet: center vertically and horizontally in printable area
    const posX = isLandscape ? 0 : (pageWidth - renderW) / 2;
    const posY = isLandscape ? 0 : (pageHeight - renderH) / 2;

    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    // Render original copy
    pdf.addImage(imgData, "JPEG", posX, posY, renderW, renderH);

    // If user requested multiple copies (e.g. 2 or 3)
    const totalCopies = data.copies || 1;
    const copyLabels = [
      "Original for Recipient",
      "Duplicate for Transporter",
      "Triplicate for Supplier",
    ];

    for (let c = 1; c < totalCopies; c++) {
      pdf.addPage("a4", isLandscape ? "landscape" : "portrait");
      pdf.addImage(imgData, "JPEG", posX, posY, renderW, renderH);
      // Add copy stamp watermark / label on subsequent pages
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(copyLabels[c] || `Copy ${c + 1}`, pageWidth - marginMm - 30, marginMm + 4, { align: "right" });
    }
  } else {
    // Multi-page PDF generation: slice the canvas into page-sized blocks
    let currentY = 0;
    let pageCount = 0;
    const slicePosX = (pageWidth - printableW) / 2;
    while (currentY < canvas.height) {
      if (pageCount > 0) {
        pdf.addPage("a4", "portrait");
      }
      const sliceH = Math.min(pageCanvasHeight, canvas.height - currentY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, sliceH);
        ctx.drawImage(canvas, 0, currentY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = pageCanvas.toDataURL("image/jpeg", 0.98);
        const renderSliceH = (sliceH * printableW) / canvas.width;
        pdf.addImage(sliceData, "JPEG", slicePosX, marginMm, printableW, renderSliceH);
      }
      currentY += sliceH;
      pageCount++;
    }
  }

  options?.onProgress?.("Saving PDF file...");
  const pdfBlob = pdf.output("blob");
  downloadBlob(pdfBlob, filename);

  return { success: true, filename };
}

/**
 * Builds an Excel (.xlsx) file with the EXACT structured layout matching the preview:
 * - Half Sheet: DESPATCH - DETAIL, Bill Particulars & Transport Particulars side-by-side,
 *   ITEM - DETAIL with #, Item, Ref, Pcs, Qty, subtotals and grand totals.
 * - Full / A5 Portrait: Company header, Tax Invoice badge, Buyer details, Transport particulars,
 *   Items table with Pcs, Qty, Rate, Amount, Tax Sundries, Grand Total, and Bank details.
 */
export function exportInvoicePreviewToExactExcel(
  data: InvoiceExportData,
  options?: { customFilename?: string }
): { success: boolean; filename: string } {
  const cleanBillNo = (data.billNo || "INVOICE").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = (data.date || "").replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename =
    options?.customFilename ||
    `${cleanBillNo}_${data.printSheetType === "half_sheet" ? "Pakka_Half" : "TaxInvoice"}_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  if (data.printSheetType === "half_sheet") {
    // ========================================================
    // PAKKA (HALF) - A5 LANDSCAPE EXCEL LAYOUT
    // ========================================================
    const rows: any[][] = [];
    const merges: XLSX.Range[] = [];

    // Row 0: Header Banner
    rows.push(["DESPATCH - DETAIL", "", "", "", ""]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });

    // Row 1: Section Sub-headers
    rows.push(["BILL PARTICULARS", "", "TRANSPORT PARTICULARS", "", ""]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
    merges.push({ s: { r: 1, c: 2 }, e: { r: 1, c: 4 } });

    // Row 2: Particulars Row 1
    rows.push([
      "Bill No.:",
      data.billNo || "-",
      "Weight:",
      data.weight ? `${data.weight} Ton` : "-",
      `Truck No.: ${data.truck || "-"}`,
    ]);

    // Row 3: Particulars Row 2
    rows.push([
      "Date:",
      data.date || "-",
      "Fare:",
      data.fare ? `₹${data.fare}/Ton` : "-",
      `Mobile: ${data.mobile || "-"}`,
    ]);

    // Row 4: Particulars Row 3
    rows.push([
      "Pakka:",
      data.pakka && Number(String(data.pakka).replace(/,/g, '')) !== 0
        ? (String(data.pakka).startsWith('₹') ? data.pakka : `₹${data.pakka}`)
        : "-",
      "Advance:",
      data.advance && Number(String(data.advance).replace(/,/g, '')) !== 0
        ? (String(data.advance).startsWith('₹') ? data.advance : `₹${data.advance}`)
        : "-",
      `Delivery: ${data.destination || "-"}`,
    ]);

    // Row 5: Particulars Row 4
    rows.push([
      "Kacha:",
      data.kacha && Number(String(data.kacha).replace(/,/g, '')) !== 0
        ? (String(data.kacha).startsWith('₹') ? data.kacha : `₹${data.kacha}`)
        : "-",
      "",
      "",
      "",
    ]);

    // Row 6: Blank
    rows.push([]);

    // Row 7: Item Detail Header Banner
    const itemBannerRow = rows.length;
    rows.push(["ITEM - DETAIL", "", "", "", ""]);
    merges.push({ s: { r: itemBannerRow, c: 0 }, e: { r: itemBannerRow, c: 4 } });

    // Row 8: Table Column Headers
    rows.push(["#", "Item Description", "Ref / Batch", "Pcs", "Qty"]);

    // Items list (using grouped items if available, or flat items)
    let itemIdx = 0;
    if (data.groupedAlphabeticalItems && data.groupedAlphabeticalItems.length > 0) {
      data.groupedAlphabeticalItems.forEach((group) => {
        group.lines.forEach((it) => {
          itemIdx += 1;
          rows.push([
            itemIdx,
            it.item || "Marble / Granite",
            it.reference || "-",
            it.pcs ? Number(it.pcs) || it.pcs : "-",
            it.qty ? `${Number(it.qty).toFixed(data.billDecimalPlaces ?? 2)} ${it.unit || "SQFT"}` : "-",
          ]);
        });

        // Group Subtotal Row if more than 1 item group
        if (data.groupedAlphabeticalItems && data.groupedAlphabeticalItems.length > 1) {
          rows.push([
            "",
            `Total: ${group.name}`,
            "",
            group.totalPcs > 0 ? group.totalPcs : "-",
            `${group.totalQty.toFixed(data.billDecimalPlaces ?? 2)} ${group.unit}`,
          ]);
        }
      });
    } else {
      data.items.forEach((it) => {
        itemIdx += 1;
        rows.push([
          itemIdx,
          it.item || "Marble / Granite",
          it.reference || "-",
          it.pcs ? Number(it.pcs) || it.pcs : "-",
          it.qty ? `${Number(it.qty).toFixed(data.billDecimalPlaces ?? 2)} ${it.unit || "SQFT"}` : "-",
        ]);
      });
    }

    // Grand Total Row
    const grandTotalRow = rows.length;
    rows.push([
      "GRAND TOTAL",
      "",
      "",
      data.totalPcs ? Number(data.totalPcs) : "-",
      data.totalQty ? `${Number(data.totalQty).toFixed(data.billDecimalPlaces ?? 2)} ${data.items[0]?.unit || "SQFT"}` : "-",
    ]);
    merges.push({ s: { r: grandTotalRow, c: 0 }, e: { r: grandTotalRow, c: 2 } });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 8 },  // #
      { wch: 38 }, // Item
      { wch: 18 }, // Ref
      { wch: 14 }, // Pcs
      { wch: 22 }, // Qty
    ];
    ws["!merges"] = merges;

    XLSX.utils.book_append_sheet(wb, ws, "Despatch Detail");
  } else {
    // ========================================================
    // FULL SHEET / A5 PORTRAIT - TAX INVOICE EXCEL LAYOUT
    // ========================================================
    const rows: any[][] = [];
    const merges: XLSX.Range[] = [];

    const comp = data.company;
    const invTitle = data.isSpareParts
      ? "SPARE PARTS BILL"
      : data.isPurchase
      ? "PURCHASE VOUCHER"
      : "SALE INVOICE";

    // Row 0: Company Legal Name
    rows.push([comp?.legalName || comp?.name || "Bahi Khata ERP"]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });

    // Row 1: Company Address
    rows.push([comp?.address || "Plot No. 42-45, Marble Industrial Area, Kishangarh, Ajmer (Raj.)"]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });

    // Row 2: Company Contact & Tax Info
    rows.push([
      `GSTIN: ${comp?.gstin || "08ABCDE1234F1Z5"} | Phone: ${comp?.phone || "-"} | State: ${comp?.state || "Rajasthan"}`
    ]);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });

    // Row 3: Blank
    rows.push([]);

    // Row 4: Invoice Title Banner
    rows.push([`${invTitle} (Original for Recipient)`]);
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 7 } });

    // Row 5: Buyer Details & Invoice Particulars Headers
    rows.push(["BILLED TO / BUYER DETAILS", "", "", "", "INVOICE PARTICULARS", "", "", ""]);
    merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 3 } });
    merges.push({ s: { r: 5, c: 4 }, e: { r: 5, c: 7 } });

    // Row 6: Party Name vs Invoice No
    rows.push([
      "Party Name:",
      data.party || "Counter / Cash",
      "",
      "",
      "Invoice No:",
      data.billNo || "-",
      "",
      "",
    ]);
    merges.push({ s: { r: 6, c: 1 }, e: { r: 6, c: 3 } });
    merges.push({ s: { r: 6, c: 5 }, e: { r: 6, c: 7 } });

    // Row 7: Address vs Date
    rows.push([
      "Address:",
      data.partyLedger?.address || "Address on record",
      "",
      "",
      "Dated:",
      data.date || "-",
      "",
      "",
    ]);
    merges.push({ s: { r: 7, c: 1 }, e: { r: 7, c: 3 } });
    merges.push({ s: { r: 7, c: 5 }, e: { r: 7, c: 7 } });

    // Row 8: GSTIN vs Series / Godown
    rows.push([
      "GSTIN / UIN:",
      data.partyLedger?.gstin || "URP (Unregistered)",
      "",
      "",
      "Series / Godown:",
      `${data.series || "Main"} | ${data.location || "Godown"}`,
      "",
      "",
    ]);
    merges.push({ s: { r: 8, c: 1 }, e: { r: 8, c: 3 } });
    merges.push({ s: { r: 8, c: 5 }, e: { r: 8, c: 7 } });

    // Row 9: State vs Transport / Vehicle
    rows.push([
      "State & Code:",
      data.partyLedger?.state || comp?.state || "Rajasthan (08)",
      "",
      "",
      "Vehicle No.:",
      data.truck || "-",
      "",
      "",
    ]);
    merges.push({ s: { r: 9, c: 1 }, e: { r: 9, c: 3 } });
    merges.push({ s: { r: 9, c: 5 }, e: { r: 9, c: 7 } });

    // Row 10: Transport Specifics
    rows.push([
      "Weight:",
      data.weight ? `${data.weight} Ton` : "-",
      "Fare:",
      data.fare ? `₹${data.fare}` : "-",
      "Advance:",
      data.advance ? `₹${data.advance}` : "-",
      "Destination:",
      data.destination || "-",
    ]);

    // Row 11: Blank
    rows.push([]);

    // Row 12: Item Table Headers
    rows.push([
      "S.No",
      "Description of Goods / Services",
      "Ref / Batch",
      "Pcs",
      "Quantity",
      "Unit",
      "Rate (₹)",
      "Amount (₹)",
    ]);

    // Row 13+: Items
    data.items.forEach((it, idx) => {
      rows.push([
        idx + 1,
        it.item || "Marble / Granite",
        it.reference || "-",
        it.pcs ? Number(it.pcs) || it.pcs : "-",
        it.qty ? Number(it.qty) || 0 : "-",
        it.unit || "SQFT",
        it.rate ? Number(it.rate) || 0 : "-",
        it.amount ? Number(it.amount) || 0 : "-",
      ]);
    });

    // Subtotal Row
    const subtotalRow = rows.length;
    rows.push([
      "SUBTOTAL / TAXABLE VALUE",
      "",
      "",
      data.totalPcs || "-",
      data.totalQty || "-",
      "",
      "",
      data.subtotal || 0,
    ]);
    merges.push({ s: { r: subtotalRow, c: 0 }, e: { r: subtotalRow, c: 2 } });

    // Bill Sundries / Taxes
    if (data.billSundries && data.billSundries.length > 0) {
      data.billSundries.forEach((s) => {
        const sRow = rows.length;
        const sign = s.type === "sub" ? "-" : "+";
        const amt = typeof s.amount === "number" ? (isNaN(s.amount) ? 0 : s.amount) : parseFloat(String(s.amount || 0).replace(/,/g, "")) || 0;
        rows.push([
          `${s.name || "Sundry / Tax"} (${sign})`,
          "",
          "",
          "",
          "",
          "",
          s.rate ? `${s.rate}%` : "",
          amt,
        ]);
        merges.push({ s: { r: sRow, c: 0 }, e: { r: sRow, c: 5 } });
      });
    }

    // Grand Total Row
    const grandRow = rows.length;
    rows.push([
      "GRAND TOTAL (NET PAYABLE)",
      "",
      "",
      "",
      "",
      "",
      "₹",
      data.grandTotal || 0,
    ]);
    merges.push({ s: { r: grandRow, c: 0 }, e: { r: grandRow, c: 5 } });

    // Blank row
    rows.push([]);

    // Bank Details
    const bankRow = rows.length;
    rows.push([
      `Bank: ${comp?.bankName || "HDFC Bank Ltd."} | A/C: ${comp?.bankAccountNo || "50200012345678"} | IFSC: ${comp?.bankIfsc || "HDFC0000123"} | Branch: ${comp?.bankBranch || "Kishangarh"}`,
    ]);
    merges.push({ s: { r: bankRow, c: 0 }, e: { r: bankRow, c: 7 } });

    // Signatory
    const signRow = rows.length;
    rows.push([
      `For ${comp?.name || "Company"}: Authorized Signatory`,
    ]);
    merges.push({ s: { r: signRow, c: 0 }, e: { r: signRow, c: 7 } });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 8 },  // S.No
      { wch: 34 }, // Item
      { wch: 14 }, // Ref
      { wch: 12 }, // Pcs
      { wch: 14 }, // Qty
      { wch: 10 }, // Unit
      { wch: 14 }, // Rate
      { wch: 18 }, // Amount
    ];
    ws["!merges"] = merges;

    XLSX.utils.book_append_sheet(wb, ws, "Tax Invoice");
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);

  return { success: true, filename };
}
