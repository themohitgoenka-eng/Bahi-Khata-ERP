import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Trash2,
  X,
  ShieldAlert,
  Save,
  Plus,
  Edit3,
} from 'lucide-react';

export type ConfirmationType = 'ADD' | 'EDIT' | 'DELETE' | 'WARNING' | 'INFO' | 'DUPLICATE_ERROR';

export interface ConfirmationModalProps {
  isOpen: boolean;
  type?: ConfirmationType;
  title: string;
  message: string;
  itemDetails?: { label: string; value: string | number }[];
  details?: { label: string; value: string | number }[];
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  type = 'INFO',
  title,
  message,
  itemDetails,
  details,
  confirmLabel,
  confirmText,
  cancelLabel = 'Cancel',
  cancelText,
  onConfirm,
  onCancel,
  onClose,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleCancel = onCancel || onClose || (() => {});
  const displayDetails = itemDetails || details;
  const displayConfirmLabel = confirmText || confirmLabel;
  const displayCancelLabel = cancelText || cancelLabel;

  const isDelete = type === 'DELETE';
  const isAdd = type === 'ADD';
  const isEdit = type === 'EDIT';
  const isDuplicateError = type === 'DUPLICATE_ERROR';
  const isWarning = type === 'WARNING' || isDuplicateError;

  const [activeBtn, setActiveBtn] = React.useState<'confirm' | 'cancel'>('confirm');
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);
  const cancelBtnRef = React.useRef<HTMLButtonElement>(null);

  // Auto-focus confirm button on open
  React.useEffect(() => {
    if (isOpen) {
      setActiveBtn('confirm');
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDuplicateError) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (activeBtn === 'confirm') {
        setActiveBtn('cancel');
        cancelBtnRef.current?.focus();
      } else {
        setActiveBtn('confirm');
        confirmBtnRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    }
  };

  const getHeaderIcon = () => {
    switch (type) {
      case 'DELETE':
        return <Trash2 className="w-5 h-5 text-rose-400" />;
      case 'ADD':
        return <Plus className="w-5 h-5 text-emerald-400" />;
      case 'EDIT':
        return <Edit3 className="w-5 h-5 text-amber-400" />;
      case 'DUPLICATE_ERROR':
        return <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-sky-400" />;
    }
  };

  const getHeaderBadge = () => {
    switch (type) {
      case 'DELETE':
        return { text: 'CONFIRM DELETION', bg: 'bg-rose-950/80 text-[#FF647C] border-rose-800' };
      case 'ADD':
        return { text: 'CONFIRM ADDITION', bg: 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border-[#2588E8]/30' };
      case 'EDIT':
        return { text: 'CONFIRM MODIFICATION', bg: 'bg-amber-950/80 text-[#F2C94C] border-amber-800' };
      case 'DUPLICATE_ERROR':
        return { text: 'DUPLICATE BLOCKED', bg: 'bg-rose-950 text-[#FF647C] border-rose-800' };
      case 'WARNING':
        return { text: 'CONFIRMATION REQUIRED', bg: 'bg-amber-950 text-[#F2C94C] border-amber-800' };
      default:
        return { text: 'SYSTEM PROMPT', bg: 'bg-[rgba(18,48,76,0.48)] text-[#2588E8] border-[#2588E8]/30' };
    }
  };

  const getConfirmButtonClasses = () => {
    if (isDelete) {
      return 'bg-[#FF647C] hover:bg-[#e4adac] text-[#FFFFFF] font-bold shadow-md';
    }
    if (isAdd) {
      return 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold shadow-md';
    }
    if (isEdit) {
      return 'bg-[#F2C94C] hover:bg-[#edd4a6] text-[#FFFFFF] font-bold shadow-md';
    }
    if (isDuplicateError) {
      return 'bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#FFFFFF] border border-[rgba(112,185,245,0.25)]';
    }
    return 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold';
  };

  const badge = getHeaderBadge();

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono animate-in fade-in duration-150"
    >
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-[#FFFFFF]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)]">
              {getHeaderIcon()}
            </div>
            <div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badge.bg}`}>
                {badge.text}
              </span>
              <h3 className="font-bold text-[#FFFFFF] text-sm mt-0.5 tracking-tight">{title}</h3>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-[#7F98AE] hover:text-[#FFFFFF] p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 text-xs">
          <p className="text-[#B7C9D9] leading-relaxed font-sans text-[13px]">{message}</p>

          {/* Key Value Details Box */}
          {displayDetails && displayDetails.length > 0 && (
            <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl p-3 space-y-1.5 font-mono text-[11px]">
              {displayDetails.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 border-b border-[rgba(112,185,245,0.25)] last:border-0">
                  <span className="text-[#7F98AE]">{detail.label}:</span>
                  <span className="text-[#FFFFFF] font-bold max-w-[220px] truncate text-right">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          {isDelete && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-[10px] text-[#FF647C] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#FF647C]" />
              <span>This record will be removed from the active dataset with an audit log.</span>
            </div>
          )}

          {isDuplicateError && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-[11px] text-[#FF647C] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#FF647C] mt-0.5" />
              <span>Duplicate records violate data integrity rules. Please change the year or name.</span>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 border-t border-[rgba(112,185,245,0.25)] flex items-center justify-end gap-2.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
          <button
            ref={confirmBtnRef}
            type="button"
            tabIndex={0}
            onFocus={() => setActiveBtn('confirm')}
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md ${getConfirmButtonClasses()} ${
              activeBtn === 'confirm'
                ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#081A2D] scale-[1.03] shadow-lg shadow-emerald-500/25'
                : ''
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAdd && <CheckCircle2 className="w-3.5 h-3.5" />}
            {isEdit && <Save className="w-3.5 h-3.5" />}
            {isDelete && <Trash2 className="w-3.5 h-3.5" />}
            <span>
              {displayConfirmLabel ||
                (isDuplicateError
                  ? 'OK, Understood'
                  : isDelete
                  ? 'Yes, Delete'
                  : isAdd
                  ? 'Yes, Add'
                  : type === 'WARNING'
                  ? 'OK'
                  : 'Yes, Update')}
            </span>
          </button>
          {!isDuplicateError && (
            <button
              ref={cancelBtnRef}
              type="button"
              tabIndex={0}
              onFocus={() => setActiveBtn('cancel')}
              onClick={handleCancel}
              disabled={isLoading}
              className={`px-3.5 py-1.5 text-xs transition cursor-pointer font-medium rounded-xl border ${
                activeBtn === 'cancel'
                  ? 'ring-2 ring-slate-400 ring-offset-2 ring-offset-[#081A2D] bg-[rgba(57,167,255,0.25)] text-white border-[rgba(112,185,245,0.4)]'
                  : 'text-[#B7C9D9] hover:text-[#FFFFFF] bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] border-[rgba(112,185,245,0.25)]'
              }`}
            >
              {displayCancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
