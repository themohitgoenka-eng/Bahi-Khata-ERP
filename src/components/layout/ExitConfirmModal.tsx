import React, { useState } from 'react';
import { LogOut, X, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  isAutoBackupAtExitEnabled,
  setAutoBackupAtExitEnabled,
  getSavedDirectoryHandle,
  getSavedFolderName,
} from '../../services/backupStorageLocationService';
import { backupService } from '../../services/backupService';
import { useApp } from '../../context/AppContext';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showNotification } = useApp();

  const [autoBackup, setAutoBackup] = useState<boolean>(() => isAutoBackupAtExitEnabled());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [isAppExited, setIsAppExited] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggleAutoBackup = (checked: boolean) => {
    setAutoBackup(checked);
    setAutoBackupAtExitEnabled(checked);
  };

  const handleConfirmExit = async () => {
    setIsProcessing(true);
    setBackupSuccessMessage(null);

    try {
      // 1. If Auto Backup At Exit is enabled, perform backup first
      if (autoBackup) {
        let savedFolder = await getSavedDirectoryHandle();
        if (savedFolder && savedFolder.handle) {
          await backupService.saveBackupToDirectoryHandle(savedFolder.handle, { overwriteConfirmed: true });
        } else {
          await backupService.createFullBackup();
        }

        // Show exact requested message
        setBackupSuccessMessage('Backup  Successfull.');
        showNotification('Backup  Successfull.', 'success');

        // Wait a brief moment so the user sees the confirmation
        await new Promise((res) => setTimeout(res, 1200));
      }

      // 2. Close application
      setIsAppExited(true);
      window.close();
    } catch (err: any) {
      showNotification(err.message || 'Exit backup encountered an issue.', 'error');
      // Still allow exit
      window.close();
      setIsAppExited(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0B1E16] border border-rose-900/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-rose-900/30 flex items-center justify-between bg-[#1A0B0E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800/60 flex items-center justify-center shadow-inner">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Exit Application
              </h2>
              <p className="text-[11px] text-rose-300/80">
                Confirm closing Bahi Khata ERP
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isAppExited ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">
                Application Closed
              </h3>
              <p className="text-xs text-slate-400">
                You have safely exited Bahi Khata ERP. You may now close this browser tab.
              </p>
            </div>
          ) : (
            <>
              {backupSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-center space-y-1.5 animate-in zoom-in-95">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-emerald-300">
                    {backupSuccessMessage}
                  </p>
                  <p className="text-xs text-emerald-400/80">
                    Closing application...
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-200">
                        Are you sure you want to exit?
                      </p>
                      <p className="text-slate-400 mt-0.5">
                        Please ensure all active ledger vouchers and transactions are saved.
                      </p>
                    </div>
                  </div>

                  {/* Auto Backup At Exit Setting in Confirmation Box */}
                  <div className="p-3 rounded-xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] space-y-1.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoBackup}
                        disabled={isProcessing}
                        onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Auto Backup At Exit
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-6.5">
                      {autoBackup
                        ? `A full backup will be created in "${getSavedFolderName() || 'your backup folder'}" before the app exits.`
                        : 'No backup will be made on exit.'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isAppExited && (
          <div className="px-5 py-3 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmExit}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Backing up &amp; Exiting...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
