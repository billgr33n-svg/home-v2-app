// google-calendar-sync
//
// Read-only, one direction: Google -> `events`. Nothing here ever writes to a
// user's calendar. The scope (`calendar.readonly`) makes that a guarantee rather
// than a promise.
//
// INCREMENTAL SYNC, AND THE 410 EVERYONE FORGETS
//
// Google hands back a `nextSyncToken` at the end of a full listing. Passing it
// next time returns only what changed -- including deletions, which arrive as
// events with `status: 'cancelled'`. Those are the ONLY way to learn an event
// was deleted, so a sync that ignores them accumulates ghosts forever.
//
// A sync token expires. Google then answers `410 Gone`, and the only correct
// response is to throw the token away and re-list the whole calendar. Code that
// treats 410 as a generic error stops syncing permanently and looks fine.
//
// TIME MODEL
//
// `events` enforces exactly one of `starts_at` (timed) or `all_day_start`
// (date-only). Google says which by giving `dateTime` or `date`. Coercing an
// all-day event into a timestamp is how a birthday lands on the wrong day for
// anyone west of UTC, so the two are kept apart.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  callerHousehold, corsHeaders, HttpError, json, refreshAccessToken, serviceClient, vaultRead,
} from '../_shared/google.ts';

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

/** Only the calendars the person actually keeps visible in Google. */
async function listCalendars(accessToken: string): Promise<string[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(502, 'could not list your calendars');
  const body = await res.json();
  return (body.items ?? [])
    .filter((c: { selected?: boolean; deleted?: boolean }) => c.selected && !c.deleted)
    .map((c: { id: string }) => c.id);
}

/** Pull one calendar. Returns the events and the cursor for next time. */
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
      // First run: a rolling window, not all of history. Nobody needs 2009.
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      url.searchParams.set('timeMin', from.toISOString());
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    // The token went stale. Caller must drop it and full-sync.
    if (res.status === 410) return { events: [], expired: true };
    if (!res.ok) throw new HttpError(502, `google rejected the read: ${res.status}`);

    const body = await res.json();
    events.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    nextSyncToken = body.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, expired: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId, householdId } = await callerHousehold(req);
    const svc = serviceClient();

    const { data: conn } = await svc
      .from('calendar_connections')
      .select('id, credential_ref, sync_state, share_mode')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .is('revoked_at', null)
      .maybeSingle();

    if (!conn) throw new HttpError(404, 'no calendar connected');

    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(await vaultRead(svc, conn.credential_ref));
    } catch (e) {
      const err = e as HttpError;
      await svc.from('calendar_connections').update({ last_error: err.message }).eq('id', conn.id);
      throw err;
    }

    const tokens: Record<string, string> = (conn.sync_state?.syncTokens ?? {}) as Record<string, string>;
    const calendars = await listCalendars(accessToken);

    let upserted = 0;
    let removed = 0;

    for (const calendarId of calendars) {
      let result = await listEvents(accessToken, calendarId, tokens[calendarId]);

      // 410 Gone: cursor is dead. Re-list from scratch, once.
      if (result.expired) {
        delete tokens[calendarId];
        result = await listEvents(accessToken, calendarId, undefined);
      }

      for (const ev of result.events) {
        const key = {
          provider_connection_id: conn.id,
          provider_calendar_id: calendarId,
          provider_event_id: ev.id,
        };

        // Deletions arrive as cancelled events. Soft-delete, per ADR-0006.
        if (ev.status === 'cancelled') {
          const { count } = await svc
            .from('events')
            .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
            .match(key)
            .is('deleted_at', null);
          removed += count ?? 0;
          continue;
        }

        const timed = Boolean(ev.start?.dateTime);

        const { error } = await svc.from('events').upsert(
          {
            ...key,
            household_id: householdId,
            creator_id: userId,
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'provider_connection_id,provider_calendar_id,provider_event_id' },
        );

        // One malformed event must not abort the whole sync.
        if (!error) upserted += 1;
      }

      if (result.nextSyncToken) tokens[calendarId] = result.nextSyncToken;
    }

    await svc
      .from('calendar_connections')
      .update({
        sync_state: { syncTokens: tokens },
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', conn.id);

    return json({ calendars: calendars.length, upserted, removed });
  } catch (e) {
    const err = e as HttpError;
    return json({ error: err.message ?? 'unexpected error' }, err.status ?? 500);
  }
});
