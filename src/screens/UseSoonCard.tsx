import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { expiryLabel, useSoon, type LotView } from '../domain/lots';
import { useConsumeLot, useLots } from '../hooks/useLots';
import { cardBase, color, radius, space, TOUCH, type as t } from '../theme';

/**
 * The reason to open this app on a Tuesday.
 *
 * Two buttons, and the difference between them is the entire point of the
 * ledger: "Used it" is a meal, "Threw it out" is a failure. Collapsing them into
 * one "Remove" button would be tidier and would destroy the waste signal.
 */
export function UseSoonCard(props: { householdId: string }) {
  const lots = useLots(props.householdId);
  const consume = useConsumeLot(props.householdId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const soon = useSoon(lots.data ?? []);
  if (lots.isLoading || soon.length === 0) return null;

  const act = (lot: LotView, reason: 'used' | 'spoiled') => {
    setBusyId(lot.id);
    consume.mutate([lot.id, lot.quantity, reason], { onSettled: () => setBusyId(null) });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>USE SOON</Text>
      {soon.map((lot) => {
        const gone = lot.freshness === 'expired';
        const busy = busyId === lot.id;
        return (
          <View key={lot.id} style={styles.row}>
            <View style={styles.head}>
              <Text style={styles.name}>{lot.itemName}</Text>
              <Text style={[styles.when, gone ? styles.whenGone : styles.whenSoon]}>{expiryLabel(lot)}</Text>
            </View>
            <Text style={styles.qty}>
              {lot.quantity}
              {lot.unit ? ` ${lot.unit}` : ''}
            </Text>
            <View style={styles.actions}>
              <Pressable disabled={busy} style={styles.used} onPress={() => act(lot, 'used')}>
                <Text style={styles.usedText}>{busy ? '...' : 'Used it'}</Text>
              </Pressable>
              <Pressable disabled={busy} style={styles.spoiled} onPress={() => act(lot, 'spoiled')}>
                <Text style={styles.spoiledText}>Threw it out</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {consume.isError ? <Text style={styles.err}>That did not save. Try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardBase, gap: space.md, marginBottom: space.sm },
  section: { ...t.section },

  row: { gap: 6, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  name: { ...t.body, fontWeight: '600', flex: 1 },
  when: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  whenGone: { color: color.danger },
  whenSoon: { color: color.warning },
  qty: { ...t.meta },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  used: {
    minHeight: TOUCH - 4,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  usedText: { color: color.accentInk, fontWeight: '700', fontSize: 14 },
  spoiled: {
    minHeight: TOUCH - 4,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: color.dangerSoft,
  },
  spoiledText: { color: color.danger, fontWeight: '700', fontSize: 14 },

  err: { color: color.danger, fontSize: 13 },
});
