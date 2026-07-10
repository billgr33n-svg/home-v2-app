import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createEvent, type EventView } from '../api/events';
import { useEvents } from '../hooks/useEvents';

import { CalendarConnect } from './CalendarConnect';
import { EventDetailModal, HouseCalendar } from './HouseCalendar';

import { color, radius } from '../theme';

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
  // All-day events carry a bare 'YYYY-MM-DD'; new Date() would parse that as
  // UTC midnight and render it a day early in Georgia. Build it from parts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
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

type ViewMode = 'list' | 'week' | 'month';

export function EventsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useEvents(householdId);

  const [view, setView] = useState<ViewMode>('list');
  const [openEvent, setOpenEvent] = useState<EventView | null>(null);
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
    <Pressable style={styles.card} onPress={() => setOpenEvent(item)}>
      <View style={styles.when}>
        <Text style={styles.day}>{dayLabel(item.startsAt)}</Text>
        <Text style={styles.time}>{item.allDay ? 'All day' : timeLabel(item.startsAt)}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      {item.location ? <Text style={styles.where}>📍 {item.location}</Text> : null}
    </Pressable>
  );

  // Week and month delegate wholesale to the shared HouseCalendar, so the
  // Today card's sheet and this screen can never drift apart.
  if (view !== 'list') {
    return (
      <View style={styles.wrap}>
        <ViewToggle view={view} onChange={setView} />
        <HouseCalendar householdId={householdId} initialMode={view} key={view} hideModeToggle />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ViewToggle view={view} onChange={setView} />
      <View style={styles.connect}>
        <CalendarConnect />
      </View>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Event (e.g., Cora soccer practice)"
          placeholderTextColor={color.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={color.textFaint}
            value={date}
            onChangeText={setDate}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="HH:MM"
            placeholderTextColor={color.textFaint}
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
        <ActivityIndicator color={color.accent} style={styles.spinner} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>Nothing on the calendar yet.</Text>
      )}
      <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </View>
  );
}

function ViewToggle(props: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <View style={styles.toggle}>
      {(['list', 'week', 'month'] as const).map((v) => (
        <Pressable
          key={v}
          style={[styles.toggleBtn, props.view === v && styles.toggleOn]}
          onPress={() => props.onChange(v)}
        >
          <Text style={[styles.toggleText, props.view === v && styles.toggleTextOn]}>
            {v === 'list' ? 'List' : v === 'week' ? 'Week' : 'Month'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  connect: { paddingHorizontal: 20, paddingTop: 16 },
  wrap: { flex: 1 },
  composer: { padding: 20, paddingBottom: 8, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: color.borderStrong },
  addBtn: { backgroundColor: color.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addText: { color: color.accentInk, fontWeight: '700', fontSize: 15 },
  busy: { opacity: 0.6 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: color.border },
  when: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  day: { color: color.accent, fontSize: 13, fontWeight: '600' },
  time: { color: color.textMuted, fontSize: 13 },
  title: { color: color.text, fontSize: 16, fontWeight: '600' },
  where: { color: color.textMuted, fontSize: 13 },
  empty: { color: color.textFaint, textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: color.danger, fontSize: 14 },

  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: 12,
  },
  toggleBtn: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 20, borderRadius: radius.pill },
  toggleOn: { backgroundColor: color.accent },
  toggleText: { color: color.textMuted, fontSize: 14, fontWeight: '600' },
  toggleTextOn: { color: color.accentInk },
});
