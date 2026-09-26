import React from 'react';
import { Voucher } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import { Printer, X, FileText } from 'lucide-react';
import { PdfFileIcon, ExcelFileIcon } from '../common/DocumentIcons';
import { printElementById } from '../../utils/printHelper';

interface VoucherPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: Voucher | null;
  onExportPdf?: (voucher: Voucher) => void;
  onExportExcel?: (voucher: Voucher) => void;
}

export function numberToIndianWords(num: number): string {
  if (!num || isNaN(num)) return 'Zero Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatUnderThousand = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return 'Zero Only';

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  let res = '';
  if (crore > 0) res += formatUnderThousand(crore) + ' Crore ';
  if (lakh > 0) res += formatUnderThousand(lakh) + ' Lakh ';
  if (thousand > 0) res += formatUnderThousand(thousand) + ' Thousand ';
  if (remainder > 0) res += formatUnderThousand(remainder) + ' ';

  res = res.trim() + ' Rupees';
  if (decimalPart > 0) {
    res += ' and ' + formatUnderThousand(decimalPart) + ' Paise';
  }
  return res + ' Only';
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({
  isOpen,
  onClose,
  voucher,
  onExportPdf,
  onExportExcel,
}) => {
  const { currentCompany } = useApp();

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    printElementById('voucher_printable_area', {
      title: `Voucher_${voucher.voucherNumber}`,
      pageSize: 'A4 portrait',
      pageMargin: '6mm',
    });
  };

  const getVoucherTypeDisplay = (type: string) => {
    switch (type) {
      case 'PAYMENT':
        return 'PAYMENT';
      case 'RECEIPT':
        return 'RECEIPT';
      case 'CONTRA':
        return 'CONTRA';
      case 'JOURNAL':
        return 'JOURNAL';
      case 'DEBIT_NOTE':
      case 'PURCHASE_RETURN':
        return 'DEBIT NOTE';
      case 'CREDIT_NOTE':
      case 'SALES_RETURN':
        return 'CREDIT NOTE';
      case 'SALES':
        return 'SALES';
      case 'PURCHASE':
        return 'PURCHASE';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  const formattedType = getVoucherTypeDisplay(voucher.voucherType);

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(2,10,18,0.75)] backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[rgba(13,38,62,0.98)] backdrop-blur-2xl border border-[rgba(112,185,245,0.30)] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] bg-[rgba(8,27,46,0.85)]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#2588E8]" />
            <span className="font-bold text-sm text-[#FFFFFF]">
              {formattedType} VOUCHER PREVIEW
            </span>
            <span className="text-xs text-[#52C7FF] font-mono bg-[#2588E8]/15 border border-[#2588E8]/30 px-2.5 py-0.5 rounded-lg">
              {voucher.voucherNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onExportPdf && (
              <button
                type="button"
                onClick={() => onExportPdf(voucher)}
                className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.6)] hover:bg-[rgba(57,167,255,0.2)] text-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
                title="Export as PDF"
              >
                <PdfFileIcon className="w-3.5 h-3.5 shrink-0" />
                <span>PDF</span>
              </button>
            )}

            {onExportExcel && (
              <button
                type="button"
                onClick={() => onExportExcel(voucher)}
                className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.6)] hover:bg-[rgba(57,167,255,0.2)] text-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition cursor-pointer"
                title="Export as Excel"
              >
                <ExcelFileIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Excel</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-md shadow-amber-500/25 transition cursor-pointer uppercase tracking-wider"
              title="Print Voucher"
            >
              <Printer className="w-3.5 h-3.5 text-black" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[#7F98AE] hover:text-[#FFFFFF] p-1.5 rounded-lg hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer ml-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-[#071322] flex justify-center">
          <div
            id="voucher_printable_area"
            className="w-full max-w-3xl bg-white text-black p-6 sm:p-8 rounded-lg shadow-xl text-xs space-y-5 print:p-0 print:shadow-none print:w-full print:rounded-none"
            style={{ fontFamily: 'Segoe UI, -apple-system, sans-serif' }}
          >
            {/* Header: Company & Voucher Meta */}
            <div className="border-b-2 border-black pb-4 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-wide text-black uppercase">
                  {currentCompany?.name || 'Bahi Khata ERP'}
                </h1>
                <p className="text-gray-700 text-xs font-medium leading-relaxed">
                  {currentCompany?.address || 'Industrial Area'}
                  {currentCompany?.city ? `, ${currentCompany.city}` : ''}
                  {currentCompany?.state ? ` - ${currentCompany.state}` : ''}
                  {currentCompany?.pincode ? ` (${currentCompany.pincode})` : ''}
                </p>
                <div className="flex flex-wrap gap-x-4 text-[11px] text-gray-600">
                  {currentCompany?.gstin && (
                    <span><strong>GSTIN:</strong> {currentCompany.gstin}</span>
                  )}
                  {currentCompany?.phone && (
                    <span><strong>Phone:</strong> {currentCompany.phone}</span>
                  )}
                  {currentCompany?.email && (
                    <span><strong>Email:</strong> {currentCompany.email}</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 min-w-[200px]">
                <div className="inline-block bg-black text-white font-black text-sm px-3 py-1 uppercase tracking-wider rounded-sm mb-2">
                  {formattedType} VOUCHER
                </div>
                <table className="text-left text-xs ml-auto border-collapse">
                  <tbody>
                    <tr>
                      <td className="pr-2 font-bold text-gray-700 py-0.5">Voucher No:</td>
                      <td className="font-bold text-black py-0.5">{voucher.voucherNumber}</td>
                    </tr>
                    <tr>
                      <td className="pr-2 font-bold text-gray-700 py-0.5">Date:</td>
                      <td className="font-bold text-black py-0.5">{formatDateDisplay(voucher.date)}</td>
                    </tr>
                    {voucher.referenceNo && (
                      <tr>
                        <td className="pr-2 font-bold text-gray-700 py-0.5">Ref No:</td>
                        <td className="font-medium text-black py-0.5">{voucher.referenceNo}</td>
                      </tr>
                    )}
                    {voucher.series && (
                      <tr>
                        <td className="pr-2 font-bold text-gray-700 py-0.5">Series:</td>
                        <td className="font-medium text-black py-0.5">{voucher.series}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Line Items Accounting Table */}
            <div>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-black font-bold">
                    <th className="border-r border-black p-2 text-center w-12">#</th>
                    <th className="border-r border-black p-2 text-center w-16">Dr / Cr</th>
                    <th className="border-r border-black p-2 text-left">Particulars / Account Head</th>
                    <th className="border-r border-black p-2 text-right w-32">Debit (₹)</th>
                    <th className="p-2 text-right w-32">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="border-r border-black p-2 text-center text-gray-700 font-mono">
                        {idx + 1}
                      </td>
                      <td className="border-r border-black p-2 text-center font-bold">
                        <span className={line.type === 'DR' ? 'text-blue-900' : 'text-emerald-900'}>
                          {line.type}
                        </span>
                      </td>
                      <td className="border-r border-black p-2 text-left font-semibold text-black">
                        {line.ledgerName || 'Account Ledger'}
                      </td>
                      <td className="border-r border-black p-2 text-right font-mono font-medium text-black">
                        {line.type === 'DR' ? line.amount.toFixed(2) : ''}
                      </td>
                      <td className="p-2 text-right font-mono font-medium text-black">
                        {line.type === 'CR' ? line.amount.toFixed(2) : ''}
                      </td>
                    </tr>
                  ))}
                  {/* Minimum padding rows if lines are few */}
                  {voucher.lines.length < 3 &&
                    Array.from({ length: 3 - voucher.lines.length }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-gray-200">
                        <td className="border-r border-black p-2 text-center">&nbsp;</td>
                        <td className="border-r border-black p-2 text-center">&nbsp;</td>
                        <td className="border-r border-black p-2">&nbsp;</td>
                        <td className="border-r border-black p-2">&nbsp;</td>
                        <td className="p-2">&nbsp;</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-black font-black">
                    <td colSpan={3} className="border-r border-black p-2 text-right uppercase tracking-wider">
                      TOTAL (₹)
                    </td>
                    <td className="border-r border-black p-2 text-right font-mono text-black">
                      ₹{voucher.totalDebit.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono text-black">
                      ₹{voucher.totalCredit.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Amount in words & Narration */}
            <div className="border border-black p-3 rounded-xs space-y-1.5 bg-gray-50">
              <div className="text-xs">
                <span className="font-bold text-gray-700">Amount in Words: </span>
                <span className="font-semibold text-black italic">
                  {numberToIndianWords(voucher.totalDebit)}
                </span>
              </div>
              {voucher.narration && (
                <div className="text-xs pt-1 border-t border-gray-300">
                  <span className="font-bold text-gray-700">Narration / Remarks: </span>
                  <span className="text-gray-900">{voucher.narration}</span>
                </div>
              )}
            </div>

            {/* Signature Blocks */}
            <div className="pt-12 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="border-t border-black pt-1.5 font-bold text-xs text-gray-800">
                  Prepared By
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-1.5 font-bold text-xs text-gray-800">
                  Checked / Verified By
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-1.5 font-bold text-xs text-gray-800">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
