import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderCheck,
  Download,
  X,
  AlertCircle,
  HardDrive,
  MapPin,
} from 'lucide-react';
import {
  isDirectoryPickerSupported,
  pickBackupDirectory,
  saveDirectoryHandle,
  getSavedDirectoryHandle,
  isAlwaysSaveEnabled,
  setAlwaysSaveEnabled,
  getSavedFolderName,
  getSavedFolderFullPath,
  setSavedFolderFullPath,
  isAutoBackupAtExitEnabled,
  setAutoBackupAtExitEnabled,
} from '../../services/backupStorageLocationService';
import { backupService } from '../../services/backupService';
import { useApp } from '../../context/AppContext';
import { OverwriteConfirmModal } from './OverwriteConfirmModal';

interface BackupLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupSuccess?: (folderName: string, filename: string) => void;
}

export const BackupLocationModal: React.FC<BackupLocationModalProps> = ({
  isOpen,
  onClose,
  onBackupSuccess,
}) => {
  const { showNotification } = useApp();

  const [currentHandle, setCurrentHandle] = useState<any>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [fullPath, setFullPath] = useState<string>('');
  const [showTickbox, setShowTickbox] = useState<boolean>(false);
  const [alwaysSave, setAlwaysSave] = useState<boolean>(false);
  const [autoBackupAtExit, setAutoBackupAtExit] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Overwrite confirm modal state
  const [overwriteModalOpen, setOverwriteModalOpen] = useState<boolean>(false);
  const [overwriteTarget, setOverwriteTarget] = useState<{
    filename: string;
    folderName: string;
    fyFolderName: string;
  } | null>(null);

  const supported = isDirectoryPickerSupported();

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setOverwriteModalOpen(false);
      setOverwriteTarget(null);
      setAutoBackupAtExit(isAutoBackupAtExitEnabled());

      const savedPath = getSavedFolderFullPath();
      if (savedPath) {
        setFullPath(savedPath);
      }

      // Check if previously saved folder exists
      getSavedDirectoryHandle().then((saved) => {
        if (saved && saved.handle) {
          setCurrentHandle(saved.handle);
          const name = saved.folderName || 'Saved Folder';
          setFolderName(name);
          if (!savedPath) {
            const defaultPath = `C:\\Users\\KMC PC\\Desktop\\${name}`;
            setFullPath(defaultPath);
            setSavedFolderFullPath(defaultPath);
          }
          setAlwaysSave(isAlwaysSaveEnabled());
          setShowTickbox(false);
        } else {
          const fallbackName = getSavedFolderName();
          setCurrentHandle(null);
          setFolderName(fallbackName || null);
          setShowTickbox(false);
          setAlwaysSave(false);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    setErrorMsg(null);
    try {
      const { handle, folderName: name } = await pickBackupDirectory();
      setCurrentHandle(handle);
      setFolderName(name);

      const generatedPath = `C:\\Users\\KMC PC\\Desktop\\${name}`;
      setFullPath(generatedPath);
      setSavedFolderFullPath(generatedPath);

      // Show checkbox after folder is selected
      setShowTickbox(true);
      setAlwaysSave(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Failed to select folder.');
      }
    }
  };

  const handleExecuteBackup = async (forceOverwrite: boolean = false) => {
    if (!currentHandle && supported) {
      setErrorMsg('Please select a storage folder first.');
      return;
    }

    setIsBackingUp(true);
    setErrorMsg(null);

    try {
      if (supported && currentHandle) {
        // Save to chosen directory handle with overwrite check
        const result = await backupService.saveBackupToDirectoryHandle(currentHandle, {
          overwriteConfirmed: forceOverwrite,
        });

        // If file already exists and overwrite not yet confirmed, prompt user
        if (result.requiresOverwriteConfirm) {
          setOverwriteTarget({
            filename: result.filename,
            folderName: result.folderName,
            fyFolderName: result.fyFolderName,
          });
          setOverwriteModalOpen(true);
          setIsBackingUp(false);
          return;
        }

        if (alwaysSave) {
          await saveDirectoryHandle(currentHandle, result.folderName);
          setAlwaysSaveEnabled(true);
        } else {
          setAlwaysSaveEnabled(false);
        }

        if (fullPath) {
          setSavedFolderFullPath(fullPath);
        }

        showNotification(
          `Backup dataset saved to "${result.fyFolderName}/${result.filename}" successfully.`,
          'success'
        );
        if (onBackupSuccess) {
          onBackupSuccess(result.folderName, result.filename);
        }
      } else {
        // Fallback browser download
        await backupService.createFullBackup();
        showNotification('Backup dataset downloaded successfully.', 'success');
      }

      setOverwriteModalOpen(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleConfirmOverwrite = async () => {
    await handleExecuteBackup(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(2,10,18,0.72)] backdrop-blur-sm backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-[#0B1E16] border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-200">
          {/* Modal Header */}
          <div className="px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between bg-[rgba(18,48,76,0.48)] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#17382B] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center shadow-inner">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Backup Storage Location
                </h2>
                <p className="text-[11px] text-[#2588E8]">
                  Select folder on your computer to save backup
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[rgba(112,185,245,0.1)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {supported ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Selected Storage Location
                  </label>

                  {folderName ? (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-800/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FolderCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-mono font-bold text-emerald-300 truncate block">
                              {folderName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Selected root backup folder
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSelectFolder}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer shrink-0"
                        >
                          Change Location
                        </button>
                      </div>

                      {/* Full location path displayed as requested */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Full Location Path
                        </span>
                        <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-700 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <input
                            type="text"
                            value={fullPath}
                            onChange={(e) => {
                              setFullPath(e.target.value);
                              setSavedFolderFullPath(e.target.value);
                            }}
                            placeholder="e.g. C:\Users\KMC PC\Desktop\Backups"
                            className="w-full bg-transparent text-emerald-300 font-mono text-xs focus:outline-none"
                            title="Full folder storage path"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 border-dashed text-center space-y-2.5">
                      <Folder className="w-8 h-8 text-amber-400/80 mx-auto" />
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          No folder selected yet
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Please choose a folder where your backup file should be saved.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectFolder}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Select Folder</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Tickbox: Appears after folder is selected / changed */}
                {showTickbox && folderName && (
                  <div className="p-3 rounded-xl bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] animate-in fade-in duration-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alwaysSave}
                        onChange={(e) => setAlwaysSave(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-200 leading-snug">
                        Always Save Backup File In Selected Folder.
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1 pl-6.5">
                      When ticked, clicking the Backup button next time will automatically save the file directly inside the financial year folder in &quot;{folderName}&quot;.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                <p className="text-slate-300 font-semibold">
                  Direct Folder Saving Not Supported
                </p>
                <p className="text-slate-400 text-[11px]">
                  Your current browser does not support the File System Access API. Clicking Backup will download the file to your computer&apos;s standard Downloads folder.
                </p>
              </div>
            )}
          </div>

          {/* Modal Footer with Always-Visible Auto Backup At Exit Checkbox before Cancel */}
          <div className="px-5 py-3 border-t border-[rgba(112,185,245,0.25)] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Always Visible: Auto Backup At Exit */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoBackupAtExit}
                onChange={(e) => {
                  setAutoBackupAtExit(e.target.checked);
                  setAutoBackupAtExitEnabled(e.target.checked);
                }}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200">
                Auto Backup At Exit
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isBackingUp}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleExecuteBackup(false)}
                disabled={isBackingUp || (supported && !currentHandle)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2588E8] hover:bg-[#39A7FF] disabled:bg-slate-800 disabled:text-slate-500 text-[#FFFFFF] font-bold text-xs rounded-lg transition shadow cursor-pointer disabled:cursor-not-allowed"
              >
                {isBackingUp ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
                    <span>Saving Backup...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overwrite Confirmation Dialog */}
      {overwriteTarget && (
        <OverwriteConfirmModal
          isOpen={overwriteModalOpen}
          filename={overwriteTarget.filename}
          folderName={overwriteTarget.folderName}
          fyFolderName={overwriteTarget.fyFolderName}
          fullPath={
            fullPath
              ? `${fullPath}\\${overwriteTarget.fyFolderName}\\${overwriteTarget.filename}`
              : undefined
          }
          isProcessing={isBackingUp}
          onConfirm={handleConfirmOverwrite}
          onCancel={() => {
            setOverwriteModalOpen(false);
            setOverwriteTarget(null);
          }}
        />
      )}
    </>
  );
};
