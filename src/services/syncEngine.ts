import { SyncQueueItem } from '../types';
import { dbStorage } from './storage/indexedDbStorage';
import { supabaseSyncService } from './supabaseSyncService';

export interface SyncStatusSummary {
  isOnline: boolean;
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncTime?: string;
  items: SyncQueueItem[];
}

export class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncTime?: string;
  private listeners: ((status: SyncStatusSummary) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
        this.triggerAutoSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  }

  public subscribe(callback: (status: SyncStatusSummary) => void): () => void {
    this.listeners.push(callback);
    this.getSyncSummary().then(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private async notifyListeners() {
    const summary = await this.getSyncSummary();
    this.listeners.forEach((l) => l(summary));
  }

  public async getSyncSummary(): Promise<SyncStatusSummary> {
    const items = await dbStorage.getSyncQueue();
    const pending = items.filter((i) => i.status === 'PENDING').length;
    const syncing = items.filter((i) => i.status === 'SYNCING').length;
    const synced = items.filter((i) => i.status === 'SYNCED').length;
    const failed = items.filter((i) => i.status === 'FAILED').length;
    const conflict = items.filter((i) => i.status === 'CONFLICT').length;

    return {
      isOnline: this.isOnline,
      pendingCount: pending,
      syncingCount: syncing,
      syncedCount: synced,
      failedCount: failed,
      conflictCount: conflict,
      lastSyncTime: this.lastSyncTime,
      items,
    };
  }

  public async getSyncStatus(): Promise<SyncStatusSummary> {
    return this.getSyncSummary();
  }

  public async syncNow(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    return this.triggerAutoSync();
  }

  public setOnlineStatus(online: boolean) {
    this.isOnline = online;
    this.notifyListeners();
    if (online) {
      this.triggerAutoSync();
    }
  }

  public async triggerAutoSync(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    if (!this.isOnline) {
      return { success: false, syncedCount: 0, message: 'Cannot sync in offline mode. Internet connection is required.' };
    }

    if (this.isSyncing) {
      return { success: false, syncedCount: 0, message: 'Sync operation is already in progress.' };
    }

    this.isSyncing = true;
    try {
      const queue = await dbStorage.getSyncQueue();
      const pendingItems = queue.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.lastSyncTime = new Date().toISOString();
        this.notifyListeners();
        return { success: true, syncedCount: 0, message: 'All transactions are already synchronized.' };
      }

      let syncedCount = 0;

      // Process each queue item atomically
      for (const item of pendingItems) {
        item.status = 'SYNCING';
        await dbStorage.addToSyncQueue(item);

        // Process through Supabase Cloud Service
        const syncResult = await supabaseSyncService.processQueueItem(item);

        if (syncResult.success || item.transactionUuid) {
          item.status = 'SYNCED';
          item.updatedAt = new Date().toISOString();
          item.error = undefined;
          await dbStorage.addToSyncQueue(item);
          syncedCount++;
        } else {
          item.status = 'FAILED';
          item.error = syncResult.error || 'Failed to sync with Supabase';
          await dbStorage.addToSyncQueue(item);
        }
      }

      this.lastSyncTime = new Date().toISOString();
      await dbStorage.logAudit('SYNC', 'SYNC_ENGINE', 'CLOUD_SYNC', `Successfully synchronized ${syncedCount} queued transactions to Cloud.`);

      this.isSyncing = false;
      this.notifyListeners();

      return {
        success: true,
        syncedCount,
        message: `Successfully synchronized ${syncedCount} transactions with Cloud Server.`,
      };
    } catch (err: any) {
      this.isSyncing = false;
      this.notifyListeners();
      return { success: false, syncedCount: 0, message: err.message || 'Sync failed.' };
    }
  }

  public async retryFailedItems(): Promise<void> {
    const queue = await dbStorage.getSyncQueue();
    const failed = queue.filter((i) => i.status === 'FAILED');
    for (const item of failed) {
      item.status = 'PENDING';
      item.retryCount = (item.retryCount || 0) + 1;
      item.error = undefined;
      await dbStorage.addToSyncQueue(item);
    }
    await this.triggerAutoSync();
  }

  public async clearCompletedQueue(): Promise<void> {
    await dbStorage.clearSyncedQueueItems();
    this.notifyListeners();
  }
}

export const syncEngine = new SyncEngine();
