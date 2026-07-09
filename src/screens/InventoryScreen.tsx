import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, STORES } from '../api/barcode';
import { filterInventory, groupBy, type InventoryView } from '../domain/inventory';
import { useInventory } from '../hooks/useInventory';
import { useLocations } from '../hooks/useLocations';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

type GroupKey = 'locationName' | 'category';

export function InventoryScreen({ householdId }: { householdId: string }) {
  const inv = useInventory(householdId);
  const locationsQ = useLocations(householdId);

  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [store, setStore] = useState<string | null>(null);
  const [onlyRestock, setOnlyRestock] = useState(false);
  const [groupKey, setGroupKey] = useState<GroupKey>('locationName');

  const groups = useMemo(() => {
    const items = inv.data ?? [];
    const filtered = filterInventory(items, { search, locationId, category, store, onlyRestock });
    return groupBy(filtered, groupKey);
  }, [inv.data, search, locationId, category, store, onlyRestock, groupKey]);

  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const anyFilter = Boolean(search || locationId || category || store || onlyRestock);

  const clear = () => {
    setSearch('');
    setLocationId(null);
    setCategory(null);
    setStore(null);
    setOnlyRestock(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder="Search name, brand, or store"
        placeholderTextColor="#6b6f8c"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.section}>GROUP BY</Text>
      <View style={styles.chips}>
        {([
          ['locationName', 'Location'],
          ['category', 'Food type'],
        ] as Array<[GroupKey, string]>).map(([k, label]) => (
          <Pressable key={k} style={[styles.chip, groupKey === k && styles.chipOn]} onPress={() => setGroupKey(k)}>
            <Text style={[styles.chipText, groupKey === k && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.chip, onlyRestock && styles.chipOn]} onPress={() => setOnlyRestock((v) => !v)}>
          <Text style={[styles.chipText, onlyRestock && styles.chipTextOn]}>Needs restock</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>LOCATION</Text>
      <View style={styles.chips}>
        {(locationsQ.data ?? []).map((l) => (
          <Pressable
            key={l.id}
            style={[styles.chip, locationId === l.id && styles.chipOn]}
            onPress={() => setLocationId(locationId === l.id ? null : l.id)}
          >
            <Text style={[styles.chipText, locationId === l.id && styles.chipTextOn]}>{l.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>FOOD TYPE</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipOn]}
            onPress={() => setCategory(category === c ? null : c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>STORE</Text>
      <View style={styles.chips}>
        {STORES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, store === s && styles.chipOn]}
            onPress={() => setStore(store === s ? null : s)}
          >
            <Text style={[styles.chipText, store === s && styles.chipTextOn]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.count}>{total} item{total === 1 ? '' : 's'}</Text>
        {anyFilter ? (
          <Pressable onPress={clear}>
            <Text style={styles.clear}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {inv.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spin} />
      ) : inv.isError ? (
        <Text style={styles.err}>{msg(inv.error)}</Text>
      ) : total === 0 ? (
        <Text style={styles.empty}>
          {anyFilter ? 'Nothing matches those filters.' : 'Nothing counted yet. Use the Scan tab to add items.'}
        </Text>
      ) : (
        groups.map(([groupName, items]) => (
          <View key={groupName} style={styles.group}>
            <Text style={styles.groupHead}>
              {groupName.toUpperCase()} · {items.length}
            </Text>
            {items.map((it: InventoryView) => (
              <View key={it.id} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{it.name}</Text>
                  <Text style={styles.rowDetail}>
                    {[it.brand, it.store, groupKey === 'locationName' ? it.category : it.locationName]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {[
                      it.purchasedOn ? `Bought ${it.purchasedOn}` : null,
                      it.countAge ? `Counted ${it.countAge}` : 'Never counted',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.levelWrap}>
                  {it.needsRestock ? <Text style={styles.restock}>RESTOCK</Text> : null}
                  <Text style={styles.level}>{it.levelLabel}</Text>
                  {it.needsRestock && it.reorderLabel ? <Text style={styles.reorder}>{it.reorderLabel}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  section: { color: '#8a8fb0', fontSize: 11, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipText: { color: '#c4c8e0', fontSize: 13 },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 4 },
  count: { color: '#8a8fb0', fontSize: 13 },
  clear: { color: '#7c9bff', fontSize: 13 },
  group: { marginTop: 14 },
  groupHead: { color: '#7c9bff', fontSize: 11, letterSpacing: 1.2, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', backgroundColor: '#161a2e', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  rowBody: { flex: 1 },
  rowTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  rowDetail: { color: '#a6abcc', fontSize: 13, marginTop: 2 },
  rowMeta: { color: '#6b6f8c', fontSize: 11, marginTop: 3 },
  levelWrap: { alignItems: 'flex-end', gap: 2 },
  level: { color: '#c4c8e0', fontSize: 14 },
  restock: { color: '#ffb86b', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reorder: { color: '#9fe0b0', fontSize: 11 },
  spin: { marginTop: 20 },
  empty: { color: '#8a8fb0', fontSize: 15, marginTop: 20 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 12 },
});
