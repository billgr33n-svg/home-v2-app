// google-calendar-sync-cron
//
// Scheduled fan-out. pg_cron POSTs here once a day; this syncs EVERY active
// Google connection. The user-facing google-calendar-sync only ever touches the
// caller's own connection -- this is the "for the whole house, on a timer" twin.
//
// It runs as service_role and takes user_id / household_id straight from each
// connection row (not from a request body), which is safe precisely because no
// untrusted caller reaches here: the only way in is the x-cron-secret header,
// compared against a 64-char secret that lives only in Vault (read_cron_secret()).
//
// The per-connection body mirrors google-calendar-sync (bounded 13-month window,
// calendar allowlist, chunked bulk upsert, 410-requeue, cancelled soft-delete).
// If the two drift, reconcile deliberately -- they are meant to behave identically.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  corsHeaders, HttpError, json, refreshAccessToken, serviceClient, vaultRead,
} from '../_shared/google.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  recurrence?: string[];
}

interface Conn {
  id: string;
  user_id: string;
  household_id: string;
  credential_ref: string;
  sync_state: { syncTokens?: Record<string, string> } | null;
  share_mode: string;
  calendar_allowlist: string[] | null;
}

async function listCalendars(accessToken: string): Promise<string[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(502, 'could not list calendars');
  const body = await res.json();
  return (body.items ?? [])
    .filter((c: { selected?: boolean; deleted?: boolean }) => c.selected && !c.deleted)
    .map((c: { id: string }) => c.id);
}

async function listEvents(
  accessToken: string,
  calendarId: string,
  syncToken: string | undefined,
): Promise<{ events: GoogleEvent[]; nextSyncToken?: string; expired: boolean }> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    if (syncToken) {
      url.searchParams.set('syncToken', syncToken);
    } else {
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      const to = new Date();
      to.setMonth(to.getMonth() + 12);
      url.searchParams.set('timeMin', from.toISOString());
      url.searchParams.set('timeMax', to.toISOString());
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 410) return { events: [], expired: true };
    if (!res.ok) throw new HttpError(502, `google rejected the read: ${res.status}`);

    const body = await res.json();
    events.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    nextSyncToken = body.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, expired: false };
}

/** Sync one connection. Mirrors google-calendar-sync's per-connection core. */
async function syncConnection(svc: SupabaseClient, conn: Conn): Promise<{ upserted: number; removed: number }> {
  const accessToken = await refreshAccessToken(await vaultRead(svc, conn.credential_ref));

  const tokens: Record<string, string> = (conn.sync_state?.syncTokens ?? {}) as Record<string, string>;
  const allow = conn.calendar_allowlist ?? null;
  const selected = await listCalendars(accessToken);
  const calendars = allow && allow.length > 0 ? selected.filter((id) => allow.includes(id)) : selected;

  let upserted = 0;
  let removed = 0;

  for (const calendarId of calendars) {
    let result = await listEvents(accessToken, calendarId, tokens[calendarId]);
    if (result.expired) {
      delete tokens[calendarId];
      result = await listEvents(accessToken, calendarId, undefined);
    }

    const nowIso = new Date().toISOString();
    const rowsById = new Map<string, Record<string, unknown>>();

    for (const ev of result.events) {
      const key = {
        provider_connection_id: conn.id,
        provider_calendar_id: calendarId,
        provider_event_id: ev.id,
      };

      if (ev.status === 'cancelled') {
        const { count } = await svc
          .from('events')
          .update({ deleted_at: nowIso }, { count: 'exact' })
          .match(key)
          .is('deleted_at', null);
        removed += count ?? 0;
        continue;
      }

      const timed = Boolean(ev.start?.dateTime);
      rowsById.set(ev.id, {
        ...key,
        household_id: conn.household_id,
        creator_id: conn.user_id,
        source: 'google',
        title: ev.summary ?? '(no title)',
        description: ev.description ?? null,
        location_text: ev.location ?? null,
        starts_at: timed ? ev.start!.dateTime : null,
        ends_at: timed ? (ev.end?.dateTime ?? null) : null,
        all_day_start: timed ? null : (ev.start?.date ?? null),
        all_day_end: timed ? null : (ev.end?.date ?? null),
        timezone: ev.start?.timeZone ?? null,
        recurrence_rule: ev.recurrence?.[0] ?? null,
        privacy: conn.share_mode === 'private' ? 'private' : 'shared',
        status: ev.status === 'tentative' ? 'tentative' : 'confirmed',
        deleted_at: null,
        updated_at: nowIso,
      });
    }

    const rows = [...rowsById.values()];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await svc
        .from('events')
        .upsert(chunk, { onConflict: 'provider_connection_id,provider_calendar_id,provider_event_id' });
      if (!error) upserted += chunk.length;
    }

    if (result.nextSyncToken) tokens[calendarId] = result.nextSyncToken;
  }

  await svc
    .from('calendar_connections')
    .update({ sync_state: { syncTokens: tokens }, last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', conn.id);

  return { upserted, removed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const svc = serviceClient();

  // The only key in: a Vault secret shared with the pg_cron job. No user, no household.
  const presented = req.headers.get('x-cron-secret') ?? '';
  const { data: expected } = await svc.rpc('read_cron_secret');
  if (!expected || presented !== expected) return json({ error: 'forbidden' }, 403);

  const { data: conns, error } = await svc
    .from('calendar_connections')
    .select('id, user_id, household_id, credential_ref, sync_state, share_mode, calendar_allowlist')
    .eq('provider', 'google')
    .is('revoked_at', null);

  if (error) return json({ error: 'could not list connections' }, 500);

  let ok = 0;
  let failed = 0;
  let upserted = 0;
  let removed = 0;

  for (const conn of (conns ?? []) as Conn[]) {
    try {
      const r = await syncConnection(svc, conn);
      upserted += r.upserted;
      removed += r.removed;
      ok += 1;
    } catch (e) {
      failed += 1;
      // One dead connection (revoked grant, expired refresh token) must not stop
      // the others. Record why on the row so it surfaces in the app.
      await svc.from('calendar_connections').update({ last_error: (e as Error).message }).eq('id', conn.id);
    }
  }

  return json({ connections: (conns ?? []).length, ok, failed, upserted, removed });
});
