export interface PrintElementOptions {
  title?: string;
  pageSize?: string;
  pageMargin?: string;
  scale?: number;
  colorMode?: "color" | "monochrome";
  copies?: number;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
  fallbackToPdf?: () => void;
}

/**
 * Builds the standalone printable HTML document with embedded styles.
 */
export function buildPrintableHtml(elementId: string, options?: PrintElementOptions): string | null {
  const docEl = document.getElementById(elementId);
  if (!docEl) return null;

  const pageSize = options?.pageSize || "A4 portrait";
  const pageMargin = options?.pageMargin || "4mm";
  const title = options?.title || "Print Document";
  const scale = options?.scale || 1;
  const isMonochrome = options?.colorMode === "monochrome";
  const is297Landscape = pageSize.includes("297mm") || pageSize.toLowerCase().includes("297");
  const is210Landscape = pageSize.includes("210mm 148mm") || (pageSize.toLowerCase().includes("a5") && pageSize.toLowerCase().includes("landscape"));
  const isA5 = !is297Landscape && !is210Landscape && (pageSize.toLowerCase().includes("a5") || pageSize.includes("148mm"));
  const actualPageSize = is297Landscape ? "297mm 210mm" : is210Landscape ? "210mm 148mm" : isA5 ? "A5 portrait" : pageSize;
  const effectiveMargin = (is297Landscape || is210Landscape || pageMargin === "0") ? "0" : isA5 ? "0" : pageMargin;

  // Grab all existing stylesheets and style tags
  const existingStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${existingStyles}
    <style>
      @page {
        size: ${actualPageSize};
        margin: ${effectiveMargin};
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #f8fafc !important;
        color: #000000 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        ${isMonochrome ? "filter: grayscale(100%) contrast(110%) !important;" : ""}
      }
      /* Standalone Top Bar for Browser View */
      .app-standalone-print-bar {
        position: sticky;
        top: 0;
        z-index: 999999;
        background: #0f172a;
        color: #ffffff;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: system-ui, sans-serif;
      }
      .app-print-action-btn {
        background: #f59e0b;
        color: #000000;
        font-weight: 700;
        font-size: 13px;
        padding: 6px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: background 0.15s;
      }
      .app-print-action-btn:hover {
        background: #d97706;
      }
      .app-print-close-btn {
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .app-print-close-btn:hover {
        background: #1e293b;
        color: #ffffff;
      }
      .app-print-wrapper {
        display: flex;
        justify-content: center;
        padding: 16px 8px;
      }
      #${elementId} {
        margin: 0 auto !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: ${is297Landscape ? "297mm" : is210Landscape ? "210mm" : isA5 ? "148mm" : pageSize.toLowerCase().includes("a4 landscape") || (pageSize.toLowerCase().includes("landscape") && !pageSize.toLowerCase().includes("a5")) ? "275mm" : pageSize.toLowerCase().includes("landscape") ? "188mm" : "100%"} !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
        border: 1px solid #cbd5e1 !important;
        transform: ${isA5 || is297Landscape || is210Landscape ? "none" : `scale(${scale})`};
        transform-origin: top center;
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
      }
      .bill-copy {
        width: 142mm !important;
        max-width: 142mm !important;
        height: 200mm !important;
        max-height: 200mm !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .print\\:hidden, button, [role="button"] {
        display: none !important;
      }
      @media print {
        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          max-height: 100% !important;
          overflow: visible !important;
        }
        .app-standalone-print-bar {
          display: none !important;
          visibility: hidden !important;
        }
        .app-print-wrapper {
          padding: 0 !important;
          margin: 0 auto !important;
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          box-sizing: border-box !important;
        }
        #${elementId} {
          border: none !important;
          box-shadow: none !important;
          margin: 0 auto !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: ${is297Landscape ? "297mm" : isA5 ? "142mm" : pageSize.toLowerCase().includes("a4 landscape") || (pageSize.toLowerCase().includes("landscape") && !pageSize.toLowerCase().includes("a5")) ? "275mm" : pageSize.toLowerCase().includes("landscape") ? "188mm" : "100%"} !important;
          box-sizing: border-box !important;
          min-height: auto !important;
          height: ${is297Landscape ? "210mm" : "auto"} !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          transform: ${isA5 || is297Landscape ? "none" : `scale(${scale})`} !important;
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
          max-width: ${is297Landscape ? "297mm" : isA5 ? "142mm" : pageSize.toLowerCase().includes("a4 landscape") || (pageSize.toLowerCase().includes("landscape") && !pageSize.toLowerCase().includes("a5")) ? "275mm" : pageSize.toLowerCase().includes("landscape") ? "188mm" : "100%"} !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          height: auto !important;
          min-height: auto !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        table {
          page-break-inside: auto !important;
          break-inside: auto !important;
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
      }
    </style>
  </head>
  <body>
    <div class="app-standalone-print-bar">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700; font-size:13px; color:#f8fafc;">${title}</span>
        <span style="font-size:11px; color:#94a3b8; background:#1e293b; padding:2px 8px; border-radius:4px;">
          ${is297Landscape ? "A4 LANDSCAPE (297 × 210 MM)" : isA5 ? "A5 PORTRAIT (148 × 210 MM)" : pageSize.toUpperCase()}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="app-print-action-btn" onclick="window.print()">
          🖨️ Print Now (Ctrl+P)
        </button>
        <button class="app-print-close-btn" onclick="window.close()">
          Close
        </button>
      </div>
    </div>
    <div class="app-print-wrapper">
      ${docEl.outerHTML}
    </div>
    <script>
      // Auto-trigger print when opened in a dedicated browser tab
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
          try {
            window.focus();
            window.print();
          } catch(e) {
            console.warn('Auto print error:', e);
          }
        }, 350);
      });
    </script>
  </body>
</html>`;
}

/**
 * Opens the printable document in a dedicated browser window/tab.
 * This completely bypasses iframe sandbox restrictions where window.print() is blocked.
 */
export function openElementInPrintTab(elementId: string, options?: PrintElementOptions): boolean {
  const htmlContent = buildPrintableHtml(elementId, options);
  if (!htmlContent) return false;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    // Keep blob URL active for a short while so browser tab can finish loading
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }, 500);

  return true;
}

/**
 * Universal print helper that attempts direct print via hidden iframe,
 * falls back to window.print() or opening in a standalone print tab if restricted.
 */
export function printElementById(elementId: string, options?: PrintElementOptions): { success: boolean; method: "iframe" | "direct" | "new_tab" | "fallback" } {
  const docEl = document.getElementById(elementId);
  if (!docEl) {
    try {
      window.print();
      return { success: true, method: "direct" };
    } catch {
      return { success: false, method: "fallback" };
    }
  }

  // Check if we are inside an iframe
  const isInsideIframe = typeof window !== "undefined" && window.self !== window.top;

  try {
    // Clean up old print frame if any
    const oldFrame = document.getElementById("app_silent_print_frame");
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "app_silent_print_frame";
    iframe.setAttribute(
      "style",
      "position:fixed;right:0;bottom:0;width:10px;height:10px;border:0;opacity:0.01;pointer-events:none;z-index:-9999;"
    );
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    const htmlContent = buildPrintableHtml(elementId, options);

    if (frameDoc && htmlContent) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        let printTriggered = false;
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            printTriggered = true;
          }
        } catch (err) {
          console.warn("Iframe silent print failed (sandbox restriction):", err);
        }

        if (!printTriggered) {
          // If in iframe sandbox, opening a new tab is the most reliable way to avoid sandbox blockage
          if (isInsideIframe) {
            openElementInPrintTab(elementId, options);
          } else {
            try {
              window.print();
            } catch {
              openElementInPrintTab(elementId, options);
            }
          }
        }

        // Cleanup after printing
        setTimeout(() => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 60000);
      }, 250);

      return { success: true, method: "iframe" };
    }
  } catch (err) {
    console.warn("Print execution error, opening print tab:", err);
  }

  // Fallback to opening clean print tab
  openElementInPrintTab(elementId, options);
  return { success: true, method: "new_tab" };
}
