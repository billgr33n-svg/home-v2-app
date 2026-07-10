import type { Session } from '@supabase/supabase-js';

import { EXPIRY_SKEW_SECONDS, isAuthError, isExpired, isUsable, msUntilRefresh } from './session';

const NOW = new Date('2026-07-10T12:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

function session(expiresAt: number | undefined): Session {
  return { expires_at: expiresAt, access_token: 'x', refresh_token: 'y' } as unknown as Session;
}

describe('isExpired', () => {
  it('treats a missing session as expired', () => {
    expect(isExpired(null, NOW)).toBe(true);
  });

  it('treats a session with no expires_at as expired: we cannot prove it is fresh', () => {
    expect(isExpired(session(undefined), NOW)).toBe(true);
  });

  it('is expired once the deadline has passed', () => {
    expect(isExpired(session(nowSec - 1), NOW)).toBe(true);
  });

  it('is expired inside the skew window, before the token technically dies', () => {
    expect(isExpired(session(nowSec + EXPIRY_SKEW_SECONDS - 1), NOW)).toBe(true);
  });

  it('is live outside the skew window', () => {
    expect(isExpired(session(nowSec + EXPIRY_SKEW_SECONDS + 1), NOW)).toBe(false);
  });
});

describe('isUsable', () => {
  it('is the inverse of expired, for a real session', () => {
    expect(isUsable(session(nowSec + 3600), NOW)).toBe(true);
    expect(isUsable(session(nowSec - 3600), NOW)).toBe(false);
    expect(isUsable(null, NOW)).toBe(false);
  });
});

describe('msUntilRefresh', () => {
  it('never returns a negative delay', () => {
    expect(msUntilRefresh(session(nowSec - 9999), NOW)).toBe(0);
    expect(msUntilRefresh(null, NOW)).toBe(0);
  });

  it('counts down to the skew-adjusted deadline', () => {
    expect(msUntilRefresh(session(nowSec + 100), NOW)).toBe((100 - EXPIRY_SKEW_SECONDS) * 1000);
  });
});

describe('isAuthError', () => {
  it('recognises the PostgREST expired-JWT code', () => {
    expect(isAuthError({ code: 'PGRST301' })).toBe(true);
  });

  it('recognises a bare 401', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it('recognises the message GoTrue actually sends', () => {
    expect(isAuthError({ message: 'JWT expired' })).toBe(true);
  });

  it('does not mistake an ordinary failure for an auth failure', () => {
    expect(isAuthError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError('boom')).toBe(false);
  });
});
