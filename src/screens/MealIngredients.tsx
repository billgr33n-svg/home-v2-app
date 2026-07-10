import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cookMeal, fetchReservations, releaseIngredient, reserveIngredient, type Reservation } from '../api/mealIngredients';
import type { InventoryView } from '../domain/inventory';
import { useInventory } from '../hooks/useInventory';
import { color, radius, space, TOUCH, type as t } from '../theme';

/**
 * Attach inventory to a meal, then cook it.
 *
 * "Cooked it" is the edge that was severed: until now, cooking a meal removed
 * nothing from the fridge. The button consumes the reservations as `used`
 * movements -- not `spoiled`, because eating dinner is not waste, and that
 * distinction is the entire reason the ledger has two reasons.
 */
export function MealIngredients(props: { householdId: string; mealId: string; status: string }) {
  const qc = useQueryClient();
  const inv = useInventory(props.householdId);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<Record<string, string>>({});

  const reservations = useQuery({
    queryKey: ['reservations', props.mealId],
    queryFn: () => fetchReservations(props.mealId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['reservations', props.mealId] });
    void qc.invalidateQueries({ queryKey: ['inventory', props.householdId] });
    void qc.invalidateQueries({ queryKey: ['meals', props.householdId] });
    void qc.invalidateQueries({ queryKey: ['waste', props.householdId] });
  };

  const reserve = useMutation({
    mutationFn: (v: { itemId: string; quantity: number; unit: string | null }) =>
      reserveIngredient(props.householdId, props.mealId, v.itemId, v.quantity, v.unit),
    onSuccess: invalidate,
  });
  const release = useMutation({ mutationFn: releaseIngredient, onSuccess: invalidate });
  const cook = useMutation({ mutationFn: () => cookMeal(props.mealId), onSuccess: invalidate });

  const rows = reservations.data ?? [];
  const cooked = props.status === 'cooked';

  const candidates = (inv.data ?? [])
    .filter((i: InventoryView) => search.trim().length > 0 && i.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>INGREDIENTS FROM THE HOUSE</Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          {cooked ? 'Nothing was drawn from inventory.' : 'None reserved. Add what this meal will use.'}
        </Text>
      ) : (
        rows.map((r: Reservation) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{r.itemName}</Text>
              <Text style={styles.rowMeta}>
                {r.quantity}
                {r.unit ? ` ${r.unit}` : ''}
                {r.onHand != null ? ` · ${r.onHand} on hand` : ''}
                {r.onHand != null && r.quantity > r.onHand ? ' · more than you have' : ''}
              </Text>
            </View>
            {!cooked ? (
              <Pressable onPress={() => release.mutate(r.id)} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      {!cooked ? (
        <>
          {picking ? (
            <View style={styles.picker}>
              <TextInput
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Search your inventory"
                placeholderTextColor={color.textFaint}
                autoFocus
              />
              {candidates.map((i: InventoryView) => (
                <View key={i.id} style={styles.candidate}>
                  <Text style={styles.candidateName} numberOfLines={1}>
                    {i.name}
                    {i.unit ? ` (${i.unit})` : ''}
                  </Text>
                  <TextInput
                    style={styles.amount}
                    value={amount[i.id] ?? ''}
                    onChangeText={(v) => setAmount((a) => ({ ...a, [i.id]: v }))}
                    placeholder="How much"
                    placeholderTextColor={color.textFaint}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    style={styles.addBtn}
                    onPress={() => {
                      const q = Number(amount[i.id]);
                      // A blank or zero reservation is a no-op, not a reservation of nothing.
                      if (!Number.isFinite(q) || q <= 0) return;
                      reserve.mutate({ itemId: i.id, quantity: q, unit: i.unit });
                      setAmount((a) => ({ ...a, [i.id]: '' }));
                      setSearch('');
                      setPicking(false);
                    }}
                  >
                    <Text style={styles.addText}>Add</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => setPicking(false)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.link} onPress={() => setPicking(true)}>
              <Text style={styles.linkText}>+ Add an ingredient</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.cook, cook.isPending && styles.cookBusy]}
            disabled={cook.isPending}
            onPress={() => cook.mutate()}
          >
            <Text style={styles.cookText}>
              {cook.isPending ? 'Cooking...' : rows.length > 0 ? `Cooked it (uses ${rows.length})` : 'Cooked it'}
            </Text>
          </Pressable>
          {cook.isError ? <Text style={styles.err}>Could not mark it cooked.</Text> : null}
        </>
      ) : (
        <Text style={styles.cookedTag}>COOKED</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.border, gap: space.sm },
  section: { ...t.section },
  empty: { ...t.detail },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { ...t.body, fontWeight: '600' },
  rowMeta: { ...t.meta },
  remove: { color: color.danger, fontSize: 13, fontWeight: '600' },

  picker: { gap: space.sm, marginTop: space.xs },
  input: {
    minHeight: TOUCH,
    backgroundColor: color.surfaceInput,
    color: color.text,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  candidateName: { ...t.body, flex: 1 },
  amount: {
    width: 96,
    minHeight: TOUCH,
    backgroundColor: color.surfaceInput,
    color: color.text,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    fontSize: 16,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  addBtn: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  addText: { color: color.accentInk, fontWeight: '700' },
  cancel: { color: color.textFaint, fontSize: 14 },

  link: { minHeight: TOUCH - 8, justifyContent: 'center' },
  linkText: { color: color.accent, fontSize: 14, fontWeight: '600' },

  cook: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  cookBusy: { opacity: 0.7 },
  cookText: { color: color.accentInk, fontWeight: '700' },
  cookedTag: { color: color.success, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  err: { color: color.danger, fontSize: 13 },
});
