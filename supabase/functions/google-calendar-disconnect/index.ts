// google-calendar-disconnect
//
// Disconnecting means three things, in this order, and skipping any of them
// leaves a lie behind:
//
//   1. REVOKE AT GOOGLE. Otherwise the grant survives in the user's Google
//      account permissions page and the refresh token keeps working. "Forgetting"
//      a live credential is not disconnecting; it is losing it.
//   2. DELETE THE VAULT SECRET. No orphaned tokens.
//   3. SOFT-DELETE THE IMPORTED EVENTS. They came from a calendar we no longer
//      have permission to read, so we must not keep showing them as current.
//
// Order matters: revoke first, so a failure there can still be reported. But a
// Google outage must not trap the user in a connection they asked to end, so a
// failed revoke is reported, not fatal.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  callerHousehold, corsHeaders, HttpError, json, revokeToken, serviceClient, vaultDelete, vaultRead,
} from '../_shared/google.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId, householdId } = await callerHousehold(req);
    const svc = serviceClient();

    const { data: conn } = await svc
      .from('calendar_connections')
      .select('id, credential_ref')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .is('revoked_at', null)
      .maybeSingle();

    if (!conn) return json({ ok: true, note: 'nothing was connected' });

    let revokedAtGoogle = false;
    try {
      revokedAtGoogle = await revokeToken(await vaultRead(svc, conn.credential_ref));
    } catch {
      // The token may already be dead. Keep cleaning up regardless.
    }

    await vaultDelete(svc, conn.credential_ref);

    const { count } = await svc
      .from('events')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('provider_connection_id', conn.id)
      .is('deleted_at', null);

    await svc
      .from('calendar_connections')
      .update({ revoked_at: new Date().toISOString(), sync_state: {}, last_error: null })
      .eq('id', conn.id);

    return json({
      ok: true,
      revokedAtGoogle,
      eventsRemoved: count ?? 0,
      note: revokedAtGoogle
        ? undefined
        : 'Disconnected here, but Google did not confirm the revoke. Remove "Home v2" at myaccount.google.com/permissions to be sure.',
    });
  } catch (e) {
    const err = e as HttpError;
    return json({ error: err.message ?? 'unexpected error' }, err.status ?? 500);
  }
});
