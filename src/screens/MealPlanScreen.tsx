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
import { type HouseholdMember } from '../api/members';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';

import { color } from '../theme';

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

      {mealsQ.isLoading ? <ActivityIndicator color={color.accent} style={styles.spin} /> : null}
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
                {(membersQ.data ?? []).map((m: HouseholdMember) => {
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
                placeholderTextColor={color.textFaint}
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
  arrowText: { color: color.accent, fontSize: 26, lineHeight: 28 },
  weekLabel: { color: color.text, fontSize: 16, fontWeight: '600' },
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 64, borderRadius: 12, backgroundColor: color.surface },
  dayOn: { backgroundColor: color.accent },
  dayToday: { borderWidth: 1, borderColor: color.border },
  dow: { color: color.textFaint, fontSize: 11, letterSpacing: 0.5 },
  dowOn: { color: color.accentInk },
  dom: { color: color.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
  domOn: { color: color.accentInk },
  dots: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.surfaceRaised },
  dotOn: { backgroundColor: color.success },
  slot: { backgroundColor: color.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotLabel: { color: color.textFaint, fontSize: 12, letterSpacing: 1.4, fontWeight: '700' },
  oyo: { color: color.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  mealTitle: { color: color.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  cook: { color: color.textMuted, fontSize: 13, marginTop: 3 },
  plan: { color: color.accent, fontSize: 15, marginTop: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  grow: { flex: 1 },
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: color.borderStrong },
  add: { backgroundColor: color.accent, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addText: { color: color.accentInk, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: color.borderStrong, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
  chipText: { color: color.textMuted, fontSize: 13 },
  chipTextOn: { color: color.text, fontWeight: '600' },
  chipDanger: { borderWidth: 1, borderColor: color.dangerSoft, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipDangerText: { color: color.dangerSoft, fontSize: 13 },
  spin: { marginTop: 16 },
  footnote: { color: color.textFaint, fontSize: 12, marginTop: 18, lineHeight: 17 },
  err: { color: color.danger, fontSize: 14, marginTop: 12 },
});
