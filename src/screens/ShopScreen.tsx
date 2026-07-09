import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { setInventoryLevel } from '../api/inventory';
import { addShoppingItem, rankSuggestions, setShoppingItemDone, type ItemSuggestion } from '../api/shopping';
import { nextLevel, type InventoryView } from '../domain/inventory';
import type { ShoppingItemView } from '../domain/shopping';
import { useInventory } from '../hooks/useInventory';
import { useItemSuggestions } from '../hooks/useItemSuggestions';
import { useShoppingList } from '../hooks/useShopping';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function ShopScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const shop = useShoppingList(householdId);
  const inv = useInventory(householdId);
  const suggestionsQ = useItemSuggestions(householdId);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [store, setStore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshShop = async () => {
    await qc.invalidateQueries({ queryKey: ['shopping', householdId] });
    await qc.invalidateQueries({ queryKey: ['itemSuggestions', householdId] });
  };
  const refreshInv = () => qc.invalidateQueries({ queryKey: ['inventory', householdId] });

  // Keep matches visible even on an exact name match, so you can switch stores
  // after picking one. Brand and size differ per store, so the store is the choice.
  const suggestions: ItemSuggestion[] = rankSuggestions(suggestionsQ.data ?? [], name, 6);

  const applySuggestion = (s: ItemSuggestion) => {
    setName(s.name);
    setBrand(s.brand ?? '');
    setUnit(s.unit ?? '');
    setStore(s.store);
  };

  const add = async () => {
    if (!name.trim()) return;
    const parsedQty = qty.trim() ? Number(qty.trim()) : null;
    if (parsedQty !== null && (Number.isNaN(parsedQty) || parsedQty < 0)) {
      setError('Quantity must be a non-negative number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addShoppingItem(householdId, name.trim(), {
        brand: brand.trim() || null,
        quantity: parsedQty,
        unit: unit.trim() || null,
        store,
      });
      setName('');
      setBrand('');
      setQty('');
      setUnit('');
      setStore(null);
      await refreshShop();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ShoppingItemView) => {
    setError(null);
    try {
      await setShoppingItemDone(item.id, !item.done);
      await refreshShop();
    } catch (e) {
      setError(msg(e));
    }
  };

  const cycle = async (item: InventoryView) => {
    if (!item.approximate) return;
    setError(null);
    try {
      await setInventoryLevel(item.id, nextLevel(item.level));
      await refreshInv();
    } catch (e) {
      setError(msg(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Item (e.g., Milk)"
          placeholderTextColor="#6b6f8c"
          value={name}
          onChangeText={setName}
        />
        {suggestions.length > 0 ? (
          <View style={styles.chips}>
            {suggestions.map((s) => {
              const active = s.store === store && s.name === name;
              return (
                <Pressable
                  key={`${s.name}|${s.store ?? ''}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => applySuggestion(s)}
                >
                  {s.store ? <Text style={styles.chipStore}>{s.store}</Text> : null}
                  <Text style={[styles.chipName, active && styles.chipTextActive]}>{s.name}</Text>
                  {s.brand || s.unit ? (
                    <Text style={styles.chipText}>{[s.brand, s.unit].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {store ? (
          <Pressable onPress={() => setStore(null)}>
            <Text style={styles.clearStore}>Buying at {store} — tap to clear</Text>
          </Pressable>
        ) : null}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.brandField]}
            placeholder="Brand (optional)"
            placeholderTextColor="#6b6f8c"
            value={brand}
            onChangeText={setBrand}
          />
          <TextInput
            style={[styles.input, styles.qtyField]}
            placeholder="Qty"
            placeholderTextColor="#6b6f8c"
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.unitField]}
            placeholder="Size/unit"
            placeholderTextColor="#6b6f8c"
            value={unit}
            onChangeText={setUnit}
          />
        </View>
        <Pressable style={[styles.add, busy && styles.busy]} disabled={busy} onPress={add}>
          <Text style={styles.addText}>Add to shopping list</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Shopping list</Text>
      {shop.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spin} />
      ) : shop.isError ? (
        <Text style={styles.err}>{msg(shop.error)}</Text>
      ) : shop.data && shop.data.open.length + shop.data.done.length > 0 ? (
        <View>
          {shop.data.open.map((it: ShoppingItemView) => (
            <Pressable key={it.id} style={styles.row2} onPress={() => toggle(it)}>
              <View style={styles.checkbox} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{it.name}</Text>
                {it.detail ? <Text style={styles.rowDetail}>{it.detail}</Text> : null}
              </View>
            </Pressable>
          ))}
          {shop.data.done.length > 0 ? <Text style={styles.subhead}>Bought</Text> : null}
          {shop.data.done.map((it: ShoppingItemView) => (
            <Pressable key={it.id} style={styles.row2} onPress={() => toggle(it)}>
              <View style={[styles.checkbox, styles.checkboxDone]}>
                <Text style={styles.check}>✓</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, styles.doneTitle]}>{it.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Shopping list is empty.</Text>
      )}

      <Text style={styles.section}>Inventory</Text>
      {inv.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spin} />
      ) : inv.isError ? (
        <Text style={styles.err}>{msg(inv.error)}</Text>
      ) : inv.data && inv.data.length > 0 ? (
        <View>
          {inv.data.map((it: InventoryView) => (
            <Pressable key={it.id} style={styles.row2} disabled={!it.approximate} onPress={() => cycle(it)}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{it.name}</Text>
                <Text style={styles.rowDetail}>{it.category}{it.approximate ? ' · tap to update' : ''}</Text>
              </View>
              <View style={styles.levelWrap}>
                {it.needsRestock ? <Text style={styles.restock}>RESTOCK</Text> : null}
                <Text style={styles.level}>{it.levelLabel}</Text>
                {it.needsRestock && it.reorderLabel ? (
                  <Text style={styles.reorder}>{it.reorderLabel}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No inventory yet.</Text>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 32 },
  composer: { gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  brandField: { flex: 2 },
  qtyField: { flex: 1 },
  unitField: { flex: 1.4 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  chipActive: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipStore: { color: '#7c9bff', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  chipName: { color: '#e8eaf6', fontSize: 14, fontWeight: '600' },
  chipText: { color: '#9aa0c0', fontSize: 12, marginTop: 1 },
  chipTextActive: { color: '#ffffff' },
  clearStore: { color: '#8a8fb0', fontSize: 12, marginTop: 2 },
  add: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.6 },
  addText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  section: { color: '#8a8fb0', fontSize: 12, letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  subhead: { color: '#6b6f8c', fontSize: 12, marginTop: 10, marginBottom: 4 },
  spin: { marginTop: 16 },
  row2: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161a2e', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#3a3f60' },
  checkboxDone: { backgroundColor: '#7c9bff', borderColor: '#7c9bff', alignItems: 'center', justifyContent: 'center' },
  check: { color: '#0f1220', fontSize: 14, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  doneTitle: { color: '#6b6f8c', textDecorationLine: 'line-through' },
  rowDetail: { color: '#a6abcc', fontSize: 13, marginTop: 2 },
  levelWrap: { alignItems: 'flex-end', gap: 4 },
  level: { color: '#c4c8e0', fontSize: 14 },
  restock: { color: '#ffb86b', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reorder: { color: '#9fe0b0', fontSize: 11, marginTop: 2 },
  empty: { color: '#8a8fb0', fontSize: 15 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 12 },
});
