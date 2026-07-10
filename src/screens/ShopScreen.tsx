import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { addShoppingItem, rankSuggestions, setShoppingItemDone, type ItemSuggestion } from '../api/shopping';
import { buildRestockList, type InventoryView } from '../domain/inventory';
import type { ShoppingItemView } from '../domain/shopping';
import { useInventory } from '../hooks/useInventory';
import { useItemSuggestions } from '../hooks/useItemSuggestions';
import { useShoppingList } from '../hooks/useShopping';

import { color } from '../theme';

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

  // What the shopping list already covers, so we don't nag twice.
  const openNames = (shop.data?.open ?? []).map((i: ShoppingItemView) => i.name);
  const restock = buildRestockList(inv.data ?? [], openNames);

  // Buy back up to par where we know it; otherwise just put the item on the list.
  const addFromInventory = async (item: InventoryView) => {
    setBusy(true);
    setError(null);
    try {
      await addShoppingItem(householdId, item.name, {
        brand: item.brand,
        quantity: item.reorderQuantity,
        unit: item.unit,
        store: item.store,
      });
      await refreshShop();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const addAllNeeded = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const item of [...restock.out, ...restock.low]) {
        await addShoppingItem(householdId, item.name, {
          brand: item.brand,
          quantity: item.reorderQuantity,
          unit: item.unit,
          store: item.store,
        });
      }
      await refreshShop();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Item (e.g., Milk)"
          placeholderTextColor={color.textFaint}
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
            placeholderTextColor={color.textFaint}
            value={brand}
            onChangeText={setBrand}
          />
          <TextInput
            style={[styles.input, styles.qtyField]}
            placeholder="Qty"
            placeholderTextColor={color.textFaint}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.unitField]}
            placeholder="Size/unit"
            placeholderTextColor={color.textFaint}
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
        <ActivityIndicator color={color.accent} style={styles.spin} />
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
                {/* Bought but not stocked. Say why, or it looks like the trigger failed. */}
                {it.stockWarning ? <Text style={styles.stockWarn}>{it.stockWarning}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Shopping list is empty.</Text>
      )}

      <Text style={styles.section}>Needs replenishing</Text>
      {inv.isLoading ? (
        <ActivityIndicator color={color.accent} style={styles.spin} />
      ) : inv.isError ? (
        <Text style={styles.err}>{msg(inv.error)}</Text>
      ) : (
        <View>
          {restock.out.length + restock.low.length + restock.onList.length === 0 ? (
            <Text style={styles.empty}>Nothing has fallen below its target.</Text>
          ) : null}

          {restock.out.length > 0 ? <Text style={styles.subhead}>Out of stock</Text> : null}
          {restock.out.map((it: InventoryView) => (
            <RestockRow key={it.id} item={it} busy={busy} onAdd={() => addFromInventory(it)} />
          ))}

          {restock.low.length > 0 ? <Text style={styles.subhead}>Running low</Text> : null}
          {restock.low.map((it: InventoryView) => (
            <RestockRow key={it.id} item={it} busy={busy} onAdd={() => addFromInventory(it)} />
          ))}

          {restock.out.length + restock.low.length > 1 ? (
            <Pressable style={[styles.addAll, busy && styles.busy]} disabled={busy} onPress={addAllNeeded}>
              <Text style={styles.addAllText}>
                Add all {restock.out.length + restock.low.length} to the list
              </Text>
            </Pressable>
          ) : null}

          {restock.onList.length > 0 ? (
            <>
              <Text style={styles.subhead}>Already on the list</Text>
              {restock.onList.map((it: InventoryView) => (
                <View key={it.id} style={styles.row2}>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, styles.doneTitle]}>{it.name}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {restock.untracked > 0 ? (
            <Text style={styles.untracked}>
              {restock.untracked} item{restock.untracked === 1 ? ' has' : 's have'} no reorder point, so this
              screen can only tell when {restock.untracked === 1 ? 'it runs' : 'they run'} out entirely. Set one
              on the Inventory tab — you can do it for many items at once with Select.
            </Text>
          ) : null}
        </View>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

function RestockRow(props: { item: InventoryView; busy: boolean; onAdd: () => void }) {
  const { item } = props;
  const detail = [item.brand, item.store].filter(Boolean).join(' · ');
  return (
    <View style={styles.row2}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
        <Text style={styles.rowMeta}>
          {item.restockReason === 'out_of_stock' ? 'None left' : `${item.levelLabel} left`}
          {item.reorderLabel ? ` · ${item.reorderLabel}` : ''}
        </Text>
      </View>
      <Pressable style={[styles.addSmall, props.busy && styles.busy]} disabled={props.busy} onPress={props.onAdd}>
        <Text style={styles.addSmallText}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 32 },
  composer: { gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  brandField: { flex: 2 },
  qtyField: { flex: 1 },
  unitField: { flex: 1.4 },
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: color.borderStrong },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: color.borderStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  chipActive: { borderColor: color.accent, backgroundColor: color.accentSoft },
  chipStore: { color: color.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  chipName: { color: color.text, fontSize: 14, fontWeight: '600' },
  chipText: { color: color.textMuted, fontSize: 12, marginTop: 1 },
  chipTextActive: { color: color.text },
  clearStore: { color: color.textFaint, fontSize: 12, marginTop: 2 },
  add: { backgroundColor: color.accent, borderRadius: 12, paddingVertical: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.6 },
  addText: { color: color.accentInk, fontWeight: '700', fontSize: 15 },
  section: { color: color.textFaint, fontSize: 12, letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  subhead: { color: color.textFaint, fontSize: 12, marginTop: 10, marginBottom: 4 },
  spin: { marginTop: 16 },
  row2: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: color.border },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.border },
  checkboxDone: { backgroundColor: color.accent, borderColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  check: { color: color.accentInk, fontSize: 14, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitle: { color: color.text, fontSize: 15, fontWeight: '600' },
  doneTitle: { color: color.textFaint, textDecorationLine: 'line-through' },
  stockWarn: { color: color.warning, fontSize: 12, marginTop: 2 },
  rowDetail: { color: color.textMuted, fontSize: 13, marginTop: 2 },
  levelWrap: { alignItems: 'flex-end', gap: 4 },
  level: { color: color.textMuted, fontSize: 14 },
  restock: { color: color.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reorder: { color: color.success, fontSize: 11, marginTop: 2 },
  empty: { color: color.textFaint, fontSize: 15 },
  rowMeta: { color: color.textFaint, fontSize: 12, marginTop: 3 },
  addSmall: { backgroundColor: color.surfaceRaised, borderRadius: 10, paddingHorizontal: 18, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addSmallText: { color: color.text, fontWeight: '600' },
  addAll: { borderWidth: 1, borderColor: color.accent, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  addAllText: { color: color.accent, fontWeight: '700' },
  untracked: { color: color.textFaint, fontSize: 12, lineHeight: 18, marginTop: 16 },
  err: { color: color.danger, fontSize: 14, marginTop: 12 },
});
