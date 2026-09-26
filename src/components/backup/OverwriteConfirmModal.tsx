import React from 'react';
import { AlertTriangle, X, RefreshCw, Folder, FileCode } from 'lucide-react';

interface OverwriteConfirmModalProps {
  isOpen: boolean;
  filename: string;
  folderName: string;
  fyFolderName: string;
  fullPath?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OverwriteConfirmModal: React.FC<OverwriteConfirmModalProps> = ({
  isOpen,
  filename,
  folderName,
  fyFolderName,
  fullPath,
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0B1E16] border border-amber-600/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-amber-600/30 flex items-center justify-between bg-[#1B1A0E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-700/60 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Confirm File Overwrite
              </h2>
              <p className="text-[11px] text-amber-300/80">
                Backup file already exists
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-2">
            <div className="text-xs text-amber-200 leading-relaxed">
              A backup file with the exact name already exists in this financial year folder:
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Folder:</span>
                <span className="font-semibold text-white">{folderName} / {fyFolderName}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span className="text-slate-400 text-[11px]">File:</span>
                <span className="font-bold underline">{filename}</span>
              </div>
              {fullPath && (
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 truncate">
                  {fullPath}
                </div>
              )}
            </div>

            <p className="text-[11px] text-amber-300/90 pt-1 leading-snug">
              Replacing will overwrite the existing file with the latest backup data. This action cannot be reversed.
            </p>
          </div>

          <p className="text-xs text-slate-300 font-medium">
            Do you want to overwrite and replace this file?
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Overwriting...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replace File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
