import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '../lib/queryClient';
import { asyncStoragePersister } from '../lib/queryPersister';

// Wraps the app with an offline-first, IndexedDB-persisted TanStack Query cache.
// On restore, any mutations that were paused while offline are resumed.
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
      onSuccess={() => {
        // Resume any mutations that were queued while the device was offline
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries();
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
