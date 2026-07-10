import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shiftError } from '../api/kitchen';
import { useAuth } from '../auth/AuthProvider';
import { buildWeek, imminentOpen, ROLE_SHORT, weekStart, type ShiftView } from '../domain/kitchen';
import { useClaimShift, useKitchenWeek } from '../hooks/useKitchen';
import { cardBase, color, radius, space, TOUCH, type as t } from '../theme';

/**
 * The honest cost of an open-signup board is that nobody signs up.
 *
 * An empty board on Sunday night means nobody unloads on Monday, and the person
 * who notices at 7am is the household administrator — which is precisely the
 * load this project exists to reduce. So unfilled slots for today and tomorrow
 * come to Today, where everyone already looks, with a one-tap claim.
 *
 * Renders nothing when the board is filled. A nag that fires when there is
 * nothing to do gets ignored when there is.
 */
export function KitchenTodayCard(props: { householdId: string }) {
  const { session } = useAuth();
  const myId = session?.user.id ?? null;

  const now = useMemo(() => new Date(), []);
  const start = useMemo(() => weekStart(now), [now]);

  const q = useKitchenWeek(props.householdId, start);
  const claim = useClaimShift(props.householdId, start);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = useMemo(
    () => imminentOpen(buildWeek(q.data ?? [], start, now, myId), now),
    [q.data, start, now, myId],
  );

  if (q.isLoading || open.length === 0) return null;

  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  const take = (s: ShiftView) => {
    setError(null);
    setBusyId(s.id);
    claim.mutate(
      { id: s.id, version: s.version },
      { onError: (e) => setError(shiftError(e)), onSettled: () => setBusyId(null) },
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>KITCHEN — NOBODY SIGNED UP</Text>
      {open.map((s) => (
        <View key={s.id} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.role}>
              {s.role === 'fridge' && s.detail ? `${s.detail} fridge` : ROLE_SHORT[s.role]}
            </Text>
            <Text style={styles.when}>{s.shiftDate === todayIso ? 'Today' : 'Tomorrow'}</Text>
          </View>
          <Pressable style={styles.btn} disabled={busyId === s.id} onPress={() => take(s)}>
            <Text style={styles.btnText}>{busyId === s.id ? '...' : "I'll do it"}</Text>
          </Pressable>
        </View>
      ))}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardBase, gap: space.sm, marginBottom: space.sm, borderColor: color.warning },
  section: { ...t.section, color: color.warning },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  text: { flex: 1, gap: 1 },
  role: { ...t.body, fontWeight: '600' },
  when: { ...t.meta },
  btn: {
    minHeight: TOUCH - 4,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  btnText: { color: color.accentInk, fontWeight: '700', fontSize: 14 },
  err: { color: color.danger, fontSize: 13 },
});
