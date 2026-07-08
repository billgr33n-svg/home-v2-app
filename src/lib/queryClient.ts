import { QueryClient } from '@tanstack/react-query';

// Shared TanStack Query client. Conservative defaults for a coordination app:
// short stale window so household state feels live, bounded retries so a
// backend outage degrades gracefully rather than hammering.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
