import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createMeal, respondToDinner, setMealCook, type MealView } from '../api/meals';
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

const CHOICES: MealResponse[] = ['home', 'away', 'save_plate'];

export function MealsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useMeals(householdId);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['meals', householdId] });
    await qc.invalidateQueries({ queryKey: ['today', householdId] });
  };

  const add = async (status: 'planned' | 'requested') => {
    if (!title.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await createMeal(householdId, title.trim(), status);
      setTitle('');
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setAdding(false);
    }
  };

  const respond = async (m: MealView, choice: MealResponse) => {
    setBusyId(m.id);
    setError(null);
    try {
      await respondToDinner(m.id, choice);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleCook = async (m: MealView) => {
    setBusyId(m.id);
    setError(null);
    try {
      await setMealCook(m.id, !m.iAmCook);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: MealView }) => (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{item.title}</Text>
        {item.status === 'requested' ? <Text style={styles.reqTag}>REQUESTED</Text> : null}
      </View>
      <Text style={styles.meta}>
        {timeLabel(item.plannedAt)} · {dinnerSummaryLabel(item.summary)}
      </Text>

      <View style={styles.cookRow}>
        <Text style={item.cookName ? styles.cookName : styles.noCook}>
          {item.cookName ? `Cook: ${item.cookName}` : 'No cook yet'}
        </Text>
        <Pressable
          style={[styles.cookBtn, item.iAmCook && styles.cookBtnMine]}
          disabled={busyId === item.id}
          onPress={() => toggleCook(item)}
        >
          <Text style={[styles.cookBtnText, item.iAmCook && styles.cookBtnTextMine]}>
            {item.iAmCook ? "You're cooking" : "I'll cook"}
          </Text>
        </Pressable>
      </View>

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
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Meal (e.g., Chicken tacos)"
          placeholderTextColor="#6b6f8c"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.composerRow}>
          <Pressable style={[styles.addBtn, adding && styles.busy]} disabled={adding} onPress={() => add('planned')}>
            <Text style={styles.addText}>Plan for tonight</Text>
          </Pressable>
          <Pressable style={[styles.addBtn, styles.addBtnAlt, adding && styles.busy]} disabled={adding} onPress={() => add('requested')}>
            <Text style={styles.addTextAlt}>Request</Text>
          </Pressable>
        </View>
      </View>

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
  composer: { padding: 20, paddingBottom: 8, gap: 10 },
  composerRow: { flexDirection: 'row', gap: 10 },
  addBtn: { flex: 1, backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addBtnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3a3f60' },
  addText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  addTextAlt: { color: '#c4c8e0', fontWeight: '600', fontSize: 15 },
  busy: { opacity: 0.6 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600', flex: 1 },
  reqTag: { color: '#ffb86b', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  meta: { color: '#a6abcc', fontSize: 14 },
  cookRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cookName: { color: '#c4c8e0', fontSize: 13 },
  noCook: { color: '#ffb86b', fontSize: 13 },
  cookBtn: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  cookBtnMine: { backgroundColor: '#7c9bff', borderColor: '#7c9bff' },
  cookBtnText: { color: '#c4c8e0', fontSize: 13, fontWeight: '600' },
  cookBtnTextMine: { color: '#0f1220', fontWeight: '700' },
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
