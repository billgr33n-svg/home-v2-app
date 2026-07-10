import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createMeal, respondToDinner, setMealCook, signUpToCook, type MealView } from '../api/meals';
import { dinnerResponseLabel, dinnerSummaryLabel, type MealResponse } from '../domain/meals';
import { type HouseholdMember } from '../api/members';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import { useMeals } from '../hooks/useMeals';
import { MealIngredients } from './MealIngredients';

import { color } from '../theme';

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
  const membersQ = useHouseholdMembers(householdId);
  const members = membersQ.data ?? [];

  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
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

  const toggleSelf = async (m: MealView) => {
    setBusyId(m.id);
    setError(null);
    try {
      await signUpToCook(m.id, !m.iAmCook);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const assignTo = async (m: MealView, userId: string | null) => {
    setBusyId(m.id);
    setError(null);
    try {
      await setMealCook(m.id, userId);
      setAssignOpen(null);
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
        <View style={styles.cookBtns}>
          <Pressable
            style={[styles.pill, item.iAmCook && styles.pillActive]}
            disabled={busyId === item.id}
            onPress={() => toggleSelf(item)}
          >
            <Text style={[styles.pillText, item.iAmCook && styles.pillTextActive]}>
              {item.iAmCook ? "You're cooking" : "I'll cook"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            disabled={busyId === item.id}
            onPress={() => setAssignOpen(assignOpen === item.id ? null : item.id)}
          >
            <Text style={styles.pillText}>Assign</Text>
          </Pressable>
        </View>
      </View>

      {assignOpen === item.id && (
        <View style={styles.chips}>
          {members.map((mem: HouseholdMember) => (
            <Pressable
              key={mem.id}
              style={[styles.pill, item.cookId === mem.id && styles.pillActive]}
              disabled={busyId === item.id}
              onPress={() => assignTo(item, mem.id)}
            >
              <Text style={[styles.pillText, item.cookId === mem.id && styles.pillTextActive]}>{mem.name}</Text>
            </Pressable>
          ))}
          {item.cookId ? (
            <Pressable style={styles.pill} disabled={busyId === item.id} onPress={() => assignTo(item, null)}>
              <Text style={styles.clearText}>Clear cook</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.opts}>
        {CHOICES.map((choice) => (
          <Pressable
            key={choice}
            disabled={busyId === item.id}
            style={[styles.pill, item.myResponse === choice && styles.pillActive]}
            onPress={() => respond(item, choice)}
          >
            <Text style={[styles.pillText, item.myResponse === choice && styles.pillTextActive]}>
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

      <MealIngredients householdId={householdId} mealId={item.id} status={item.status} />
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Meal (e.g., Chicken tacos)"
          placeholderTextColor={color.textFaint}
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
        <ActivityIndicator color={color.accent} style={styles.spinner} />
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
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: color.borderStrong },
  addBtn: { flex: 1, backgroundColor: color.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addBtnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.border },
  addText: { color: color.accentInk, fontWeight: '700', fontSize: 15 },
  addTextAlt: { color: color.textMuted, fontWeight: '600', fontSize: 15 },
  busy: { opacity: 0.6 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: color.border },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: color.text, fontSize: 16, fontWeight: '600', flex: 1 },
  reqTag: { color: color.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  meta: { color: color.textMuted, fontSize: 14 },
  cookRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  cookBtns: { flexDirection: 'row', gap: 8 },
  cookName: { color: color.textMuted, fontSize: 13 },
  noCook: { color: color.warning, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: color.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { backgroundColor: color.accent, borderColor: color.accent },
  pillText: { color: color.textMuted, fontSize: 14 },
  pillTextActive: { color: color.accentInk, fontWeight: '700' },
  clearText: { color: color.danger, fontSize: 14 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waiting: { color: color.warning, fontSize: 13 },
  allin: { color: color.accent, fontSize: 13 },
  empty: { color: color.textFaint, textAlign: 'center', marginTop: 24, fontSize: 15 },
  err: { color: color.danger, textAlign: 'center', padding: 16, fontSize: 14 },
});
