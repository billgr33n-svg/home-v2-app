import { supabase } from '../lib/supabase';

/**
 * The client's entire view of a Google Calendar connection.
 *
 * `calendar_connections` has RLS on, zero policies, and zero grants to
 * `authenticated` (migrations 0021 + 0023). The app literally cannot select from
 * it. Everything below goes through `my_calendar_connections()` or an Edge
 * Function running as `service_role`.
 *
 * There is deliberately no `credential_ref` on this type. The refresh token, and
 * even the pointer to it, never leave the server.
 */
export interface CalendarConnection {
  id: string;
  provider: string;
  accountEmail: string | null;
  shareMode: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export async function fetchMyCalendarConnection(): Promise<CalendarConnection | null> {
  const { data, error } = await supabase.rpc('my_calendar_connections');
  if (error) throw error;

  const row = (data ?? [])[0];
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    accountEmail: row.external_account_id,
    shareMode: row.share_mode,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

/**
 * Start the handshake.
 *
 * The function returns a URL rather than redirecting, because the browser must
 * do the navigating: this is a top-level redirect to accounts.google.com, not an
 * XHR. Google will bounce back to the callback Edge Function, which bounces to
 * `/?calendar=connected`.
 *
 * The first person to connect will see "Google hasn't verified this app."
 * That is expected -- see GOOGLE_CALENDAR_SETUP.md. Advanced -> Go to Home v2.
 */
export async function beginGoogleConnect(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('google-calendar-connect', {
    body: {},
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start the Google connection.');
  return data.url;
}

export interface SyncResult {
  calendars: number;
  upserted: number;
  removed: number;
}

export async function syncGoogleCalendar(): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke<SyncResult & { error?: string }>('google-calendar-sync', {
    body: {},
  });
  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  return data as SyncResult;
}

export interface DisconnectResult {
  ok: boolean;
  revokedAtGoogle?: boolean;
  eventsRemoved?: number;
  note?: string;
}

export async function disconnectGoogleCalendar(): Promise<DisconnectResult> {
  const { data, error } = await supabase.functions.invoke<DisconnectResult>('google-calendar-disconnect', {
    body: {},
  });
  if (error) throw error;
  return data as DisconnectResult;
}

/**
 * The callback redirects to `/?calendar=connected` or `/?calendar=error&reason=…`.
 * Read it once on mount, then strip it so a refresh does not re-announce.
 */
export type CalendarCallbackStatus =
  | { kind: 'none' }
  | { kind: 'connected' }
  | { kind: 'error'; message: string };

const REASON_TEXT: Record<string, string> = {
  declined: 'You cancelled at the Google screen. Nothing was connected.',
  expired_link: 'That connection link expired. Start again.',
  no_refresh_token: 'Google did not return a durable token. Try again, and pick your account fresh.',
  state_check_failed: 'We could not verify that request came from you. Start again.',
  save_failed: 'Google said yes, but we could not save the connection.',
  bad_request: 'Google sent us something we did not understand.',
  unexpected: 'Something went wrong connecting your calendar.',
};

export function readCalendarCallback(): CalendarCallbackStatus {
  if (typeof window === 'undefined') return { kind: 'none' };

  const params = new URLSearchParams(window.location.search);
  const status = params.get('calendar');
  if (!status) return { kind: 'none' };

  // Do not let a stale query string re-fire on every refresh.
  params.delete('calendar');
  const reason = params.get('reason');
  params.delete('reason');
  const rest = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));

  if (status === 'connected') return { kind: 'connected' };
  return { kind: 'error', message: REASON_TEXT[reason ?? 'unexpected'] ?? REASON_TEXT.unexpected };
}
