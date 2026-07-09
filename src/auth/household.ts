/**
 * Who can sign in, and what email each name maps to.
 *
 * The family signs in by tapping a name and typing a 4-digit PIN. Supabase auth
 * is email+password underneath, so the name is a label and the email is the real
 * identifier. Keeping the map here (not in the DB) means the sign-in screen needs
 * no query before it can render -- there is nobody to authenticate as yet.
 *
 * Emails are not secrets, and PINs are NOT stored here. The PIN is typed, sent to
 * Supabase, and checked against a bcrypt hash server-side. Nothing in this bundle
 * lets you log in without knowing a PIN.
 */
export interface Member {
  name: string;
  email: string;
}

export const HOUSEHOLD_MEMBERS: Member[] = [
  { name: 'Bill', email: 'billgr33n@gmail.com' },
  { name: 'Sandy', email: 'sandy@house.gooddirt.org' },
  { name: 'Will', email: 'will@house.gooddirt.org' },
  { name: 'Matt', email: 'matt@house.gooddirt.org' },
  { name: 'Cora', email: 'cora@house.gooddirt.org' },
];

export const PIN_LENGTH = 4;

export function emailFor(name: string): string | null {
  return HOUSEHOLD_MEMBERS.find((m) => m.name === name)?.email ?? null;
}
