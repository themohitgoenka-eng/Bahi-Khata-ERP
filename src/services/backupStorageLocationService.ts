/**
 * Service to manage local backup storage directory handle & user preference.
 * Uses browser File System Access API (showDirectoryPicker) and persists handle in IndexedDB.
 */

const DB_NAME = 'BahiKhata_Backup_Config';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'backup_directory_handle';

const KEY_ALWAYS_SAVE = 'bahi_khata_always_save_backup_folder';
const KEY_FOLDER_NAME = 'bahi_khata_backup_folder_name';

const openBackupConfigDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const isDirectoryPickerSupported = (): boolean => {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
};

export const pickBackupDirectory = async (): Promise<{ handle: any; folderName: string }> => {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Your browser does not support folder picker. Please use Google Chrome or Microsoft Edge.');
  }
  const handle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents',
  });
  return {
    handle,
    folderName: handle.name || 'Selected Folder',
  };
};

export const saveDirectoryHandle = async (handle: any, folderName: string): Promise<void> => {
  try {
    const db = await openBackupConfigDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem(KEY_FOLDER_NAME, folderName);
  } catch (err) {
    console.warn('Could not persist directory handle to IndexedDB:', err);
    localStorage.setItem(KEY_FOLDER_NAME, folderName);
  }
};

export const getSavedDirectoryHandle = async (): Promise<{ handle: any; folderName: string | null } | null> => {
  const folderName = localStorage.getItem(KEY_FOLDER_NAME);
  try {
    const db = await openBackupConfigDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    const handle = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (handle) {
      return {
        handle,
        folderName: folderName || handle.name || 'Saved Folder',
      };
    }
  } catch (err) {
    console.warn('Failed to retrieve directory handle from IndexedDB:', err);
  }

  return null;
};

export const clearSavedDirectoryHandle = async (): Promise<void> => {
  try {
    const db = await openBackupConfigDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear directory handle from IndexedDB:', err);
  }
  localStorage.removeItem(KEY_FOLDER_NAME);
  localStorage.removeItem(KEY_ALWAYS_SAVE);
};

export const isAlwaysSaveEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY_ALWAYS_SAVE) === 'true';
};

export const setAlwaysSaveEnabled = (enabled: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_ALWAYS_SAVE, enabled ? 'true' : 'false');
};

export const getSavedFolderName = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEY_FOLDER_NAME);
};

const KEY_FOLDER_FULL_PATH = 'bahi_khata_backup_folder_full_path';
const KEY_AUTO_BACKUP_AT_EXIT = 'bahi_khata_auto_backup_at_exit';

export const getSavedFolderFullPath = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEY_FOLDER_FULL_PATH);
};

export const setSavedFolderFullPath = (path: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_FOLDER_FULL_PATH, path);
};

export const isAutoBackupAtExitEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY_AUTO_BACKUP_AT_EXIT) === 'true';
};

export const setAutoBackupAtExitEnabled = (enabled: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_AUTO_BACKUP_AT_EXIT, enabled ? 'true' : 'false');
};
