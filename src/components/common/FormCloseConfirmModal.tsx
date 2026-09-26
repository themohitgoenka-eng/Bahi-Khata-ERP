import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Save, X } from 'lucide-react';

export interface FormCloseConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirmSave: () => void | boolean | Promise<boolean | void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export const FormCloseConfirmModal: React.FC<FormCloseConfirmModalProps> = ({
  isOpen,
  title = 'Save Changes Before Closing?',
  message = 'Do you want to save this form before closing?',
  onConfirmSave,
  onDiscard,
  onCancel,
}) => {
  const [activeBtnIndex, setActiveIndex] = useState<number>(2); // 0: cancel, 1: discard, 2: save

  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const discardBtnRef = useRef<HTMLButtonElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus save button on modal open and highlight it
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      const timer = setTimeout(() => {
        saveBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle arrow key navigation between the 3 buttons
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = activeBtnIndex === 0 ? 2 : activeBtnIndex - 1;
      setActiveIndex(nextIdx);
      if (nextIdx === 0) saveBtnRef.current?.focus();
      else if (nextIdx === 1) discardBtnRef.current?.focus();
      else cancelBtnRef.current?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = activeBtnIndex === 2 ? 0 : activeBtnIndex + 1;
      setActiveIndex(nextIdx);
      if (nextIdx === 0) saveBtnRef.current?.focus();
      else if (nextIdx === 1) discardBtnRef.current?.focus();
      else cancelBtnRef.current?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = (activeBtnIndex + 1) % 3;
      setActiveIndex(nextIdx);
      if (nextIdx === 0) saveBtnRef.current?.focus();
      else if (nextIdx === 1) discardBtnRef.current?.focus();
      else cancelBtnRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[999999999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
    >
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-[#FFFFFF] animate-in zoom-in-95 duration-100">
        <div className="px-5 py-3.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
              <p className="text-[10px] text-[#7F98AE] leading-tight">Escape key pressed &bull; Form closure confirmation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-[#7F98AE] hover:text-white hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <p className="text-[#C4D5C8] font-medium leading-relaxed">
            {message}
          </p>
          <div className="p-3 bg-[#0D231A] rounded-xl border border-[rgba(112,185,245,0.25)] text-[11px] text-[#7F98AE] space-y-1">
            <div>&bull; <strong className="text-emerald-300">Yes</strong>: Validate required fields, save data, and close form.</div>
            <div>&bull; <strong className="text-rose-300">No</strong>: Discard changes and close form immediately.</div>
            <div>&bull; <strong className="text-slate-300">Cancel</strong>: Stay on form and continue editing.</div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] flex items-center justify-end gap-2.5">
          <button
            ref={saveBtnRef}
            type="button"
            tabIndex={0}
            onFocus={() => setActiveIndex(0)}
            onClick={onConfirmSave}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              activeBtnIndex === 0
                ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#081A2D] bg-[#cbf3aa] hover:bg-[#d8f8bd] text-[#081A2D] shadow-lg shadow-emerald-500/25 scale-[1.03]'
                : 'bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF]'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Yes (Save &amp; Close)</span>
          </button>
          <button
            ref={discardBtnRef}
            type="button"
            tabIndex={0}
            onFocus={() => setActiveIndex(1)}
            onClick={onDiscard}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              activeBtnIndex === 1
                ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-[#081A2D] bg-rose-800 text-white border-rose-500 shadow-md shadow-rose-900/40'
                : 'bg-[#421d23] hover:bg-rose-900 text-[#fca5a5] border-rose-800/60'
            }`}
          >
            No (Discard)
          </button>
          <button
            ref={cancelBtnRef}
            type="button"
            tabIndex={0}
            onFocus={() => setActiveIndex(2)}
            onClick={onCancel}
            className={`px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer font-medium ${
              activeBtnIndex === 2
                ? 'ring-2 ring-slate-400 ring-offset-2 ring-offset-[#081A2D] bg-[rgba(57,167,255,0.25)] text-white'
                : 'text-[#7F98AE] hover:text-white hover:bg-[rgba(57,167,255,0.15)]'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
