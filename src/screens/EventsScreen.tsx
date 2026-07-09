import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createEvent, type EventView } from '../api/events';
import { useEvents } from '../hooks/useEvents';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayDateString(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function EventsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useEvents(householdId);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [time, setTime] = useState('18:00');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!title.trim()) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) {
      setError('Use date YYYY-MM-DD and time HH:MM (24-hour).');
      return;
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setAdding(true);
    setError(null);
    try {
      await createEvent(householdId, title.trim(), start.toISOString(), end.toISOString());
      setTitle('');
      await qc.invalidateQueries({ queryKey: ['events', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setAdding(false);
    }
  };

  const renderItem = ({ item }: { item: EventView }) => (
    <View style={styles.card}>
      <View style={styles.when}>
        <Text style={styles.day}>{dayLabel(item.startsAt)}</Text>
        <Text style={styles.time}>{timeLabel(item.startsAt)}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Event (e.g., Cora soccer practice)"
          placeholderTextColor="#6b6f8c"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6b6f8c"
            value={date}
            onChangeText={setDate}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="HH:MM"
            placeholderTextColor="#6b6f8c"
            value={time}
            onChangeText={setTime}
          />
        </View>
        <Pressable style={[styles.addBtn, adding && styles.busy]} disabled={adding} onPress={add}>
          <Text style={styles.addText}>Add event</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>

      {q.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spinner} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>Nothing on the calendar yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  composer: { padding: 20, paddingBottom: 8, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  addBtn: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  busy: { opacity: 0.6 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 4 },
  when: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  day: { color: '#7c9bff', fontSize: 13, fontWeight: '600' },
  time: { color: '#a6abcc', fontSize: 13 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  empty: { color: '#8a8fb0', textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: '#ff9a9a', fontSize: 14 },
});
