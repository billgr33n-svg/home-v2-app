// google-calendar-connect
//
// Builds the Google consent URL and mints a single-use state token.
//
// TWO PARAMETERS DECIDE WHETHER THIS INTEGRATION SURVIVES A RESTART:
//
//   access_type=offline  -- ask for a refresh token at all
//   prompt=consent       -- ask for one EVERY time
//
// Without `prompt=consent`, a second authorization by an account that has
// already granted the scope returns an access token and NO refresh token.
// Everything works for an hour, then the connection is dead and the bug looks
// like it lives in the sync function. It does not. It lives here.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { callerHousehold, corsHeaders, HttpError, json, requiredEnv, SCOPE, serviceClient } from '../_shared/google.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId, householdId } = await callerHousehold(req);
    const svc = serviceClient();

    // 32 bytes of CSPRNG. This is the whole authentication of the callback,
    // which by necessity runs without a JWT.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    const { error } = await svc.from('oauth_states').insert({
      state,
      provider: 'google',
      household_id: householdId,
      user_id: userId,
    });
    if (error) throw new HttpError(500, 'could not start the connection');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requiredEnv('GOOGLE_CLIENT_ID'));
    url.searchParams.set('redirect_uri', requiredEnv('GOOGLE_REDIRECT_URI'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return json({ url: url.toString() });
  } catch (e) {
    const err = e as HttpError;
    return json({ error: err.message ?? 'unexpected error' }, err.status ?? 500);
  }
});
