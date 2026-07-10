import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shiftError } from '../api/kitchen';
import { useAuth } from '../auth/AuthProvider';
import {
  addDays, buildWeek, openCount, ROLE_SHORT, toIsoDate, weekLabel, weekLoad, weekStart,
  type DayView, type ShiftView,
} from '../domain/kitchen';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import {
  useClaimShift, useCompleteShift, useCopyWeek, useCoverShift, useKitchenWeek, useReleaseShift,
} from '../hooks/useKitchen';
import { cardBase, color, radius, space, TOUCH, type as t } from '../theme';

/**
 * The kitchen signup board.
 *
 * NOT a 7x5 grid. Five columns across a 390px phone gives 78px per cell, which
 * cannot hold a name and cannot be tapped. So: one card per day, roles as rows.
 * The week you can see is the week you can sign up for.
 *
 * Slots start empty (Bill's choice). The honest cost of open signup is an empty
 * board on Sunday night, so the open count is the loudest thing on the screen
 * and "Copy last week" is one tap away.
 */
export function KitchenScreen({ householdId }: { householdId: string }) {
  const { session } = useAuth();
  const myId = session?.user.id ?? null;

  const [start, setStart] = useState<Date>(() => weekStart(new Date()));
  const now = useMemo(() => new Date(), []);

  const q = useKitchenWeek(householdId, start);
  const members = useHouseholdMembers(householdId);
  const claim = useClaimShift(householdId, start);
  const release = useReleaseShift(householdId, start);
  const cover = useCoverShift(householdId, start);
  const complete = useCompleteShift(householdId, start);
  const copy = useCopyWeek(householdId, start);

  const [coverOpen, setCoverOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(
    () => buildWeek(q.data ?? [], start, now, myId),
    [q.data, start, now, myId],
  );
  const open = openCount(days);
  const load = weekLoad(days);

  const run = (fn: () => void) => {
    setError(null);
    try {
      fn();
    } catch (e) {
      setError(shiftError(e));
    }
  };

  const onError = (e: unknown) => setError(shiftError(e));

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={color.accent} />}
    >
      <View style={styles.weekBar}>
        <Pressable style={styles.nav} onPress={() => setStart(addDays(start, -7))} hitSlop={8}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <View style={styles.weekText}>
          <Text style={styles.weekLabel}>{weekLabel(start)}</Text>
          <Text style={[styles.openCount, open === 0 && styles.openCountOk]}>
            {open === 0 ? 'Fully signed up' : `${open} slot${open === 1 ? '' : 's'} unfilled`}
          </Text>
        </View>
        <Pressable style={styles.nav} onPress={() => setStart(addDays(start, 7))} hitSlop={8}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      {open > 0 ? (
        <Pressable
          style={styles.copyBtn}
          disabled={copy.isPending}
          onPress={() =>
            copy.mutate({ from: addDays(start, -7), to: start }, { onError })
          }
        >
          <Text style={styles.copyText}>
            {copy.isPending ? 'Copying...' : 'Fill the blanks from last week'}
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {days.map((day) => (
        <DayCard
          key={day.date}
          day={day}
          myId={myId}
          coverOpenFor={coverOpen}
          members={members.data ?? []}
          onToggleCover={(id) => setCoverOpen((v) => (v === id ? null : id))}
          onClaim={(s) => run(() => claim.mutate({ id: s.id, version: s.version }, { onError }))}
          onRelease={(s) => run(() => release.mutate({ id: s.id, version: s.version }, { onError }))}
          onComplete={(s) => run(() => complete.mutate({ id: s.id, version: s.version }, { onError }))}
          onCover={(s, userId) => {
            setCoverOpen(null);
            run(() => cover.mutate({ id: s.id, userId, version: s.version }, { onError }));
          }}
        />
      ))}

      {load.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.section}>WHO IS CARRYING THIS WEEK</Text>
          {load.map((row) => (
            <View key={row.userId} style={styles.loadRow}>
              <Text style={styles.loadName}>{row.name}</Text>
              <Text style={styles.loadMeta}>
                {row.claimed} slot{row.claimed === 1 ? '' : 's'} · {row.completed} done
                {row.covering > 0 ? ` · covering ${row.covering}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function DayCard(props: {
  day: DayView;
  myId: string | null;
  members: { id: string; name: string }[];
  coverOpenFor: string | null;
  onToggleCover: (id: string) => void;
  onClaim: (s: ShiftView) => void;
  onRelease: (s: ShiftView) => void;
  onComplete: (s: ShiftView) => void;
  onCover: (s: ShiftView, userId: string) => void;
}) {
  const { day } = props;
  return (
    <View style={[styles.card, day.isToday && styles.cardToday, day.isPast && styles.cardPast]}>
      <View style={styles.dayHead}>
        <Text style={styles.dow}>{day.weekdayShort.toUpperCase()}</Text>
        <Text style={styles.dom}>{day.dayOfMonth}</Text>
        {day.isToday ? <Text style={styles.todayTag}>TODAY</Text> : null}
        {day.openCount > 0 ? <Text style={styles.dayOpen}>{day.openCount} open</Text> : null}
      </View>

      {day.shifts.map((s) => (
        <View key={s.id} style={styles.shiftRow}>
          <View style={styles.shiftText}>
            <Text style={styles.roleName}>
              {s.role === 'fridge' && s.detail ? `${s.detail} fridge` : ROLE_SHORT[s.role]}
            </Text>
            <Text
              style={[
                styles.who,
                s.status === 'open' && styles.whoOpen,
                s.status === 'done' && styles.whoDone,
                s.covered && styles.whoCovered,
              ]}
            >
              {s.status === 'done' ? `✓ ${s.whoLabel}` : s.whoLabel}
            </Text>
          </View>

          <View style={styles.shiftActions}>
            {s.status === 'open' ? (
              <>
                <Pressable style={styles.primary} onPress={() => props.onClaim(s)}>
                  <Text style={styles.primaryText}>I'll do it</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={() => props.onToggleCover(s.id)}>
                  <Text style={styles.ghostText}>Assign</Text>
                </Pressable>
              </>
            ) : null}

            {s.status === 'claimed' && s.mine ? (
              <>
                <Pressable style={styles.primary} onPress={() => props.onComplete(s)}>
                  <Text style={styles.primaryText}>Done</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={() => props.onRelease(s)}>
                  <Text style={styles.ghostText}>Give it up</Text>
                </Pressable>
              </>
            ) : null}

            {s.status === 'claimed' && !s.mine ? (
              <Pressable style={styles.ghost} onPress={() => props.onToggleCover(s.id)}>
                <Text style={styles.ghostText}>Swap</Text>
              </Pressable>
            ) : null}
          </View>

          {props.coverOpenFor === s.id ? (
            <View style={styles.memberChips}>
              {props.members.map((m) => (
                <Pressable key={m.id} style={styles.chip} onPress={() => props.onCover(s, m.id)}>
                  <Text style={styles.chipText}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  weekBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nav: { minHeight: TOUCH, minWidth: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navText: { color: color.accent, fontSize: 26, fontWeight: '700' },
  weekText: { flex: 1, alignItems: 'center' },
  weekLabel: { ...t.heading },
  openCount: { color: color.warning, fontSize: 12, fontWeight: '700', marginTop: 2 },
  openCountOk: { color: color.success },

  copyBtn: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.accentSoft,
  },
  copyText: { color: color.accent, fontWeight: '700', fontSize: 14 },

  card: { ...cardBase, gap: space.xs },
  cardToday: { borderColor: color.accent, borderWidth: 2 },
  cardPast: { opacity: 0.62 },

  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.xs },
  dow: { ...t.section },
  dom: { ...t.heading, fontSize: 20 },
  todayTag: { color: color.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  dayOpen: { ...t.meta, marginLeft: 'auto', color: color.warning },

  shiftRow: { paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.border, gap: 6 },
  shiftText: { gap: 1 },
  roleName: { ...t.body, fontWeight: '600' },
  who: { ...t.detail },
  whoOpen: { color: color.warning, fontWeight: '600' },
  whoDone: { color: color.success },
  whoCovered: { color: color.accent },

  shiftActions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  primary: {
    minHeight: TOUCH - 6,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  primaryText: { color: color.accentInk, fontWeight: '700', fontSize: 13 },
  ghost: {
    minHeight: TOUCH - 6,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  ghostText: { color: color.textMuted, fontWeight: '600', fontSize: 13 },

  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    minHeight: TOUCH - 6,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  chipText: { color: color.text, fontSize: 13, fontWeight: '600' },

  section: { ...t.section },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  loadName: { ...t.body, fontWeight: '600' },
  loadMeta: { ...t.meta },

  err: { color: color.danger, fontSize: 14 },
});
