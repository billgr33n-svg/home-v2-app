// Shared Google Calendar plumbing for the three Edge Functions.
//
// Nothing here touches the browser. The refresh token exists in exactly two
// places: Google, and Supabase Vault. It is read into memory only inside a
// service-role function, only long enough to mint an access token.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** Where the browser lands after the callback. */
export const APP_URL = Deno.env.get('APP_URL') ?? 'https://house.gooddirt.org';

export function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing secret: ${name}`);
  return v;
}

/** Service-role client. Bypasses RLS, so nothing built on it may take a household id from the caller. */
export function serviceClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve the caller from their JWT, then look up which household they actually
 * belong to.
 *
 * The household is NEVER taken from the request body. A caller who could name
 * their own household id could attach a calendar to someone else's house.
 */
export async function callerHousehold(req: Request): Promise<{ userId: string; householdId: string }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'not signed in');

  const svc = serviceClient();
  const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
  if (userErr || !userData.user) throw new HttpError(401, 'not signed in');

  const { data, error } = await svc
    .from('household_memberships')
    .select('household_id')
    .eq('user_id', userData.user.id)
    .eq('state', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, 'could not resolve household');
  if (!data) throw new HttpError(403, 'you are not in a household');

  return { userId: userData.user.id, householdId: data.household_id };
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

/** Store a refresh token and return the pointer we keep in calendar_connections. */
export async function vaultStore(svc: SupabaseClient, name: string, secret: string): Promise<string> {
  const { data, error } = await svc.rpc('vault_upsert_secret', { p_name: name, p_secret: secret });
  if (error) throw new HttpError(500, `vault write failed: ${error.message}`);
  return data as string;
}

export async function vaultRead(svc: SupabaseClient, id: string): Promise<string> {
  const { data, error } = await svc.rpc('vault_read_secret', { p_id: id });
  if (error || !data) throw new HttpError(500, 'could not read the stored credential');
  return data as string;
}

export async function vaultDelete(svc: SupabaseClient, id: string): Promise<void> {
  await svc.rpc('vault_delete_secret', { p_id: id });
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: requiredEnv('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new HttpError(502, `google token exchange failed: ${await res.text()}`);
  return await res.json();
}

/**
 * Trade the long-lived refresh token for a short-lived access token.
 *
 * `invalid_grant` here means the refresh token is dead: the user revoked access,
 * or the app slipped back into Testing status (where Google expires refresh
 * tokens seven days after consent). Either way the connection is finished and
 * the user has to reconnect -- so we say so plainly rather than retrying.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    if (body.includes('invalid_grant')) {
      throw new HttpError(401, 'Google revoked this connection. Connect the calendar again.');
    }
    throw new HttpError(502, `google refresh failed: ${body}`);
  }
  return (JSON.parse(body) as TokenResponse).access_token;
}

/** Best-effort revocation. A failure here must not block local cleanup. */
export async function revokeToken(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
