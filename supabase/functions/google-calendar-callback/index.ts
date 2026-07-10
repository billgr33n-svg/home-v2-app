// google-calendar-callback
//
// verify_jwt is OFF, and it has to be: Google redirects the user's BROWSER here,
// and a browser redirect carries no Authorization header. This is the only
// endpoint in the system reachable without a JWT.
//
// Its entire authentication is therefore the `state` parameter:
//
//   * 32 bytes of CSPRNG, minted by google-calendar-connect behind a JWT
//   * bound to one household and one user at mint time
//   * ten-minute expiry
//   * burned by `consume_oauth_state()`, whose UPDATE ... RETURNING makes the
//     check and the burn a single statement, so two concurrent callbacks cannot
//     both succeed
//
// Without that, anyone who guessed this URL could post an authorization code and
// attach THEIR Google account to Bill's household. The household id is never
// read from the query string. It comes back out of the consumed state row.
//
// The refresh token is written straight into Supabase Vault. It never touches a
// public-schema column, never reaches the browser, never appears in a log line.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { APP_URL, exchangeCode, serviceClient, vaultStore } from '../_shared/google.ts';

function back(status: 'connected' | 'error', detail?: string): Response {
  const url = new URL('/', APP_URL);
  url.searchParams.set('calendar', status);
  if (detail) url.searchParams.set('reason', detail);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req: Request) => {
  const params = new URL(req.url).searchParams;

  // The user pressed Cancel on the consent screen. Not an error.
  const googleError = params.get('error');
  if (googleError) return back('error', googleError === 'access_denied' ? 'declined' : googleError);

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return back('error', 'bad_request');

  const svc = serviceClient();

  try {
    // Burn the state FIRST. If it is stale, replayed, or invented, we stop here
    // having done nothing and having told the caller nothing.
    const { data: consumed, error: stateErr } = await svc.rpc('consume_oauth_state', { p_state: state });
    if (stateErr) return back('error', 'state_check_failed');

    const row = Array.isArray(consumed) ? consumed[0] : consumed;
    if (!row?.household_id || !row?.user_id) return back('error', 'expired_link');

    const tokens = await exchangeCode(code);

    // No refresh token means `prompt=consent` did not take, and the connection
    // would silently die in an hour. Refuse it now, loudly.
    if (!tokens.refresh_token) return back('error', 'no_refresh_token');

    // Who did they actually connect? Ask Google, do not guess.
    const who = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const email = who.ok ? ((await who.json()).email as string | undefined) : undefined;

    const secretName = `google_refresh:${row.household_id}:${row.user_id}`;
    const credentialRef = await vaultStore(svc, secretName, tokens.refresh_token);

    const { error: upsertErr } = await svc.from('calendar_connections').upsert(
      {
        household_id: row.household_id,
        user_id: row.user_id,
        provider: 'google',
        external_account_id: email ?? null,
        share_mode: 'title_time',
        credential_ref: credentialRef,
        sync_state: {},
        last_error: null,
        revoked_at: null,
      },
      { onConflict: 'household_id,user_id,provider' },
    );
    if (upsertErr) return back('error', 'save_failed');

    return back('connected');
  } catch {
    // Never echo the exception: it can contain the authorization code.
    return back('error', 'unexpected');
  }
});
