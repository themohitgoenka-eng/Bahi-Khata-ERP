import { QueryClient } from '@tanstack/react-query';

// Central TanStack Query client for offline-first server-state management.
// networkMode 'offlineFirst' => queries/mutations run from cache while offline
// and automatically resume/refetch when connectivity returns.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 min fresh
      gcTime: 1000 * 60 * 60 * 24, // keep 24h so persisted cache survives reloads
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 3,
    },
  },
});
