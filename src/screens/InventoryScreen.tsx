import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CATEGORIES, STORES } from '../api/barcode';
import { removeInventoryItem, updateInventoryItem } from '../api/inventory';
import { filterInventory, groupBy, type InventoryView } from '../domain/inventory';
import { useInventory } from '../hooks/useInventory';
import { useLocations } from '../hooks/useLocations';
import { ScanScreen } from './ScanScreen';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

type GroupKey = 'locationName' | 'category';

/** Toggle membership of a value in a multi-select filter set. */
function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function InventoryScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const inv = useInventory(householdId);
  const locationsQ = useLocations(householdId);

  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [onlyRestock, setOnlyRestock] = useState(false);
  const [groupKey, setGroupKey] = useState<GroupKey>('locationName');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allLocationIds = (locationsQ.data ?? []).map((l) => l.id);

  const groups = useMemo(() => {
    const items = inv.data ?? [];
    const filtered = filterInventory(items, { search, locationIds, categories, stores, onlyRestock });
    return groupBy(filtered, groupKey);
  }, [inv.data, search, locationIds, categories, stores, onlyRestock, groupKey]);

  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const anyFilter =
    Boolean(search) || locationIds.length > 0 || categories.length > 0 || stores.length > 0 || onlyRestock;

  const clearAll = () => {
    setSearch('');
    setLocationIds([]);
    setCategories([]);
    setStores([]);
    setOnlyRestock(false);
  };

  const selectAll = () => {
    setLocationIds(allLocationIds);
    setCategories([...CATEGORIES]);
    setStores([...STORES]);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['inventory', householdId] });

  if (scanning) {
    return (
      <View style={styles.flex}>
        <Pressable style={styles.backBar} onPress={() => setScanning(false)}>
          <Text style={styles.backText}>‹ Back to inventory</Text>
        </Pressable>
        <ScanScreen householdId={householdId} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Pressable style={styles.scanBtn} onPress={() => setScanning(true)}>
        <Text style={styles.scanBtnText}>Scan or add an item</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Search name, brand, or store"
        placeholderTextColor="#6b6f8c"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterBar}>
        <Pressable onPress={selectAll}>
          <Text style={styles.link}>Select all filters</Text>
        </Pressable>
        <Pressable onPress={clearAll}>
          <Text style={[styles.link, !anyFilter && styles.linkDim]}>Clear all filters</Text>
        </Pressable>
      </View>

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

      <FilterGroup
        label="LOCATION"
        options={(locationsQ.data ?? []).map((l) => [l.id, l.name] as [string, string])}
        selected={locationIds}
        onToggle={(v) => setLocationIds((s) => toggle(s, v))}
        onAll={() => setLocationIds(allLocationIds)}
        onNone={() => setLocationIds([])}
      />
      <FilterGroup
        label="FOOD TYPE"
        options={CATEGORIES.map((c) => [c, c] as [string, string])}
        selected={categories}
        onToggle={(v) => setCategories((s) => toggle(s, v))}
        onAll={() => setCategories([...CATEGORIES])}
        onNone={() => setCategories([])}
      />
      <FilterGroup
        label="STORE"
        options={STORES.map((s) => [s, s] as [string, string])}
        selected={stores}
        onToggle={(v) => setStores((s) => toggle(s, v))}
        onAll={() => setStores([...STORES])}
        onNone={() => setStores([])}
      />

      <View style={styles.summary}>
        <Text style={styles.count}>
          {total} item{total === 1 ? '' : 's'}
        </Text>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {inv.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spin} />
      ) : inv.isError ? (
        <Text style={styles.err}>{msg(inv.error)}</Text>
      ) : total === 0 ? (
        <Text style={styles.empty}>
          {anyFilter ? 'Nothing matches those filters.' : 'Nothing counted yet. Scan or add an item above.'}
        </Text>
      ) : (
        groups.map(([groupName, items]) => (
          <View key={groupName} style={styles.group}>
            <Text style={styles.groupHead}>
              {groupName.toUpperCase()} · {items.length}
            </Text>
            {items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                open={openId === it.id}
                onPress={() => setOpenId(openId === it.id ? null : it.id)}
                groupKey={groupKey}
                locations={(locationsQ.data ?? []).map((l) => [l.id, l.name] as [string, string])}
                onSaved={async () => {
                  setOpenId(null);
                  await refresh();
                }}
                onError={setError}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function FilterGroup(props: {
  label: string;
  options: Array<[string, string]>;
  selected: string[];
  onToggle: (v: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <>
      <View style={styles.groupBar}>
        <Text style={styles.section}>{props.label}</Text>
        <View style={styles.groupBarLinks}>
          <Pressable onPress={props.onAll}>
            <Text style={styles.miniLink}>All</Text>
          </Pressable>
          <Pressable onPress={props.onNone}>
            <Text style={styles.miniLink}>None</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.chips}>
        {props.options.map(([value, label]) => {
          const on = props.selected.includes(value);
          return (
            <Pressable key={value} style={[styles.chip, on && styles.chipOn]} onPress={() => props.onToggle(value)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function ItemRow(props: {
  item: InventoryView;
  open: boolean;
  groupKey: GroupKey;
  locations: Array<[string, string]>;
  onPress: () => void;
  onSaved: () => void | Promise<void>;
  onError: (m: string | null) => void;
}) {
  const { item, open } = props;
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [store, setStore] = useState<string | null>(item.store);
  const [locationId, setLocationId] = useState<string | null>(item.locationId);
  const [category, setCategory] = useState<string | null>(item.category === 'Other' ? null : item.category);
  const [purchasedOn, setPurchasedOn] = useState(item.purchasedOn ?? '');
  const [minQ, setMinQ] = useState(item.minQuantity != null ? String(item.minQuantity) : '');
  const [parQ, setParQ] = useState(item.parQuantity != null ? String(item.parQuantity) : '');
  const [busy, setBusy] = useState(false);

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const save = async () => {
    const minN = num(minQ);
    const parN = num(parQ);
    if (minN != null && parN != null && parN < minN) {
      props.onError('The ideal amount should be at least the reorder point.');
      return;
    }
    setBusy(true);
    props.onError(null);
    try {
      await updateInventoryItem(item.id, {
        name,
        brand: brand.trim() || null,
        unit: unit.trim() || null,
        quantity: num(qty),
        category,
        locationId,
        store,
        purchasedOn: purchasedOn.trim() || null,
        minQuantity: minN,
        parQuantity: parN,
      });
      await props.onSaved();
    } catch (e) {
      props.onError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeInventoryItem(item.id);
      await props.onSaved();
    } catch (e) {
      props.onError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Pressable style={styles.row} onPress={props.onPress}>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowDetail}>
            {[item.brand, item.store, props.groupKey === 'locationName' ? item.category : item.locationName]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={styles.rowMeta}>
            {[item.purchasedOn ? `Bought ${item.purchasedOn}` : null, item.countAge ? `Counted ${item.countAge}` : 'Never counted']
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.levelWrap}>
          {item.needsRestock ? <Text style={styles.restock}>RESTOCK</Text> : null}
          <Text style={styles.level}>{item.levelLabel}</Text>
          {item.needsRestock && item.reorderLabel ? <Text style={styles.reorder}>{item.reorderLabel}</Text> : null}
          <Text style={styles.editHint}>tap to edit</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor}>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#6b6f8c" />
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Brand" placeholderTextColor="#6b6f8c" />
      <View style={styles.row2}>
        <TextInput style={[styles.input, styles.half]} value={qty} onChangeText={setQty} placeholder="How much" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.half]} value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor="#6b6f8c" />
      </View>

      <Text style={styles.section}>WHERE IT LIVES</Text>
      <View style={styles.chips}>
        {props.locations.map(([id, label]) => (
          <Pressable key={id} style={[styles.chip, locationId === id && styles.chipOn]} onPress={() => setLocationId(locationId === id ? null : id)}>
            <Text style={[styles.chipText, locationId === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>FOOD TYPE</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(category === c ? null : c)}>
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>WHERE IT CAME FROM</Text>
      <View style={styles.chips}>
        {STORES.map((s) => (
          <Pressable key={s} style={[styles.chip, store === s && styles.chipOn]} onPress={() => setStore(store === s ? null : s)}>
            <Text style={[styles.chipText, store === s && styles.chipTextOn]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} value={purchasedOn} onChangeText={setPurchasedOn} placeholder="Purchased on (YYYY-MM-DD)" placeholderTextColor="#6b6f8c" />

      <Text style={styles.section}>REORDER</Text>
      <View style={styles.row2}>
        <TextInput style={[styles.input, styles.half]} value={minQ} onChangeText={setMinQ} placeholder="Buy when below" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.half]} value={parQ} onChangeText={setParQ} placeholder="Ideal amount" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
      </View>

      <View style={styles.editorActions}>
        <Pressable style={[styles.save, busy && styles.dim]} disabled={busy} onPress={save}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
        <Pressable style={styles.cancel} disabled={busy} onPress={props.onPress}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.remove} disabled={busy} onPress={remove}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Changing the amount records a new count. Renaming or re-filing does not.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { padding: 20, paddingBottom: 40 },
  backBar: { paddingHorizontal: 20, paddingVertical: 12 },
  backText: { color: '#7c9bff', fontSize: 15 },
  scanBtn: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 12 },
  scanBtnText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 8 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  link: { color: '#7c9bff', fontSize: 13 },
  linkDim: { color: '#4a4f70' },
  section: { color: '#8a8fb0', fontSize: 11, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  groupBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  groupBarLinks: { flexDirection: 'row', gap: 12 },
  miniLink: { color: '#6b7398', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipText: { color: '#c4c8e0', fontSize: 13 },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  summary: { marginTop: 18, marginBottom: 4 },
  count: { color: '#8a8fb0', fontSize: 13 },
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
  editHint: { color: '#4a4f70', fontSize: 10, marginTop: 2 },
  editor: { backgroundColor: '#161a2e', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#3a3f60' },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  editorActions: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  save: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 26 },
  saveText: { color: '#0f1220', fontWeight: '700' },
  dim: { opacity: 0.6 },
  cancel: { paddingVertical: 12, paddingHorizontal: 14 },
  cancelText: { color: '#8a8fb0' },
  remove: { paddingVertical: 12, paddingHorizontal: 14, marginLeft: 'auto' },
  removeText: { color: '#d99ac0' },
  note: { color: '#6b6f8c', fontSize: 11, marginTop: 10 },
  spin: { marginTop: 20 },
  empty: { color: '#8a8fb0', fontSize: 15, marginTop: 20 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 12 },
});
