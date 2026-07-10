import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isAuthError } from '../auth/session';
import { supabase } from './supabase';

/**
 * Last line of defence for the dead-token bug.
 *
 * The AuthProvider watchdog catches expiry before a request goes out. If one
 * slips through anyway -- the token dies mid-flight, the refresh token is
 * revoked server-side -- PostgREST answers 401/PGRST301 and we sign out rather
 * than let the user stare at an empty list. `onAuthStateChange` then routes to
 * the sign-in screen.
 *
 * Note this does NOT catch the `200 []` case: by then the request has already
 * succeeded as `anon`. Nothing at this layer can. That is why the real gate
 * lives in AuthProvider and this is only a backstop.
 */
function handleAuthFailure(error: unknown) {
  if (!isAuthError(error)) return;
  void supabase.auth.signOut();
}

// Conservative defaults for a coordination app: short stale window so household
// state feels live, bounded retries so a backend outage degrades gracefully
// rather than hammering.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthFailure }),
  mutationCache: new MutationCache({ onError: handleAuthFailure }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Never burn retries on a request that failed because we are not signed in.
      retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
