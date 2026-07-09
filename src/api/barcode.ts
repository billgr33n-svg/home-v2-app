// Barcode -> product lookup, and adding a scanned item to inventory.
//
// Lookup uses Open Food Facts (free, no API key, CORS-enabled). It is a
// crowd-sourced database: coverage is good for packaged food, thin for store
// brands, and nonexistent for loose produce and butcher-counter meat. So the
// scanner ALWAYS lets you type the name yourself -- a failed lookup is a normal
// outcome, not an error state.
//
// We defensively parse the response rather than trusting a shape.

import { supabase } from '../lib/supabase';

export interface ProductLookup {
  barcode: string;
  name: string | null;
  brand: string | null;
  size: string | null;
  found: boolean;
}

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Brands come back comma-separated ("Kirkland Signature,Costco"); take the first.
function firstBrand(v: unknown): string | null {
  const s = str(v);
  return s ? (str(s.split(',')[0]) ?? null) : null;
}

export async function lookupBarcode(barcode: string): Promise<ProductLookup> {
  const code = barcode.replace(/\D/g, '');
  const empty: ProductLookup = { barcode: code, name: null, brand: null, size: null, found: false };
  if (code.length < 6) return empty;

  try {
    const url = `${OFF_ENDPOINT}/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return empty;
    const body: unknown = await res.json();
    if (typeof body !== 'object' || body === null) return empty;

    const rec = body as Record<string, unknown>;
    // status 1 = found. Some responses omit it; fall back to presence of product.
    const product = rec.product;
    if (typeof product !== 'object' || product === null) return empty;

    const p = product as Record<string, unknown>;
    const name = str(p.product_name);
    const brand = firstBrand(p.brands);
    const size = str(p.quantity);
    return { barcode: code, name, brand, size, found: Boolean(name || brand) };
  } catch {
    // Offline, blocked, or rate-limited. The caller falls back to manual entry.
    return empty;
  }
}

export interface ScannedItem {
  name: string;
  brand?: string | null;
  unit?: string | null;
  barcode?: string | null;
  category?: string | null;
  locationId?: string | null;
  quantity?: number | null;
  /** Reorder point: at or below this, the item wants restocking. */
  minQuantity?: number | null;
  /** Ideal level to restock back up to. */
  parQuantity?: number | null;
  store?: string | null;
  /** YYYY-MM-DD. */
  purchasedOn?: string | null;
}

export const STORES = ['Costco', 'Kroger', 'Publix', 'HMart', 'Restaurant Depot'] as const;

// Categories that matter for planning. 'Alcohol' is deliberately separate from
// 'Beverages' -- you restock them differently and you may want it excluded from a
// shared shopping list.
export const CATEGORIES = [
  'Produce', 'Dairy', 'Meat', 'Deli', 'Bakery', 'Pantry',
  'Frozen', 'Snacks', 'Beverages', 'Alcohol', 'Household', 'Health',
] as const;

// Real pantries hold partial things. "Half a box of cereal" and "a third of a jar
// of jam" are the normal case, not an edge case, so quantity is numeric and the
// unit is free-form rather than a fixed enum of whole packages.
export const FRACTIONS: Array<{ label: string; value: number }> = [
  { label: 'Empty', value: 0 },
  { label: '¼', value: 0.25 },
  { label: '⅓', value: 0.3333 },
  { label: '½', value: 0.5 },
  { label: '⅔', value: 0.6667 },
  { label: '¾', value: 0.75 },
  { label: 'Full', value: 1 },
];

// Weight/volume/count units, plus the package-ish units people actually say.
export const MEASURE_UNITS = [
  'lb', 'oz', 'g', 'kg',
  'gal', 'qt', 'fl oz', 'L', 'ml',
  'ct', 'stick', 'slice', 'can', 'bottle', 'box', 'jar', 'bag',
] as const;

export const PACKAGE_UNIT = 'package';

// Butter comes in sticks, jam comes in jars, wine comes in bottles. A single
// unit list makes you scroll past 'kg' to find 'stick'. So the units on offer
// depend on the item.
//
// Name beats category: "Peanut butter" is Pantry but lives in a jar, and
// "Butter" is Dairy but comes in sticks. We check the name first, and fall back
// to the category only when the name tells us nothing.
interface UnitProfile {
  /** The container noun, used for fractions: "½ jar", "⅓ box". */
  container: string;
  /** Units offered in the weight/volume mode, best first. */
  units: string[];
}

const BY_NAME: Array<[RegExp, UnitProfile]> = [
  // Check "peanut butter" / "almond butter" BEFORE plain "butter".
  [/\b(peanut|almond|cashew|sun) butter\b/i, { container: 'jar', units: ['jar', 'oz', 'lb'] }],
  [/\bbutter\b/i, { container: 'package', units: ['stick', 'lb', 'oz'] }],
  [/\b(jam|jelly|preserve|honey|salsa|pesto|sauce|mayo|mustard|pickle)/i, { container: 'jar', units: ['jar', 'oz', 'fl oz'] }],
  [/\b(cereal|crackers|cookies|pasta|rice|flour|sugar)\b/i, { container: 'box', units: ['box', 'oz', 'lb'] }],
  [/\b(milk|juice|cream|creamer|broth)\b/i, { container: 'carton', units: ['gal', 'qt', 'fl oz', 'carton'] }],
  [/\b(egg|eggs)\b/i, { container: 'carton', units: ['ct', 'dozen'] }],
  [/\b(wine|prosecco|malbec|whiskey|bourbon|vodka|gin|rum|tequila|liqueur)\b/i, { container: 'bottle', units: ['bottle', 'ml', 'oz'] }],
  [/\b(beer|soda|coke|sprite|seltzer|water|celsius)\b/i, { container: 'pack', units: ['can', 'bottle', 'pack', 'fl oz'] }],
  [/\b(cheese|mozzarella|cheddar|parmigiano)\b/i, { container: 'package', units: ['oz', 'lb', 'slice'] }],
  [/\b(chicken|beef|pork|salmon|bacon|sausage|turkey|ham)\b/i, { container: 'package', units: ['lb', 'oz', 'package'] }],
  [/\b(bread|bagel|bun|roll|tortilla|baguette)\b/i, { container: 'bag', units: ['ct', 'bag', 'oz'] }],
  [/\b(paper towel|toilet paper|napkin|plate)\b/i, { container: 'pack', units: ['roll', 'ct', 'pack'] }],
];

const BY_CATEGORY: Record<string, UnitProfile> = {
  Produce: { container: 'bag', units: ['ct', 'lb', 'bunch', 'bag'] },
  Dairy: { container: 'carton', units: ['oz', 'fl oz', 'qt', 'gal'] },
  Meat: { container: 'package', units: ['lb', 'oz', 'package'] },
  Deli: { container: 'package', units: ['lb', 'oz', 'slice'] },
  Bakery: { container: 'bag', units: ['ct', 'oz', 'bag'] },
  Pantry: { container: 'jar', units: ['oz', 'lb', 'jar', 'box'] },
  Frozen: { container: 'bag', units: ['lb', 'oz', 'bag'] },
  Snacks: { container: 'bag', units: ['oz', 'ct', 'bag'] },
  Beverages: { container: 'pack', units: ['fl oz', 'can', 'bottle', 'pack'] },
  Alcohol: { container: 'bottle', units: ['bottle', 'ml', 'oz'] },
  Household: { container: 'pack', units: ['ct', 'roll', 'pack'] },
  Health: { container: 'bottle', units: ['ct', 'bottle'] },
};

const DEFAULT_PROFILE: UnitProfile = { container: PACKAGE_UNIT, units: ['oz', 'lb', 'ct'] };

export function unitProfile(name: string, category: string | null): UnitProfile {
  for (const [re, profile] of BY_NAME) {
    if (re.test(name)) return profile;
  }
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category];
  return DEFAULT_PROFILE;
}

// "0.5 package" -> "½ package". Keeps the inventory list readable.
export function formatAmount(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit ?? '';
  const near = FRACTIONS.find((f) => f.value > 0 && f.value < 1 && Math.abs(f.value - quantity) < 0.02);
  const q = near ? near.label : String(Math.round(quantity * 100) / 100);
  return unit ? `${q} ${unit}` : q;
}

// Scanning the same barcode twice should bump the count, not create a duplicate row.
export async function addScannedItem(householdId: string, item: ScannedItem): Promise<'inserted' | 'incremented'> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  if (item.barcode) {
    const { data: existing, error: findErr } = await supabase
      .from('inventory_items')
      .select('id,quantity,unit,count_mode')
      .eq('household_id', householdId)
      .eq('barcode', item.barcode)
      .is('deleted_at', null)
      .limit(1);
    if (findErr) throw findErr;

    const hit = existing?.[0];
    if (hit) {
      const sameUnit = !hit.unit || !item.unit || hit.unit === item.unit;
      // Adding "½ package" to "1 lb" is nonsense. Only sum when the units agree;
      // otherwise treat the new reading as a correction of the old one.
      const next = sameUnit
        ? (Number(hit.quantity) || 0) + (item.quantity ?? 1)
        : (item.quantity ?? 1);
      const { error } = await supabase
        .from('inventory_items')
        .update({
          quantity: next,
          unit: item.unit ?? hit.unit ?? null,
          count_mode: 'exact',
          last_counted_at: new Date().toISOString(),
          ...(item.purchasedOn ? { purchased_on: item.purchasedOn } : {}),
          updated_by: uid,
        })
        .eq('id', hit.id);
      if (error) throw error;
      return sameUnit ? 'incremented' : 'inserted';
    }
  }

  const { error } = await supabase.from('inventory_items').insert({
    household_id: householdId,
    name: item.name,
    brand: item.brand ?? null,
    unit: item.unit ?? null,
    barcode: item.barcode ?? null,
    category: item.category ?? null,
    location_id: item.locationId ?? null,
    quantity: item.quantity ?? 1,
    min_quantity: item.minQuantity ?? null,
    par_quantity: item.parQuantity ?? null,
    preferred_store: item.store ?? null,
    purchased_on: item.purchasedOn ?? null,
    last_counted_at: new Date().toISOString(),
    count_mode: 'exact',
    updated_by: uid,
  });
  if (error) throw error;
  return 'inserted';
}
