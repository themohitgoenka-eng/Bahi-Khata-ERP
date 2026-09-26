import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Company, FiscalYear } from '../types';

export interface SaveFileResult {
  saved: boolean;
  method: 'picker' | 'fallback' | 'canceled';
  filename: string;
}

export interface ExportReportOptions {
  company: Company;
  fiscalYear: FiscalYear;
  reportTitle: string;
  subtitle?: string;
  periodText?: string;
  hideGeneratedDate?: boolean;
  hideFooter?: boolean;
  columns: { header: string; dataKey: string; width?: number; align?: 'left' | 'right' | 'center' }[];
  data: Record<string, any>[];
  summaryRows?: Record<string, any>[];
  filenamePrefix?: string;
  customFilename?: string; // Exact filename (e.g. "Trial Bal. (26-27)")
}

// Helper to save a file while prompting user for location (Save As dialog) if browser supports File System Access API
async function saveBlobWithLocationPicker(
  blob: Blob,
  suggestedFilename: string,
  mimeType: string,
  extension: string,
  fallbackSave: () => void
): Promise<SaveFileResult> {
  // If browser supports File System Access API, open the system "Save As" location dialog
  if (typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: suggestedFilename,
        types: [
          {
            description: `${extension.toUpperCase()} Document`,
            accept: {
              [mimeType]: [`.${extension}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, method: 'picker', filename: suggestedFilename };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User deliberately clicked 'Cancel' in the Save As dialog
        return { saved: false, method: 'canceled', filename: suggestedFilename };
      }
      console.warn('Native Save As dialog was skipped or unavailable (e.g. iframe restrictions), using standard download:', err);
    }
  }

  // Standard fallback download
  fallbackSave();
  return { saved: true, method: 'fallback', filename: suggestedFilename };
}

// Helper to draw authentic Indian Rupee glyph (₹) onto jsPDF canvas
function drawIndianRupeeGlyph(
  doc: jsPDF,
  x: number,
  y: number,
  width: number = 2.3,
  height: number = 2.7,
  color: [number, number, number] = [255, 255, 255]
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.35); // Solid bold stroke matching 9pt bold Helvetica
  // Top horizontal bar
  doc.line(x, y, x + width, y);
  // Second horizontal bar
  doc.line(x, y + height * 0.32, x + width * 0.88, y + height * 0.32);
  // Vertical stem
  doc.line(x + width * 0.15, y, x + width * 0.15, y + height * 0.58);
  // Upper semicircle loop
  const arcCenterX = x + width * 0.15;
  const arcCenterY = y + height * 0.29;
  const rX = width * 0.56;
  const rY = height * 0.29;
  for (let a = -Math.PI / 2; a < Math.PI / 2; a += Math.PI / 8) {
    const px1 = arcCenterX + rX * Math.cos(a);
    const py1 = arcCenterY + rY * Math.sin(a);
    const a2 = a + Math.PI / 8;
    const px2 = arcCenterX + rX * Math.cos(a2);
    const py2 = arcCenterY + rY * Math.sin(a2);
    doc.line(px1, py1, px2, py2);
  }
  // Downward diagonal leg
  doc.line(x + width * 0.28, y + height * 0.58, x + width * 0.95, y + height);
}

export class ExportEngine {
  // 1. Generate Structured PDF
  public static async exportToPdf(options: ExportReportOptions): Promise<SaveFileResult> {
    const doc = new jsPDF({
      orientation: options.columns.length > 7 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // Company Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(options.company.name, pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    const addressLine = [options.company.address, options.company.city, options.company.state, options.company.pincode].filter(Boolean).join(', ');
    if (addressLine) {
      doc.text(addressLine, pageWidth / 2, 21, { align: 'center' });
    }

    const contactLine = [options.company.phone ? `Phone: ${options.company.phone}` : '', options.company.email ? `Email: ${options.company.email}` : ''].filter(Boolean).join(' | ');
    if (contactLine) {
      doc.text(contactLine, pageWidth / 2, 26, { align: 'center' });
    }

    // Report Divider
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 29, pageWidth - 14, 29);

    // Report Title & Period
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(options.reportTitle.toUpperCase(), 14, 36);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const metaParts = [`Financial Year: ${options.fiscalYear.name}`, `Period: ${options.periodText || 'Full Year'}`];
    if (!options.hideGeneratedDate) {
      metaParts.push(`Generated: ${new Date().toLocaleDateString('en-IN')}`);
    }
    const metaText = metaParts.join(' | ');
    doc.text(metaText, 14, 41);

    if (options.subtitle) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(options.subtitle, 14, 46);
    }

    const startY = options.subtitle ? 50 : 45;

    // Prepare table body
    const tableBody = options.data.map((row) =>
      options.columns.map((col) => {
        const val = row[col.dataKey];
        if (typeof val === 'number') {
          return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return val !== undefined && val !== null ? String(val) : '';
      })
    );

    // Summary rows if any in dedicated table footer
    const tableFoot: any[][] = [];
    if (options.summaryRows && options.summaryRows.length > 0) {
      options.summaryRows.forEach((sRow) => {
        tableFoot.push(
          options.columns.map((col) => {
            const val = sRow[col.dataKey];
            if (typeof val === 'number') {
              return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            return val !== undefined && val !== null ? String(val) : '';
          })
        );
      });
    }

    // Detect columns with Rupee symbol in header
    const rupeeHeaderColIndices = new Set<number>();
    options.columns.forEach((col, idx) => {
      const headerStr = col.header || '';
      if (headerStr.includes('₹') || headerStr.includes('¹')) {
        rupeeHeaderColIndices.add(idx);
      }
    });

    // AutoTable Styling
    autoTable(doc, {
      startY,
      head: [options.columns.map((c) => c.header)],
      body: tableBody,
      foot: tableFoot.length > 0 ? tableFoot : undefined,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      footStyles: {
        fillColor: [30, 41, 59], // Highlight with header color
        textColor: [255, 255, 255], // Bold white text
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: options.columns.reduce((acc, col, idx) => {
        if (col.align) {
          acc[idx] = { halign: col.align };
        }
        return acc;
      }, {} as any),
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowData = options.data[data.row.index];
          if (rowData && (rowData.isGroup || rowData._isGroup)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
        if (data.section === 'head' || data.section === 'foot') {
          const colDef = options.columns[data.column.index];
          if (colDef && colDef.align) {
            data.cell.styles.halign = colDef.align;
          }
          if (data.section === 'foot') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [30, 41, 59];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontSize = 9;
          }
          if (data.section === 'head' && rupeeHeaderColIndices.has(data.column.index)) {
            // Suppress default text rendering for this header cell so custom glyph rendering works cleanly
            data.cell.text = [];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'head' && rupeeHeaderColIndices.has(data.column.index)) {
          const originalHeader = options.columns[data.column.index]?.header || '';
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);

          const openIdx = originalHeader.indexOf('(');
          let prefix = originalHeader;
          let suffix = ')';
          if (openIdx !== -1) {
            prefix = originalHeader.substring(0, openIdx + 1); // e.g. "Debit ("
            suffix = originalHeader.substring(originalHeader.indexOf(')')) || ')'; // e.g. ")"
          }

          const wPrefix = doc.getTextWidth(prefix);
          const wSuffix = doc.getTextWidth(suffix);
          const rupeeW = 2.3;
          const rupeeH = 2.7;
          const gap = 0.45;
          const totalW = wPrefix + gap + rupeeW + gap + wSuffix;

          const colDef = options.columns[data.column.index];
          const align = (colDef && colDef.align) || 'left';
          let startX = data.cell.x + data.cell.padding('left');
          if (align === 'right') {
            startX = data.cell.x + data.cell.width - data.cell.padding('right') - totalW;
          } else if (align === 'center') {
            startX = data.cell.x + (data.cell.width - totalW) / 2;
          }

          const baselineY = data.cell.y + data.cell.height / 2 + 1.1;
          const rupeeY = baselineY - rupeeH + 0.2;

          // 1. Draw "Debit ("
          doc.text(prefix, startX, baselineY);

          // 2. Draw authentic Indian Rupee Symbol inside brackets
          const rupeeX = startX + wPrefix + gap;
          drawIndianRupeeGlyph(doc, rupeeX, rupeeY, rupeeW, rupeeH, [255, 255, 255]);

          // 3. Draw ")"
          const closeBracketX = rupeeX + rupeeW + gap;
          doc.text(suffix, closeBracketX, baselineY);
        }
      },
      didDrawPage: (data) => {
        if (options.hideFooter) {
          return;
        }
        // Footer: Page Number
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount} | BAHI KHATA (Accounting • Inventory • Manufacturing • ERP)`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      },
    });

    let cleanFilename: string;
    if (options.customFilename) {
      cleanFilename = options.customFilename.endsWith('.pdf')
        ? options.customFilename
        : `${options.customFilename}.pdf`;
    } else {
      cleanFilename = `${(options.filenamePrefix || options.reportTitle).toLowerCase().replace(/\s+/g, '_')}_${options.fiscalYear.name.replace(/\s+/g, '_')}.pdf`;
    }

    const pdfBlob = doc.output('blob');
    return await saveBlobWithLocationPicker(
      pdfBlob,
      cleanFilename,
      'application/pdf',
      'pdf',
      () => doc.save(cleanFilename)
    );
  }

  // 2. Generate Structured Excel XLSX
  public static async exportToExcel(optionsOrData: ExportReportOptions | Record<string, any>[], filenameFallback?: string): Promise<SaveFileResult> {
    if (Array.isArray(optionsOrData)) {
      if (optionsOrData.length === 0) return { saved: false, method: 'fallback', filename: 'export.xlsx' };
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(optionsOrData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      const cleanFilename = filenameFallback?.endsWith('.xlsx')
        ? filenameFallback
        : `${(filenameFallback || 'export').toLowerCase().replace(/\s+/g, '_')}.xlsx`;
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await saveBlobWithLocationPicker(
        excelBlob,
        cleanFilename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlsx',
        () => XLSX.writeFile(workbook, cleanFilename)
      );
      return;
    }

    const options = optionsOrData;
    const workbook = XLSX.utils.book_new();

    // Prepare Sheet Data
    const sheetData: any[][] = [];

    // Header metadata
    sheetData.push([options.company.name]);
    sheetData.push([`${options.company.city || ''} ${options.company.state || ''}`.trim()]);
    sheetData.push([options.reportTitle]);
    sheetData.push([`Financial Year: ${options.fiscalYear.name} | Period: ${options.periodText || 'Full Year'}`]);
    sheetData.push([`Generated On: ${new Date().toLocaleString('en-IN')}`]);
    sheetData.push([]); // blank row

    // Table Header
    sheetData.push(options.columns.map((c) => c.header));

    // Data rows
    options.data.forEach((row) => {
      sheetData.push(
        options.columns.map((col) => {
          const val = row[col.dataKey];
          return val !== undefined && val !== null ? val : '';
        })
      );
    });

    // Summary Rows
    if (options.summaryRows && options.summaryRows.length > 0) {
      options.summaryRows.forEach((sRow) => {
        sheetData.push(
          options.columns.map((col) => {
            const val = sRow[col.dataKey];
            return val !== undefined && val !== null ? val : '';
          })
        );
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-fit column widths
    const colWidths = options.columns.map((c) => ({
      wch: Math.max(c.header.length + 4, 14),
    }));
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    let cleanFilename: string;
    if (options.customFilename) {
      cleanFilename = options.customFilename.endsWith('.xlsx')
        ? options.customFilename
        : `${options.customFilename}.xlsx`;
    } else {
      cleanFilename = `${(options.filenamePrefix || options.reportTitle).toLowerCase().replace(/\s+/g, '_')}_${options.fiscalYear.name.replace(/\s+/g, '_')}.xlsx`;
    }

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return await saveBlobWithLocationPicker(
      excelBlob,
      cleanFilename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx',
      () => XLSX.writeFile(workbook, cleanFilename)
    );
  }

  // 3. Generate Structured CSV
  public static async exportToCsv(optionsOrData: ExportReportOptions | Record<string, any>[], filenameFallback?: string): Promise<SaveFileResult> {
    let cleanFilename = 'export.csv';
    let csvContent = '';

    if (Array.isArray(optionsOrData)) {
      if (optionsOrData.length === 0) return { saved: false, method: 'fallback', filename: 'export.csv' };
      const worksheet = XLSX.utils.json_to_sheet(optionsOrData);
      csvContent = XLSX.utils.sheet_to_csv(worksheet);
      cleanFilename = filenameFallback?.endsWith('.csv')
        ? filenameFallback
        : `${(filenameFallback || 'export').toLowerCase().replace(/\s+/g, '_')}.csv`;
    } else {
      const options = optionsOrData;
      const sheetData: any[][] = [];

      // Header metadata
      sheetData.push([options.company.name]);
      sheetData.push([options.reportTitle]);
      sheetData.push([`Financial Year: ${options.fiscalYear.name}`]);
      sheetData.push([]);

      // Table Header
      sheetData.push(options.columns.map((c) => c.header));

      // Data rows
      options.data.forEach((row) => {
        sheetData.push(
          options.columns.map((col) => {
            const val = row[col.dataKey];
            return val !== undefined && val !== null ? val : '';
          })
        );
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      csvContent = XLSX.utils.sheet_to_csv(worksheet);
      cleanFilename = options.customFilename
        ? (options.customFilename.endsWith('.csv') ? options.customFilename : `${options.customFilename}.csv`)
        : `${(options.filenamePrefix || options.reportTitle).toLowerCase().replace(/\s+/g, '_')}_${options.fiscalYear.name.replace(/\s+/g, '_')}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    return await saveBlobWithLocationPicker(
      blob,
      cleanFilename,
      'text/csv',
      'csv',
      () => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', cleanFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    );
  }

  // 4. Trigger Browser Print
  public static printReport(): void {
    window.print();
  }
}
