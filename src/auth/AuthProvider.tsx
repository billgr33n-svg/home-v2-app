import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { isUsable } from './session';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** True when we dropped the user to sign-in because their token died. */
  expired: boolean;
  clearExpired: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Session handling, with one rule: never hand a dead token to the rest of the app.
 *
 * A stale JWT does not produce an error. supabase-js falls back to the anon key,
 * RLS sees `anon`, PostgREST returns `200 []`, and every screen renders its empty
 * state over real data. That bug cost a day of debugging on 2026-07-09. See
 * ./session.ts for the reasoning; the defences are:
 *
 *   1. `isUsable()` gates the session before it reaches consumers. An expired
 *      session is reported as no session, so `Root` routes to sign-in.
 *   2. A watchdog re-validates on mount, on app foreground, and on web tab focus.
 *      The autoRefreshToken timer does not fire in a backgrounded browser tab, so
 *      returning to the tab after an hour is exactly when this used to break.
 *   3. On sign-out (voluntary or forced) the React Query cache is cleared. Without
 *      this the header keeps rendering the household name from a stale cache, and
 *      the app looks signed in while showing nothing.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const forcing = useRef(false);

  const forceSignOut = useCallback(async (wasExpired: boolean) => {
    if (forcing.current) return;
    forcing.current = true;
    try {
      await supabase.auth.signOut();
    } catch {
      // Signing out of a session the server already rejected is not an error.
    } finally {
      queryClient.clear();
      setSession(null);
      setExpired(wasExpired);
      forcing.current = false;
    }
  }, []);

  /** Validate what we hold; refresh if we can; sign out if we cannot. */
  const revalidate = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const current = data.session;

    if (!current) {
      setSession(null);
      return;
    }
    if (isUsable(current)) {
      setSession(current);
      return;
    }

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session || !isUsable(refreshed.session)) {
      await forceSignOut(true);
      return;
    }
    setSession(refreshed.session);
  }, [forceSignOut]);

  useEffect(() => {
    void revalidate().finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || !next) {
        queryClient.clear();
        setSession(null);
        return;
      }
      if (event === 'SIGNED_IN') setExpired(false);
      // Guard here too: getSession() has been observed handing back a stale
      // session rather than refusing it.
      setSession(isUsable(next) ? next : null);
    });

    return () => sub.subscription.unsubscribe();
  }, [revalidate]);

  // Re-check whenever the app comes back to the foreground. A backgrounded web
  // tab or a suspended phone misses the library's refresh timer entirely.
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const onVisible = () => {
        if (document.visibilityState === 'visible') void revalidate();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void revalidate();
    });
    return () => sub.remove();
  }, [revalidate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: isUsable(session) ? session : null,
      loading,
      expired,
      clearExpired: () => setExpired(false),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setExpired(false);
      },
      signUp: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await forceSignOut(false);
      },
    }),
    [session, loading, expired, forceSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
