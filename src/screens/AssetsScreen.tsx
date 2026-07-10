import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { completeMaintenance } from '../api/maintenance';
import type { MaintenanceStatus, MaintenanceView } from '../domain/maintenance';
import { useMaintenance } from '../hooks/useMaintenance';

import { color } from '../theme';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  overdue: color.danger,
  due_soon: color.warning,
  ok: color.accent,
};

export function AssetsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useMaintenance(householdId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = async (m: MaintenanceView) => {
    setBusyId(m.id);
    setError(null);
    try {
      await completeMaintenance(m.id);
      await qc.invalidateQueries({ queryKey: ['maintenance', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: MaintenanceView }) => (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[item.status] }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.assetName} · {item.dueLabel}
        </Text>
      </View>
      <Pressable style={styles.btn} disabled={busyId === item.id} onPress={() => done(item)}>
        <Text style={styles.btnText}>Mark done</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {q.isLoading ? (
        <ActivityIndicator color={color.accent} style={styles.spin} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>No maintenance scheduled.</Text>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  spin: { marginTop: 24 },
  list: { padding: 20, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: color.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  title: { color: color.text, fontSize: 16, fontWeight: '600' },
  meta: { color: color.textMuted, fontSize: 14, marginTop: 2 },
  btn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: color.textMuted, fontWeight: '600', fontSize: 13 },
  empty: { color: color.textFaint, textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: color.danger, textAlign: 'center', padding: 16, fontSize: 14 },
});
