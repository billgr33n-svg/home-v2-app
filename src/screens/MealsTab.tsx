import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MealPlanScreen } from './MealPlanScreen';
import { MealsScreen } from './MealsScreen';

/**
 * The Meals tab holds two related but distinct things:
 *   Plan   -- the week ahead: what's for breakfast/lunch/dinner, and who cooks
 *   Tonight -- the immediate stuff: who's home for dinner, meal requests
 *
 * They were built at different times and neither subsumes the other, so rather
 * than silently dropping the one Bill already uses, both stay reachable.
 */
export function MealsTab({ householdId }: { householdId: string }) {
  const [mode, setMode] = useState<'plan' | 'tonight'>('plan');

  return (
    <View style={styles.wrap}>
      <View style={styles.toggle}>
        {(['plan', 'tonight'] as const).map((m) => (
          <Pressable key={m} style={[styles.seg, mode === m && styles.segOn]} onPress={() => setMode(m)}>
            <Text style={[styles.segText, mode === m && styles.segTextOn]}>
              {m === 'plan' ? 'Week plan' : 'Tonight'}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'plan' ? <MealPlanScreen householdId={householdId} /> : <MealsScreen householdId={householdId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  toggle: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: '#161a2e' },
  segOn: { backgroundColor: '#1e2440', borderWidth: 1, borderColor: '#7c9bff' },
  segText: { color: '#8a8fb0', fontSize: 14, fontWeight: '600' },
  segTextOn: { color: '#ffffff' },
});
