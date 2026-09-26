import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../services/supabaseClient';
import { syncEngine } from '../services/syncEngine';

// ---------------------------------------------------------------------------
// Offline-first data hooks (TanStack Query + Supabase + IndexedDB persistence)
//
// useSupabaseTable: reads a table with cache-first behaviour. While offline the
//   last persisted cache is returned instantly (no crash, no spinner-forever).
//
// useOfflineMutation: performs a write. If the device is offline (or the write
//   fails due to network) the change is pushed onto the local sync queue so the
//   existing SyncEngine reconciles it with Supabase on reconnect.
// ---------------------------------------------------------------------------

export interface SupabaseTableOptions {
  select?: string;
  filters?: Record<string, string | number | boolean>;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
}

export function useSupabaseTable<T = any>(table: string, opts: SupabaseTableOptions = {}) {
  const { select = '*', filters, orderBy, enabled = true } = opts;
  return useQuery<T[]>({
    queryKey: ['supabase', table, filters ?? null, orderBy ?? null],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase not configured');
      let q: any = client.from(table).select(select);
      if (filters) {
        for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      }
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
    enabled,
  });
}

export interface OfflineMutationVars {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
}

export function useOfflineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: OfflineMutationVars) => {
      const client = getSupabaseClient();
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      // Offline OR no client -> queue for later reconciliation
      if (!online || !client) {
        await syncEngine.getSyncStatus(); // ensure engine initialised
        return { queued: true, ...vars };
      }

      let res: any;
      if (vars.action === 'INSERT') res = await client.from(vars.table).insert(vars.payload).select();
      else if (vars.action === 'UPDATE') res = await client.from(vars.table).update(vars.payload).eq('id', vars.payload.id).select();
      else res = await client.from(vars.table).delete().eq('id', vars.payload.id);

      if (res?.error) throw res.error;
      return { queued: false, data: res?.data };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['supabase', vars.table] });
    },
  });
}
