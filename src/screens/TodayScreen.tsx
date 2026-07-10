import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { resolveMaintenanceIssue } from '../api/maintenance';
import { respondToDinner, setMealCook, type MealView } from '../api/meals';
import { respondToPoll } from '../api/polls';
import { assignRideDriver } from '../api/rides';
import { assignTask, completeTask } from '../api/tasks';
import { type HouseholdMember } from '../api/members';
import { useAuth } from '../auth/AuthProvider';
import { dateKey } from '../domain/calendar';
import { dinnerResponseLabel, dinnerSummaryLabel } from '../domain/meals';
import type { Priority, TodayItem, TodayItemKind } from '../domain/today';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import { useMeals } from '../hooks/useMeals';
import { useTodayFeed } from '../hooks/useToday';
import type { ScreenKey } from '../navigation/sections';
import { CalendarCard } from './HouseCalendar';
import { KitchenTodayCard } from './KitchenTodayCard';
import { UseSoonCard } from './UseSoonCard';

import { cardBase, color } from '../theme';

const KIND_LABEL: Record<TodayItemKind, string> = {
  ride_unassigned: 'Ride',
  ride: 'Ride',
  dinner_response_needed: 'Dinner',
  poll_response_needed: 'Poll',
  announcement: 'Announcement',
  task_due: 'Task',
  maintenance: 'Home',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  P0: color.danger,
  P1: color.warning,
  P2: color.accent,
};

// What "assign" means for each kind of Today item.
const ASSIGN_LABEL: Partial<Record<TodayItemKind, string>> = {
  task_due: 'Assign owner',
  ride_unassigned: 'Assign driver',
  ride: 'Assign driver',
  dinner_response_needed: 'Assign cook',
};

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : 'Unexpected error';
  return /permission|rls|denied|not allowed/i.test(message)
    ? 'You do not have access to this household.'
    : message;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function stateLine(needCount: number): string {
  if (needCount === 0) return 'Nothing needs a decision right now.';
  return `${needCount} thing${needCount === 1 ? '' : 's'} need your attention.`;
}

/**
 * Tonight's dinner as a confirmation, not only an exception. The old Today
 * surfaced dinner only when a response was missing; on a settled night it said
 * nothing, which is exactly the reassurance the household administrator wants.
 * So the plan and the cook show whether or not a vote is outstanding, and a
 * one-tap in/out sits right here for anyone who has not answered.
 */
function TonightCard(props: { householdId: string; onOpenMeals?: () => void }) {
  const qc = useQueryClient();
  const q = useMeals(props.householdId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stay quiet while loading — the schedule card above already shows a spinner,
  // and a second one makes Today feel busy when it should feel calm.
  if (q.isLoading) return null;

  const today = dateKey(new Date());
  const dinner = (q.data ?? []).find((m: MealView) => dateKey(new Date(m.plannedAt)) === today) ?? null;

  const respond = async (r: 'home' | 'away') => {
    if (!dinner) return;
    setBusy(true);
    setError(null);
    try {
      await respondToDinner(dinner.id, r);
      await qc.invalidateQueries({ queryKey: ['meals', props.householdId] });
      await qc.invalidateQueries({ queryKey: ['today', props.householdId] });
    } catch {
      setError('That did not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLeaf}>TONIGHT'S DINNER</Text>
      {dinner ? (
        <>
          <Text style={styles.dinnerTitle}>{dinner.title}</Text>
          <Text style={styles.dinnerMeta}>
            {dinner.cookName ? `${dinner.cookName} cooking` : 'No cook yet'} · {dinnerSummaryLabel(dinner.summary)}
          </Text>
          {dinner.myResponse == null ? (
            <View style={styles.rowBtns}>
              <Pressable style={styles.solidBtn} disabled={busy} onPress={() => respond('home')}>
                <Text style={styles.solidText}>{busy ? '…' : "I'm in"}</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} disabled={busy} onPress={() => respond('away')}>
                <Text style={styles.ghostText}>Out tonight</Text>
              </Pressable>
              {props.onOpenMeals ? (
                <Pressable style={styles.linkBtn} onPress={props.onOpenMeals}>
                  <Text style={styles.linkText}>Details ›</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable disabled={!props.onOpenMeals} onPress={props.onOpenMeals}>
              <Text style={styles.dinnerYou}>
                You: {dinnerResponseLabel(dinner.myResponse)}
                {props.onOpenMeals ? '   ·   Change ›' : ''}
              </Text>
            </Pressable>
          )}
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.dinnerMeta}>No dinner planned — everyone is on their own tonight.</Text>
          {props.onOpenMeals ? (
            <Pressable style={styles.solidBtnStart} onPress={props.onOpenMeals}>
              <Text style={styles.solidText}>Plan dinner</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

export function TodayScreen({
  householdId,
  onOpenScreen,
}: {
  householdId: string;
  onOpenScreen?: (k: ScreenKey) => void;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const q = useTodayFeed(householdId);
  const membersQ = useHouseholdMembers(householdId);
  const members = membersQ.data ?? [];

  const myId = session?.user.id ?? null;
  const myName = members.find((m: HouseholdMember) => m.id === myId)?.name ?? null;
  const firstName = myName ? myName.split(' ')[0] : null;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['today', householdId] }),
      qc.invalidateQueries({ queryKey: ['rides', householdId] }),
      qc.invalidateQueries({ queryKey: ['meals', householdId] }),
      qc.invalidateQueries({ queryKey: ['tasks', householdId] }),
      qc.invalidateQueries({ queryKey: ['maintenance', householdId] }),
      qc.invalidateQueries({ queryKey: ['polls', householdId] }),
      qc.invalidateQueries({ queryKey: ['events-range', householdId] }),
      qc.invalidateQueries({ queryKey: ['lots', householdId] }),
    ]);
  };

  const run = async (item: TodayItem, fn: () => Promise<void>) => {
    setBusyId(item.id);
    setError(null);
    try {
      await fn();
      setExpanded(null);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const assign = (item: TodayItem, userId: string | null) =>
    run(item, async () => {
      if (item.kind === 'task_due') await assignTask(item.entityId, userId);
      else if (item.kind === 'ride' || item.kind === 'ride_unassigned') await assignRideDriver(item.entityId, userId);
      else if (item.kind === 'dinner_response_needed') await setMealCook(item.entityId, userId);
    });

  const finish = (item: TodayItem) =>
    run(item, async () => {
      if (item.kind === 'task_due') await completeTask(item.entityId, item.version ?? 1);
      else if (item.kind === 'maintenance') await resolveMaintenanceIssue(item.entityId);
    });

  const vote = (item: TodayItem, option: string) =>
    run(item, async () => {
      await respondToPoll(item.entityId, option);
    });

  const renderItem = (item: TodayItem) => {
    const assignLabel = ASSIGN_LABEL[item.kind];
    const canFinish = item.kind === 'task_due' || item.kind === 'maintenance';
    const isPoll = item.kind === 'poll_response_needed';
    const actionable = Boolean(assignLabel) || canFinish || isPoll;
    const isOpen = expanded === item.id;

    return (
      <Pressable
        key={item.id}
        style={styles.item}
        onPress={() => actionable && setExpanded(isOpen ? null : item.id)}
      >
        <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
        <View style={styles.itemBody}>
          <View style={styles.itemHead}>
            <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
            {item.needsDecision && <Text style={styles.decision}>NEEDS DECISION</Text>}
            {actionable && !isOpen ? <Text style={styles.tapHint}>{isPoll ? 'tap to vote' : 'tap to edit'}</Text> : null}
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}

          {isOpen && actionable ? (
            <View style={styles.actions}>
              {assignLabel ? (
                <>
                  <Text style={styles.actionLabel}>{assignLabel}</Text>
                  <View style={styles.chips}>
                    {members.map((m: HouseholdMember) => (
                      <Pressable
                        key={m.id}
                        style={[styles.pill, item.ownerId === m.id && styles.pillActive]}
                        disabled={busyId === item.id}
                        onPress={() => assign(item, m.id)}
                      >
                        <Text style={[styles.pillText, item.ownerId === m.id && styles.pillTextActive]}>{m.name}</Text>
                      </Pressable>
                    ))}
                    <Pressable style={styles.pill} disabled={busyId === item.id} onPress={() => assign(item, null)}>
                      <Text style={styles.clearText}>Unassign</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {isPoll && item.options ? (
                <>
                  <Text style={styles.actionLabel}>Your vote</Text>
                  <View style={styles.chips}>
                    {item.options.map((opt) => (
                      <Pressable
                        key={opt}
                        style={styles.pill}
                        disabled={busyId === item.id}
                        onPress={() => vote(item, opt)}
                      >
                        <Text style={styles.pillText}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {canFinish ? (
                <Pressable style={styles.finishBtn} disabled={busyId === item.id} onPress={() => finish(item)}>
                  <Text style={styles.finishText}>
                    {item.kind === 'task_due' ? 'Mark complete' : 'Mark resolved'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Could not load Today</Text>
        <Text style={styles.stateBody}>{friendlyError(q.error)}</Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const now = new Date();
  const items = q.data ?? [];

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={color.accent} />}
      >
        <View style={styles.greet}>
          <Text style={styles.greetKicker}>
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </Text>
          <Text style={styles.greetHi}>
            {greetingFor(now.getHours())}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={styles.greetState}>{stateLine(items.length)}</Text>
        </View>

        <CalendarCard householdId={householdId} />
        <TonightCard householdId={householdId} onOpenMeals={onOpenScreen ? () => onOpenScreen('meals') : undefined} />

        <View style={styles.needsHead}>
          <Text style={styles.sectionLeaf}>NEEDS YOU</Text>
          {items.length > 0 ? <Text style={styles.needBadge}>{items.length}</Text> : null}
        </View>
        {items.length === 0 ? (
          <View style={styles.clear}>
            <Text style={styles.clearBodyTitle}>You are all caught up</Text>
            <Text style={styles.clearBody}>No decisions or exceptions right now.</Text>
          </View>
        ) : (
          items.map((item: TodayItem) => renderItem(item))
        )}

        <KitchenTodayCard householdId={householdId} />
        <UseSoonCard householdId={householdId} />

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateTitle: { color: color.text, fontSize: 18, fontWeight: '600' },
  stateBody: { color: color.textFaint, fontSize: 15, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: color.surfaceInput, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: color.textMuted, fontSize: 15, fontWeight: '600' },
  list: { padding: 20, gap: 10 },

  greet: { paddingHorizontal: 2, paddingBottom: 2, gap: 2 },
  greetKicker: { color: color.success, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  greetHi: { color: color.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  greetState: { color: color.textMuted, fontSize: 13, marginTop: 2 },

  card: { ...cardBase, gap: 4 },
  sectionLeaf: { color: color.success, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },

  dinnerTitle: { color: color.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  dinnerMeta: { color: color.textMuted, fontSize: 14, marginTop: 2 },
  dinnerYou: { color: color.success, fontSize: 14, fontWeight: '600', marginTop: 10 },

  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  solidBtn: { backgroundColor: color.accent, borderRadius: 10, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  solidBtnStart: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: color.accent, borderRadius: 10, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  solidText: { color: color.accentInk, fontWeight: '700', fontSize: 14 },
  ghostBtn: { borderWidth: 1, borderColor: color.borderStrong, borderRadius: 10, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  ghostText: { color: color.textMuted, fontWeight: '700', fontSize: 14 },
  linkBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 },
  linkText: { color: color.accent, fontSize: 14, fontWeight: '600' },

  needsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 2 },
  needBadge: {
    color: color.accent,
    backgroundColor: color.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  clear: { backgroundColor: color.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: color.border, gap: 2 },
  clearBodyTitle: { color: color.text, fontSize: 16, fontWeight: '600' },
  clearBody: { color: color.textFaint, fontSize: 14 },

  item: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: color.border },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  itemBody: { flex: 1, gap: 2 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { color: color.textFaint, fontSize: 12, letterSpacing: 1 },
  decision: { color: color.warning, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tapHint: { color: color.textFaint, fontSize: 11 },
  itemTitle: { color: color.text, fontSize: 16, fontWeight: '600' },
  itemDetail: { color: color.textMuted, fontSize: 14 },
  actions: { marginTop: 10, gap: 8 },
  actionLabel: { color: color.textFaint, fontSize: 12, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: color.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { backgroundColor: color.accent, borderColor: color.accent },
  pillText: { color: color.textMuted, fontSize: 14 },
  pillTextActive: { color: color.accentInk, fontWeight: '700' },
  clearText: { color: color.danger, fontSize: 14 },
  finishBtn: { alignSelf: 'flex-start', backgroundColor: color.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  finishText: { color: color.accentInk, fontWeight: '700' },
  err: { color: color.danger, textAlign: 'center', padding: 16, fontSize: 14 },
});
