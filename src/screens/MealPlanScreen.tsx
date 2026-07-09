import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { clearMeal, fetchWeekMeals, planMeal, setMealCook } from '../api/mealplan';
import {
  addDays,
  buildWeek,
  dateKey,
  startOfWeek,
  weekLabel,
  weekRange,
  type DayView,
  type Slot,
  type SlotView,
} from '../domain/mealplan';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function MealPlanScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const membersQ = useHouseholdMembers(householdId);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [editing, setEditing] = useState<Slot | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = weekRange(weekStart);
  const mealsQ = useQuery({
    queryKey: ['weekMeals', householdId, dateKey(weekStart)],
    queryFn: () => fetchWeekMeals(householdId, from, to),
    enabled: Boolean(householdId),
  });

  const week: DayView[] = useMemo(
    () => buildWeek(weekStart, mealsQ.data ?? []),
    [weekStart, mealsQ.data],
  );

  // Keep the selected day inside the visible week.
  const day = week.find((d) => d.date === selected) ?? week[0];

  const refresh = () => qc.invalidateQueries({ queryKey: ['weekMeals', householdId, dateKey(weekStart)] });

  const shiftWeek = (n: number) => {
    const next = addDays(weekStart, n * 7);
    setWeekStart(next);
    setSelected(dateKey(next));
    setEditing(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const addMeal = (slot: Slot) =>
    run(async () => {
      if (!title.trim()) throw new Error('Give the meal a name.');
      await planMeal(householdId, day.date, slot, title);
      setTitle('');
      setEditing(null);
    });

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.weekHeader}>
        <Pressable style={styles.arrow} onPress={() => shiftWeek(-1)} hitSlop={10}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{weekLabel(weekStart)}</Text>
        <Pressable style={styles.arrow} onPress={() => shiftWeek(1)} hitSlop={10}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.strip}>
        {week.map((d) => {
          const active = d.date === day.date;
          return (
            <Pressable
              key={d.date}
              style={[styles.dayCell, active && styles.dayOn, d.isToday && !active && styles.dayToday]}
              onPress={() => {
                setSelected(d.date);
                setEditing(null);
              }}
            >
              <Text style={[styles.dow, active && styles.dowOn]}>{d.weekdayShort}</Text>
              <Text style={[styles.dom, active && styles.domOn]}>{d.dayOfMonth}</Text>
              <View style={styles.dots}>
                {Array.from({ length: 3 }, (_, i) => (
                  <View key={i} style={[styles.dot, i < d.plannedCount && styles.dotOn]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {mealsQ.isLoading ? <ActivityIndicator color="#fff" style={styles.spin} /> : null}
      {mealsQ.isError ? <Text style={styles.err}>{msg(mealsQ.error)}</Text> : null}

      {day.slots.map((s: SlotView) => (
        <View key={s.slot} style={styles.slot}>
          <View style={styles.slotHead}>
            <Text style={styles.slotLabel}>{s.label}</Text>
            {s.isOyo ? <Text style={styles.oyo}>OYO</Text> : null}
          </View>

          {s.meal ? (
            <>
              <Text style={styles.mealTitle}>{s.meal.title}</Text>
              <Text style={styles.cook}>{s.cookLabel}</Text>

              <View style={styles.chips}>
                {(membersQ.data ?? []).map((m) => {
                  const on = s.meal?.cookId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.chip, on && styles.chipOn]}
                      disabled={busy}
                      onPress={() => run(() => setMealCook(s.meal!.id, on ? null : m.id))}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.name}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.chipDanger} disabled={busy} onPress={() => run(() => clearMeal(s.meal!.id))}>
                  <Text style={styles.chipDangerText}>Make OYO</Text>
                </Pressable>
              </View>
            </>
          ) : editing === s.slot ? (
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.grow]}
                placeholder={`What's for ${s.label.toLowerCase()}?`}
                placeholderTextColor="#6b6f8c"
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
              <Pressable style={styles.add} disabled={busy} onPress={() => addMeal(s.slot)}>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setEditing(s.slot);
                setTitle('');
              }}
            >
              <Text style={styles.plan}>+ Plan a meal</Text>
            </Pressable>
          )}
        </View>
      ))}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Text style={styles.footnote}>
        Every slot is on-your-own until someone plans something. Clearing a meal makes it OYO again.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4 },
  arrowText: { color: '#7c9bff', fontSize: 26, lineHeight: 28 },
  weekLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#161a2e' },
  dayOn: { backgroundColor: '#7c9bff' },
  dayToday: { borderWidth: 1, borderColor: '#3a3f60' },
  dow: { color: '#8a8fb0', fontSize: 11, letterSpacing: 0.5 },
  dowOn: { color: '#0f1220' },
  dom: { color: '#e8eaf6', fontSize: 18, fontWeight: '700', marginTop: 2 },
  domOn: { color: '#0f1220' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2a2f4a' },
  dotOn: { backgroundColor: '#9fe0b0' },
  slot: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, marginTop: 12 },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotLabel: { color: '#8a8fb0', fontSize: 12, letterSpacing: 1.4, fontWeight: '700' },
  oyo: { color: '#6b6f8c', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  mealTitle: { color: '#ffffff', fontSize: 17, fontWeight: '600', marginTop: 8 },
  cook: { color: '#a6abcc', fontSize: 13, marginTop: 3 },
  plan: { color: '#7c9bff', fontSize: 15, marginTop: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  grow: { flex: 1 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  add: { backgroundColor: '#7c9bff', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addText: { color: '#0f1220', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipText: { color: '#c4c8e0', fontSize: 13 },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  chipDanger: { borderWidth: 1, borderColor: '#4a3350', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipDangerText: { color: '#d99ac0', fontSize: 13 },
  spin: { marginTop: 16 },
  footnote: { color: '#6b6f8c', fontSize: 12, marginTop: 18, lineHeight: 17 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 12 },
});
