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
  quantity: number | null;
  unit: string | null;
  store: string | null;
  state: ShoppingState;
}

export interface ShoppingItemView {
  id: string;
  name: string;
  detail: string | null;
  done: boolean;
}

const DONE_STATES: ReadonlySet<ShoppingState> = new Set<ShoppingState>(['completed', 'declined', 'canceled']);

export function isDone(state: ShoppingState): boolean {
  return DONE_STATES.has(state);
}

export function toShoppingView(item: RawShoppingItem): ShoppingItemView {
  const bits: string[] = [];
  if (item.quantity != null) bits.push(item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity));
  if (item.store) bits.push(item.store);
  return {
    id: item.id,
    name: item.name,
    detail: bits.length ? bits.join(' · ') : null,
    done: isDone(item.state),
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
