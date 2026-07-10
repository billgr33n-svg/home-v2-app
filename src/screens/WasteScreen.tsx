import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useWaste } from '../hooks/useWaste';
import { wasteHeadline, type WasteRow } from '../domain/waste';
import { cardBase, color, radius, space, TOUCH, type as t } from '../theme';

const WINDOWS = [
  { days: 7, label: '7 days', phrase: 'this week' },
  { days: 30, label: '30 days', phrase: 'this month' },
  { days: 90, label: '90 days', phrase: 'in 90 days' },
] as const;

/**
 * The screen the ledger was built for.
 *
 * `used` and `spoiled` have been separate reasons since 0017, and for a year
 * nothing read them back. A number nobody sees changes no behaviour.
 *
 * Deliberately no dollar figures: the inventory stores no prices, and a made-up
 * cost on a screen whose whole job is to be trusted would be worse than no
 * screen at all.
 */
export function WasteScreen(props: { householdId: string }) {
  const [win, setWin] = useState<(typeof WINDOWS)[number]>(WINDOWS[1]);
  const q = useWaste(props.householdId, win.days);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.filters}>
        {WINDOWS.map((w) => {
          const on = w.days === win.days;
          return (
            <Pressable key={w.days} onPress={() => setWin(w)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {q.isLoading ? <ActivityIndicator color={color.accent} style={styles.spin} /> : null}

      {q.isError ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>Could not load the waste report.</Text>
          <Pressable onPress={() => void q.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {q.data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.headline}>{wasteHeadline(q.data, win.phrase)}</Text>
            <View style={styles.stats}>
              <Stat label="Eaten or used" value={fmt(q.data.totalUsedUnits)} tone="success" />
              <Stat label="Thrown away" value={fmt(q.data.totalSpoiledUnits)} tone="danger" />
            </View>
            <Text style={styles.footnote}>
              Units, not dollars. The inventory does not store prices, so a cost here would be invented.
            </Text>
          </View>

          {q.data.rows.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Nothing recorded yet</Text>
              <Text style={styles.emptyBody}>
                This fills in as the house cooks meals, scans items, and marks things spoiled. Nothing to do.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.section}>BY ITEM</Text>
              {q.data.rows.map((r: WasteRow) => {
                const total = r.spoiledUnits + r.usedUnits;
                const wasted = total > 0 ? r.spoiledUnits / total : 0;
                return (
                  <View key={r.itemId} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{r.itemName}</Text>
                      <Text style={styles.rowMeta}>
                        {fmt(r.spoiledUnits)} wasted · {fmt(r.usedUnits)} used
                        {r.unit ? ` (${r.unit})` : ''}
                      </Text>
                    </View>
                    {/* A bar beats a percentage: the eye compares lengths faster than digits. */}
                    <View style={styles.bar}>
                      <View style={[styles.barFill, { width: `${Math.round(wasted * 100)}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat(props: { label: string; value: string; tone: 'success' | 'danger' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, props.tone === 'danger' ? styles.statDanger : styles.statSuccess]}>
        {props.value}
      </Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </View>
  );
}

/** Two decimals is noise on a fridge count; a bare integer lies about 0.5 sticks of butter. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg },
  spin: { marginTop: space.xl },

  filters: { flexDirection: 'row', gap: space.sm },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipText: { color: color.textMuted, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: color.accent },

  card: { ...cardBase, gap: space.md },
  headline: { ...t.heading, fontSize: 18, lineHeight: 25 },
  footnote: { ...t.meta },

  stats: { flexDirection: 'row', gap: space.xl },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statSuccess: { color: color.success },
  statDanger: { color: color.danger },
  statLabel: { ...t.detail },

  section: { ...t.section },
  row: { gap: 6, paddingVertical: space.sm },
  rowHead: { gap: 2 },
  rowTitle: { ...t.body, fontWeight: '600' },
  rowMeta: { ...t.meta },
  bar: { height: 6, borderRadius: 3, backgroundColor: color.successSoft, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: color.danger },

  emptyTitle: { ...t.heading },
  emptyBody: { ...t.detail },

  errorText: { color: color.danger, fontSize: 15 },
  retry: {
    alignSelf: 'flex-start',
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  retryText: { color: color.accentInk, fontWeight: '700' },
});
