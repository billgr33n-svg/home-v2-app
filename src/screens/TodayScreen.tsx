import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useTodayFeed } from '../hooks/useToday';
import type { Priority, TodayItem, TodayItemKind } from '../domain/today';

const KIND_LABEL: Record<TodayItemKind, string> = {
  ride_unassigned: 'Ride',
  ride: 'Ride',
  dinner_response_needed: 'Dinner',
  announcement: 'Announcement',
  task_due: 'Task',
  maintenance: 'Home',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  P0: '#ff6b6b',
  P1: '#ffb86b',
  P2: '#7c9bff',
};

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : 'Unexpected error';
  return /permission|rls|denied|not allowed/i.test(message)
    ? 'You do not have access to this household.'
    : message;
}

// Content-only. The tab shell (MainScreen) provides the header and sign-out.
export function TodayScreen({ householdId }: { householdId: string }) {
  const q = useTodayFeed(householdId);

  const renderItem = ({ item }: { item: TodayItem }) => (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
      <View style={styles.itemBody}>
        <View style={styles.itemHead}>
          <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
          {item.needsDecision && <Text style={styles.decision}>NEEDS DECISION</Text>}
        </View>
        <Text style={styles.itemTitle}>{item.title}</Text>
        {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
      </View>
    </View>
  );

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
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
  if (!q.data || q.data.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>All clear</Text>
        <Text style={styles.stateBody}>No decisions or exceptions for today.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={q.data}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#ffffff" />}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  stateBody: { color: '#8a8fb0', fontSize: 15, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: '#1a1e33', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#c4c8e0', fontSize: 15, fontWeight: '600' },
  list: { padding: 20, gap: 10 },
  item: { flexDirection: 'row', backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  itemBody: { flex: 1, gap: 2 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { color: '#8a8fb0', fontSize: 12, letterSpacing: 1 },
  decision: { color: '#ffb86b', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  itemTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  itemDetail: { color: '#a6abcc', fontSize: 14 },
});
