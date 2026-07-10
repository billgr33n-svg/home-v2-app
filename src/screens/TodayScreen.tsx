import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { resolveMaintenanceIssue } from '../api/maintenance';
import { setMealCook } from '../api/meals';
import { assignRideDriver } from '../api/rides';
import { assignTask, completeTask } from '../api/tasks';
import type { Priority, TodayItem, TodayItemKind } from '../domain/today';
import { type HouseholdMember } from '../api/members';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import { useTodayFeed } from '../hooks/useToday';
import { CalendarCard } from './HouseCalendar';
import { KitchenTodayCard } from './KitchenTodayCard';
import { UseSoonCard } from './UseSoonCard';

import { color } from '../theme';

const KIND_LABEL: Record<TodayItemKind, string> = {
  ride_unassigned: 'Ride',
  ride: 'Ride',
  dinner_response_needed: 'Dinner',
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

export function TodayScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useTodayFeed(householdId);
  const membersQ = useHouseholdMembers(householdId);
  const members = membersQ.data ?? [];

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

  const renderItem = ({ item }: { item: TodayItem }) => {
    const assignLabel = ASSIGN_LABEL[item.kind];
    const canFinish = item.kind === 'task_due' || item.kind === 'maintenance';
    const actionable = Boolean(assignLabel) || canFinish;
    const isOpen = expanded === item.id;

    return (
      <Pressable
        style={styles.item}
        onPress={() => actionable && setExpanded(isOpen ? null : item.id)}
      >
        <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
        <View style={styles.itemBody}>
          <View style={styles.itemHead}>
            <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
            {item.needsDecision && <Text style={styles.decision}>NEEDS DECISION</Text>}
            {actionable && !isOpen ? <Text style={styles.tapHint}>tap to edit</Text> : null}
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
  // Food that is about to die is still news on a day with no decisions, so the
  // Use Soon card renders in the empty state too rather than hiding behind it.
  if (!q.data || q.data.length === 0) {
    return (
      <View style={styles.wrap}>
        <ScrollView contentContainerStyle={styles.list}>
          <CalendarCard householdId={householdId} />
          <KitchenTodayCard householdId={householdId} />
          <UseSoonCard householdId={householdId} />
          <View style={styles.centeredInline}>
            <Text style={styles.stateTitle}>All clear</Text>
            <Text style={styles.stateBody}>No decisions or exceptions for today.</Text>
          </View>
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <FlatList
        data={q.data}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <CalendarCard householdId={householdId} />
            <KitchenTodayCard householdId={householdId} />
            <UseSoonCard householdId={householdId} />
          </>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={color.accent} />}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  centeredInline: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 48 },
  stateTitle: { color: color.text, fontSize: 18, fontWeight: '600' },
  stateBody: { color: color.textFaint, fontSize: 15, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: color.surfaceInput, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: color.textMuted, fontSize: 15, fontWeight: '600' },
  list: { padding: 20, gap: 10 },
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
