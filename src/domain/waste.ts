/**
 * The waste report.
 *
 * `used` and `spoiled` were split apart in 0017 for exactly this: both remove
 * food, only one is a failure. Collapsing them destroys the signal. Until now
 * nothing in the app read it back.
 *
 * This is deliberately about COUNTS and UNITS, not money. The inventory does not
 * store prices, and inventing a dollar figure from an unpriced ledger would be a
 * fabricated number on a screen that exists to tell the truth.
 */

export type WasteReason = 'spoiled' | 'scrapped';

export interface WasteRow {
  itemId: string;
  itemName: string;
  unit: string | null;
  spoiledUnits: number;
  spoiledEvents: number;
  usedUnits: number;
}

export interface WasteReport {
  rows: WasteRow[];
  totalSpoiledUnits: number;
  totalUsedUnits: number;
  /** Share of everything that left the house which left as waste. 0..1, or null when nothing moved. */
  wasteShare: number | null;
  /** The single worst offender, if there is one worth naming. */
  worst: WasteRow | null;
}

interface RawMovement {
  item_id: string;
  delta: number | string;
  reason: string;
  inventory_items?: { name: string; unit: string | null } | null;
}

export function buildWasteReport(movements: readonly RawMovement[]): WasteReport {
  const byItem = new Map<string, WasteRow>();

  for (const m of movements) {
    // Only outflows count. A `purchased` row that somehow lands here is not waste.
    if (m.reason !== 'used' && m.reason !== 'spoiled' && m.reason !== 'scrapped') continue;

    const units = Math.abs(Number(m.delta));
    if (!Number.isFinite(units) || units === 0) continue;

    const existing = byItem.get(m.item_id) ?? {
      itemId: m.item_id,
      itemName: m.inventory_items?.name ?? 'Unknown item',
      unit: m.inventory_items?.unit ?? null,
      spoiledUnits: 0,
      spoiledEvents: 0,
      usedUnits: 0,
    };

    if (m.reason === 'used') {
      existing.usedUnits += units;
    } else {
      existing.spoiledUnits += units;
      existing.spoiledEvents += 1;
    }
    byItem.set(m.item_id, existing);
  }

  const rows = [...byItem.values()].sort((a, b) => {
    if (b.spoiledUnits !== a.spoiledUnits) return b.spoiledUnits - a.spoiledUnits;
    return a.itemName.localeCompare(b.itemName);
  });

  const totalSpoiledUnits = rows.reduce((n, r) => n + r.spoiledUnits, 0);
  const totalUsedUnits = rows.reduce((n, r) => n + r.usedUnits, 0);
  const outflow = totalSpoiledUnits + totalUsedUnits;

  return {
    rows,
    totalSpoiledUnits,
    totalUsedUnits,
    wasteShare: outflow > 0 ? totalSpoiledUnits / outflow : null,
    worst: rows.length > 0 && rows[0].spoiledUnits > 0 ? rows[0] : null,
  };
}

/**
 * The sentence the report exists to produce. Vague encouragement changes nothing;
 * naming the item does.
 */
export function wasteHeadline(report: WasteReport, periodLabel: string): string {
  if (report.totalSpoiledUnits === 0 && report.totalUsedUnits === 0) {
    return `Nothing recorded ${periodLabel}.`;
  }
  if (report.totalSpoiledUnits === 0) {
    return `Nothing thrown away ${periodLabel}.`;
  }
  const pct = Math.round((report.wasteShare ?? 0) * 100);
  const worst = report.worst;
  const tail = worst ? `, mostly ${worst.itemName.toLowerCase()}` : '';
  return `${pct}% of what left the house ${periodLabel} was thrown away${tail}.`;
}
