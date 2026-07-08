import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { respondToDinner, type MealView } from '../api/meals';
import { dinnerResponseLabel, dinnerSummaryLabel, type MealResponse } from '../domain/meals';
import { useMeals } from '../hooks/useMeals';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// The two primary answers plus save-a-plate — every choice is one tap.
const CHOICES: MealResponse[] = ['home', 'away', 'save_plate'];

export function MealsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useMeals(householdId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (m: MealView, choice: MealResponse) => {
    setBusyId(m.id);
    setError(null);
    try {
      await respondToDinner(m.id, choice);
      await qc.invalidateQueries({ queryKey: ['meals', householdId] });
      // A dinner answer can clear a Today exception, so refresh it too.
      await qc.invalidateQueries({ queryKey: ['today', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: MealView }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {timeLabel(item.plannedAt)} · {dinnerSummaryLabel(item.summary)}
      </Text>
      <View style={styles.opts}>
        {CHOICES.map((choice) => (
          <Pressable
            key={choice}
            disabled={busyId === item.id}
            style={[styles.opt, item.myResponse === choice && styles.optActive]}
            onPress={() => respond(item, choice)}
          >
            <Text style={[styles.optText, item.myResponse === choice && styles.optTextActive]}>
              {dinnerResponseLabel(choice)}
            </Text>
          </Pressable>
        ))}
      </View>
      {item.outstandingNames.length > 0 ? (
        <Text style={styles.waiting}>Waiting on {item.outstandingNames.join(', ')}</Text>
      ) : (
        <Text style={styles.allin}>Everyone has answered</Text>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {q.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spinner} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>No meals planned yet.</Text>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  spinner: { marginTop: 24 },
  list: { padding: 20, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 10 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  meta: { color: '#a6abcc', fontSize: 14 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  optActive: { backgroundColor: '#7c9bff', borderColor: '#7c9bff' },
  optText: { color: '#c4c8e0', fontSize: 14 },
  optTextActive: { color: '#0f1220', fontWeight: '700' },
  waiting: { color: '#ffb86b', fontSize: 13 },
  allin: { color: '#7c9bff', fontSize: 13 },
  empty: { color: '#8a8fb0', textAlign: 'center', marginTop: 24, fontSize: 15 },
  err: { color: '#ff9a9a', textAlign: 'center', padding: 16, fontSize: 14 },
});
