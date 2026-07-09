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
}

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
    count_mode: 'exact',
    updated_by: uid,
  });
  if (error) throw error;
  return 'inserted';
}
