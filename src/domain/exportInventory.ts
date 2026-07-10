import type { InventoryView } from './inventory';

/**
 * Export the pantry (or the bar) as text you can paste into an AI.
 *
 * Two decisions worth defending, because both look like laziness and are not:
 *
 * 1. WE DO NOT SORT FRUIT FROM VEGETABLE. Bill asked for "all fruits" in the bar
 *    export. Doing that properly means a botanical classifier, and the moment it
 *    meets a tomato, a cucumber, or a lime leaf it starts lying. So the whole
 *    Produce category goes across, honestly labelled. The model on the other end
 *    is better at "which of these can I muddle" than any list we would ship, and
 *    a wrong omission is invisible while a wrong inclusion is obvious.
 *
 * 2. WE SEPARATE "ON HAND" FROM "OUT". An AI handed a flat list will happily
 *    build a recipe around the milk you ran out of. Out-of-stock items are
 *    listed under their own heading so the model can suggest a shopping addition
 *    instead of hallucinating a full fridge.
 *
 * Approximate levels ("plenty", "low") are passed through as words rather than
 * being converted to invented numbers. "Some olive oil" is the truth; "0.5 L of
 * olive oil" is a fabrication.
 */

/** Categories that are food, in the order a cook thinks about them. */
export const FOOD_CATEGORIES = [
  'Produce',
  'Meat',
  'Deli',
  'Dairy',
  'Frozen',
  'Bakery',
  'Pantry',
  'Snacks',
  'Beverages',
] as const;

/** Categories the bar cares about. Produce is here for garnish and juice. */
export const BAR_CATEGORIES = ['Alcohol', 'Beverages', 'Produce'] as const;

/** Locations that mean "this is bar stock" regardless of how it was categorised. */
const BAR_LOCATION_PATTERN = /liquor|wine|alcohol|mixer|bar\b/i;

/** Never useful in a recipe prompt. */
const EXCLUDED_CATEGORIES = new Set(['Household', 'Health']);

export type ExportKind = 'food' | 'bar';

function isBarStock(item: InventoryView): boolean {
  if (item.category === 'Alcohol') return true;
  return item.locationName != null && BAR_LOCATION_PATTERN.test(item.locationName);
}

export function selectForExport(items: readonly InventoryView[], kind: ExportKind): InventoryView[] {
  return items.filter((i) => {
    if (EXCLUDED_CATEGORIES.has(i.category)) return false;

    if (kind === 'bar') {
      if (isBarStock(i)) return true;
      return (BAR_CATEGORIES as readonly string[]).includes(i.category);
    }

    // Food: everything edible that is not sitting in the liquor cabinet.
    if (isBarStock(i)) return false;
    return (FOOD_CATEGORIES as readonly string[]).includes(i.category);
  });
}

/** True when we can say the item is not currently in the house. */
function isOut(item: InventoryView): boolean {
  if (item.approximate) return item.level === 'out';
  return item.quantity != null && item.quantity <= 0;
}

/** "2 gal", "some", "plenty". Never a number we did not measure. */
function amountOf(item: InventoryView): string {
  if (item.approximate) return item.level && item.level !== 'unknown' ? item.level : 'amount unknown';
  if (item.quantity == null) return 'amount unknown';
  const n = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2).replace(/0+$/, '');
  return item.unit ? `${n} ${item.unit}` : n;
}

function line(item: InventoryView): string {
  const parts = [item.name];
  if (item.brand) parts.push(`(${item.brand})`);
  const suffix = [amountOf(item)];
  if (item.locationName) suffix.push(item.locationName);
  return `- ${parts.join(' ')} — ${suffix.join(', ')}`;
}

const HEADERS: Record<ExportKind, string> = {
  food:
    'Here is everything currently in my kitchen. Suggest meals and recipes I can make ' +
    'mostly from what I already have. Tell me plainly when a recipe needs something ' +
    'I do not have, and keep that list short.',
  bar:
    'Here is everything currently in my bar: spirits, mixers, drinks, and produce for ' +
    'garnish and juice. Suggest cocktails I can make from what I have. The produce list ' +
    'is the whole produce drawer, so ignore anything that is obviously not a cocktail ' +
    'ingredient. Tell me plainly when a drink needs something I do not have.',
};

export function buildInventoryPrompt(
  items: readonly InventoryView[],
  kind: ExportKind,
  now: Date = new Date(),
): string {
  const selected = selectForExport(items, kind);
  const onHand = selected.filter((i) => !isOut(i));
  const out = selected.filter(isOut);

  const order = kind === 'bar' ? BAR_CATEGORIES : FOOD_CATEGORIES;
  const rank = new Map<string, number>((order as readonly string[]).map((c, i) => [c, i]));

  const grouped = new Map<string, InventoryView[]>();
  for (const item of onHand) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  const sections = [...grouped.entries()]
    .sort((a, b) => (rank.get(a[0]) ?? 99) - (rank.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .map(([category, rows]) => {
      const body = [...rows].sort((a, b) => a.name.localeCompare(b.name)).map(line).join('\n');
      return `## ${category}\n${body}`;
    });

  const parts: string[] = [HEADERS[kind], '', `_${kind === 'bar' ? 'Bar' : 'Kitchen'} inventory, ${now.toISOString().slice(0, 10)}_`, ''];

  if (sections.length === 0) {
    parts.push('(Nothing on hand.)');
  } else {
    parts.push(sections.join('\n\n'));
  }

  if (out.length > 0) {
    const names = [...out].sort((a, b) => a.name.localeCompare(b.name)).map((i) => i.name);
    parts.push('', '## Out of stock (do not build around these)', names.map((n) => `- ${n}`).join('\n'));
  }

  return parts.join('\n');
}
