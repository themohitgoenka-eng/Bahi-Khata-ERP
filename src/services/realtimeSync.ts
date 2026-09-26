import { getSupabaseClient } from './supabaseClient';
import { queryClient } from '../lib/queryClient';

// ---------------------------------------------------------------------------
// Supabase Realtime Sync
// Subscribes to Postgres change events for the active company and reconciles
// them into the local TanStack Query cache. When a remote change is received
// we invalidate the relevant caches and broadcast a DOM event so the app can
// refresh its currently-active dataset. Automatically re-subscribes on
// network reconnect.
// ---------------------------------------------------------------------------

export const REMOTE_CHANGE_EVENT = 'bahikhata:remote-change';

let channel: any = null;
let currentCompanyId: string | null = null;

export function startRealtime(companyId: string): void {
  const client = getSupabaseClient();
  if (!client || !companyId) return;
  if (channel && currentCompanyId === companyId) return; // already subscribed

  stopRealtime();
  currentCompanyId = companyId;

  try {
    channel = client
      .channel(`bahi-khata-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          // Reconcile remote change into local cache
          queryClient.invalidateQueries();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(REMOTE_CHANGE_EVENT, { detail: payload })
            );
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription failed:', err);
  }
}

export function stopRealtime(): void {
  const client = getSupabaseClient();
  if (channel && client) {
    try {
      client.removeChannel(channel);
    } catch {
      /* ignore */
    }
  }
  channel = null;
  currentCompanyId = null;
}

export function isRealtimeActive(): boolean {
  return channel !== null;
}

// Re-subscribe automatically when the device comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (currentCompanyId) {
      const id = currentCompanyId;
      // force fresh subscription
      stopRealtime();
      startRealtime(id);
    }
  });
}
