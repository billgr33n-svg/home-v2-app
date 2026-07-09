import { emailFor, HOUSEHOLD_MEMBERS, PIN_LENGTH } from './household';

describe('the household sign-in roster', () => {
  it('has exactly the five people who live here', () => {
    expect(HOUSEHOLD_MEMBERS.map((m) => m.name)).toEqual(['Bill', 'Sandy', 'Will', 'Matt', 'Cora']);
  });

  it('maps every name to a distinct email', () => {
    const emails = HOUSEHOLD_MEMBERS.map((m) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('resolves a name to its email, and refuses an unknown one', () => {
    expect(emailFor('Cora')).toBe('cora@house.gooddirt.org');
    expect(emailFor('cora')).toBeNull(); // exact match only; no silent coercion
    expect(emailFor('Nobody')).toBeNull();
  });

  it('never ships a PIN in the bundle', () => {
    const serialised = JSON.stringify(HOUSEHOLD_MEMBERS);
    for (const pin of ['1102', '0513', '0531', '0313', '0727']) {
      expect(serialised).not.toContain(pin);
    }
  });

  it('expects a 4-digit PIN', () => {
    expect(PIN_LENGTH).toBe(4);
  });
});
