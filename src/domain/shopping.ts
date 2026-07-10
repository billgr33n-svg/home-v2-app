// Shopping list: every item has a visible status; a common response (mark
// bought) is one tap (PRODUCT_RULES rules 1 and 5). Pure domain logic.

export type ShoppingState =
  | 'new'
  | 'seen'
  | 'accepted'
  | 'in_progress'
  | 'waiting'
  | 'completed'
  | 'declined'
  | 'canceled';

export interface RawShoppingItem {
  id: string;
  name: string;
  brand?: string | null;
  quantity: number | null;
  unit: string | null;
  store: string | null;
  state: ShoppingState;
  /** Set by the 0018 trigger when the purchase reached the inventory ledger. */
  stockedAt?: string | null;
  /** Why it did not. Populated only when stockedAt is null and the item is bought. */
  stockNote?: string | null;
}

export interface ShoppingItemView {
  id: string;
  name: string;
  detail: string | null;
  done: boolean;
  /**
   * "Bought, but the fridge never heard about it."
   *
   * The 0018 trigger refuses to move the balance when the shopping unit and the
   * inventory unit disagree, because silently adding 2 lb to a count of packages
   * is worse than not stocking at all. Surfacing the reason is the difference
   * between a system that is careful and one that looks broken.
   */
  stockWarning: string | null;
}

const DONE_STATES: ReadonlySet<ShoppingState> = new Set<ShoppingState>(['completed', 'declined', 'canceled']);

export function isDone(state: ShoppingState): boolean {
  return DONE_STATES.has(state);
}

export function toShoppingView(item: RawShoppingItem): ShoppingItemView {
  const bits: string[] = [];
  if (item.brand) bits.push(item.brand);
  if (item.quantity != null) bits.push(item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity));
  if (item.store) bits.push(item.store);
  const bought = item.state === 'completed';
  return {
    id: item.id,
    name: item.name,
    detail: bits.length ? bits.join(' · ') : null,
    done: isDone(item.state),
    stockWarning: bought && !item.stockedAt ? (item.stockNote ?? null) : null,
  };
}

export interface ShoppingList {
  open: ShoppingItemView[];
  done: ShoppingItemView[];
  openCount: number;
}

export function buildShoppingList(items: readonly RawShoppingItem[]): ShoppingList {
  const views = items.map(toShoppingView);
  const open = views.filter((v) => !v.done);
  const done = views.filter((v) => v.done);
  return { open, done, openCount: open.length };
}
