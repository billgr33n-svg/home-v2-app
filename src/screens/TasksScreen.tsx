import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { addTask, claimTask, completeTask } from '../api/tasks';
import type { TaskView } from '../domain/tasks';
import { useTasks } from '../hooks/useTasks';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function TasksScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useTasks(householdId);
  const [title, setTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['tasks', householdId] });
    await qc.invalidateQueries({ queryKey: ['today', householdId] });
  };

  const add = async () => {
    if (!title.trim()) return;
    setBusyId('new');
    setError(null);
    try {
      await addTask(householdId, title.trim(), null);
      setTitle('');
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const claim = async (t: TaskView) => {
    setBusyId(t.id);
    setError(null);
    try {
      await claimTask(t.id, t.version);
      await refresh();
    } catch (e) {
      // A stale version means someone claimed first (ADR-0008).
      setError(msg(e));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (t: TaskView) => {
    setBusyId(t.id);
    setError(null);
    try {
      await completeTask(t.id, t.version);
      await refresh();
    } catch (e) {
      setError(msg(e));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: TaskView }) => (
    <View style={[styles.card, item.unassigned && styles.cardAlert]}>
      <View style={styles.head}>
        <Text style={styles.title}>{item.title}</Text>
        {item.recurring ? <Text style={styles.repeats}>REPEATS</Text> : null}
      </View>
      <Text style={styles.meta}>
        {item.statusLabel} · {item.ownerLabel}
      </Text>
      <View style={styles.row}>
        {item.unassigned && (
          <Pressable style={styles.btn} disabled={busyId === item.id} onPress={() => claim(item)}>
            <Text style={styles.btnText}>Claim</Text>
          </Pressable>
        )}
        <Pressable style={[styles.btn, styles.btnAlt]} disabled={busyId === item.id} onPress={() => complete(item)}>
          <Text style={styles.btnAltText}>Complete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Add a task"
          placeholderTextColor="#6b6f8c"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable style={[styles.add, busyId === 'new' && styles.busy]} disabled={busyId === 'new'} onPress={add}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spin} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>No open tasks. All handled.</Text>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  composer: { flexDirection: 'row', gap: 8, padding: 20, paddingBottom: 8 },
  input: { flex: 1, backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  add: { backgroundColor: '#7c9bff', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  busy: { opacity: 0.6 },
  addText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  spin: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 8 },
  cardAlert: { borderWidth: 1, borderColor: '#ffb86b' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600', flex: 1 },
  repeats: { color: '#7c9bff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  meta: { color: '#a6abcc', fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { backgroundColor: '#7c9bff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: '#0f1220', fontWeight: '700' },
  btnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3a3f60' },
  btnAltText: { color: '#c4c8e0', fontWeight: '600' },
  empty: { color: '#8a8fb0', textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: '#ff9a9a', textAlign: 'center', padding: 16, fontSize: 14 },
});
