import localforage from 'localforage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// IndexedDB-backed store (via localForage) used to persist the TanStack Query
// cache. This is the primary client-side persistent storage for server-state,
// enabling the app to render cached data instantly on cold start while offline.
const rqStore = localforage.createInstance({
  name: 'bahi-khata',
  storeName: 'react_query_cache',
  description: 'TanStack Query offline cache (IndexedDB)',
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: {
    getItem: (key: string) => rqStore.getItem<string>(key),
    setItem: (key: string, value: string) => rqStore.setItem(key, value),
    removeItem: (key: string) => rqStore.removeItem(key),
  },
  key: 'BAHI_KHATA_RQ_CACHE',
  throttleTime: 1000,
});
