import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CATEGORIES, STORES } from '../api/barcode';
import {
  bulkRemoveInventoryItems,
  bulkUpdateInventoryItems,
  removeInventoryItem,
  updateInventoryItem,
} from '../api/inventory';
import {
  bulkConsume,
  bulkDiscardAll,
  bulkSetAmount,
  consumeAmount,
  markScrapped,
  markSpoiled,
  recordCount,
  recordMovement,
} from '../api/movements';
import { filterInventory, formatQuantity, groupBy, UNFILED, type InventoryView } from '../domain/inventory';
import { useInventory } from '../hooks/useInventory';
import { type StorageLocation } from '../api/locations';
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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Unfiled leads the list, because it's the pile you're trying to empty.
  const locationOptions: Array<[string, string]> = [
    [UNFILED, 'Unfiled'],
    ...(locationsQ.data ?? []).map((l: StorageLocation) => [l.id, l.name] as [string, string]),
  ];
  // "Select all" must include Unfiled, otherwise selecting every location hides
  // the items that belong to none of them.
  const allLocationIds = locationOptions.map(([id]) => id);

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

  const shown = groups.flatMap(([, items]) => items);
  const selectedItems = shown.filter((i) => selected.includes(i.id));
  const allShownSelected = shown.length > 0 && selectedItems.length === shown.length;

  const toggleSelected = (id: string) => setSelected((s) => toggle(s, id));
  const exitSelection = () => {
    setSelecting(false);
    setSelected([]);
  };

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
      <View style={styles.topRow}>
        <Pressable style={[styles.scanBtn, styles.grow]} onPress={() => setScanning(true)}>
          <Text style={styles.scanBtnText}>Scan or add an item</Text>
        </Pressable>
        <Pressable
          style={[styles.selectBtn, selecting && styles.selectBtnOn]}
          onPress={() => (selecting ? exitSelection() : setSelecting(true))}
        >
          <Text style={[styles.selectBtnText, selecting && styles.selectBtnTextOn]}>
            {selecting ? 'Done' : 'Select'}
          </Text>
        </Pressable>
      </View>

      {selecting ? (
        <View style={styles.selBar}>
          <Text style={styles.selCount}>
            {selectedItems.length} of {shown.length} selected
          </Text>
          <Pressable onPress={() => setSelected(allShownSelected ? [] : shown.map((i) => i.id))}>
            <Text style={styles.link}>{allShownSelected ? 'Select none' : 'Select all shown'}</Text>
          </Pressable>
        </View>
      ) : null}

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
        <Pressable
          style={[styles.chip, locationIds.length === 1 && locationIds[0] === UNFILED && styles.chipOn]}
          onPress={() =>
            setLocationIds((s) => (s.length === 1 && s[0] === UNFILED ? [] : [UNFILED]))
          }
        >
          <Text
            style={[
              styles.chipText,
              locationIds.length === 1 && locationIds[0] === UNFILED && styles.chipTextOn,
            ]}
          >
            Unfiled only
          </Text>
        </Pressable>
      </View>

      <FilterGroup
        label="LOCATION"
        options={locationOptions}
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

      {selecting && selectedItems.length > 0 ? (
        <BulkPanel
          householdId={householdId}
          items={selectedItems}
          locations={(locationsQ.data ?? []).map((l: StorageLocation) => [l.id, l.name] as [string, string])}
          onError={setError}
          onDone={async () => {
            exitSelection();
            await refresh();
          }}
        />
      ) : null}

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
                householdId={householdId}
                selecting={selecting}
                selected={selected.includes(it.id)}
                onToggleSelected={() => toggleSelected(it.id)}
                open={openId === it.id && !selecting}
                onPress={() => (selecting ? toggleSelected(it.id) : setOpenId(openId === it.id ? null : it.id))}
                groupKey={groupKey}
                locations={(locationsQ.data ?? []).map((l: StorageLocation) => [l.id, l.name] as [string, string])}
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


/**
 * Bulk edit. Every field is opt-in: a checked row is applied, an unchecked row
 * is left alone. This is the whole safety story — a panel that treats an empty
 * text box as "set to blank" will erase forty brands the first time it is used.
 *
 * Amount is not a field here. Changing how much you have is an event, so bulk
 * amount changes are ledger movements (count / use / discard), computed per item.
 */
function BulkPanel(props: {
  householdId: string;
  items: InventoryView[];
  locations: Array<[string, string]>;
  onError: (m: string | null) => void;
  onDone: () => void | Promise<void>;
}) {
  const { items, householdId } = props;
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'spoiled' | 'scrapped' | 'remove'>(null);

  // Each field: enabled + value. Enabled off => untouched.
  const [onLocation, setOnLocation] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [onCategory, setOnCategory] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [onStore, setOnStore] = useState(false);
  const [store, setStore] = useState<string | null>(null);
  const [onBrand, setOnBrand] = useState(false);
  const [brand, setBrand] = useState('');
  const [onUnit, setOnUnit] = useState(false);
  const [unit, setUnit] = useState('');
  const [onPurchased, setOnPurchased] = useState(false);
  const [purchasedOn, setPurchasedOn] = useState('');
  const [onMin, setOnMin] = useState(false);
  const [minQ, setMinQ] = useState('');
  const [onPar, setOnPar] = useState(false);
  const [parQ, setParQ] = useState('');
  const [setAmountTo, setSetAmountTo] = useState('');
  const [useEach, setUseEach] = useState('');

  const num = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const anyField = onLocation || onCategory || onStore || onBrand || onUnit || onPurchased || onMin || onPar;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    props.onError(null);
    try {
      await fn();
      await props.onDone();
    } catch (e) {
      props.onError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const applyFields = () =>
    run(async () => {
      const minN = num(minQ);
      const parN = num(parQ);
      if (onMin && onPar && minN != null && parN != null && parN < minN) {
        throw new Error('The ideal amount should be at least the reorder point.');
      }
      const ids = items.map((i) => i.id);
      await bulkUpdateInventoryItems(ids, {
        ...(onLocation ? { locationId } : {}),
        ...(onCategory ? { category } : {}),
        ...(onStore ? { store } : {}),
        ...(onBrand ? { brand: brand.trim() || null } : {}),
        ...(onUnit ? { unit: unit.trim() || null } : {}),
        ...(onPurchased ? { purchasedOn: purchasedOn.trim() || null } : {}),
        ...(onMin ? { minQuantity: minN } : {}),
        ...(onPar ? { parQuantity: parN } : {}),
      });
    });

  const applySetAmount = () =>
    run(async () => {
      const to = num(setAmountTo);
      if (to == null) throw new Error('Enter the amount each item should have.');
      await bulkSetAmount(householdId, items, to);
    });

  const applyUseEach = () =>
    run(async () => {
      const each = num(useEach);
      if (each == null || each === 0) throw new Error('Enter how much to use from each item.');
      await bulkConsume(householdId, items, each);
    });

  const applyDiscard = (reason: 'spoiled' | 'scrapped') =>
    run(async () => {
      await bulkDiscardAll(householdId, items, reason);
      setConfirm(null);
    });

  const applyRemove = () =>
    run(async () => {
      await bulkRemoveInventoryItems(items.map((i) => i.id));
      setConfirm(null);
    });

  const Toggle = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
    <Pressable style={styles.toggleRow} onPress={() => set(!on)}>
      <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.boxTick}>✓</Text> : null}</View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.bulk}>
      <Text style={styles.bulkHead}>Edit {items.length} item{items.length === 1 ? '' : 's'}</Text>
      <Text style={styles.bulkHint}>Only the fields you tick are changed. Everything else is left alone.</Text>

      <Toggle on={onLocation} set={setOnLocation} label="Move to a location" />
      {onLocation ? (
        <View style={styles.chips}>
          {props.locations.map(([id, label]) => (
            <Pressable key={id} style={[styles.chip, locationId === id && styles.chipOn]} onPress={() => setLocationId(id)}>
              <Text style={[styles.chipText, locationId === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.chip, locationId === null && styles.chipOn]} onPress={() => setLocationId(null)}>
            <Text style={[styles.chipText, locationId === null && styles.chipTextOn]}>Clear location</Text>
          </Pressable>
        </View>
      ) : null}

      <Toggle on={onCategory} set={setOnCategory} label="Set food type" />
      {onCategory ? (
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Toggle on={onStore} set={setOnStore} label="Set store it came from" />
      {onStore ? (
        <View style={styles.chips}>
          {STORES.map((st) => (
            <Pressable key={st} style={[styles.chip, store === st && styles.chipOn]} onPress={() => setStore(st)}>
              <Text style={[styles.chipText, store === st && styles.chipTextOn]}>{st}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Toggle on={onBrand} set={setOnBrand} label="Set brand" />
      {onBrand ? (
        <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Brand (blank clears it)" placeholderTextColor="#6b6f8c" />
      ) : null}

      <Toggle on={onUnit} set={setOnUnit} label="Set unit" />
      {onUnit ? (
        <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="e.g. package, lb, bottle" placeholderTextColor="#6b6f8c" />
      ) : null}

      <Toggle on={onPurchased} set={setOnPurchased} label="Set purchase date" />
      {onPurchased ? (
        <TextInput style={styles.input} value={purchasedOn} onChangeText={setPurchasedOn} placeholder="YYYY-MM-DD (blank clears it)" placeholderTextColor="#6b6f8c" />
      ) : null}

      <Toggle on={onMin} set={setOnMin} label="Set reorder point" />
      {onMin ? (
        <TextInput style={styles.input} value={minQ} onChangeText={setMinQ} placeholder="Buy when below" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
      ) : null}

      <Toggle on={onPar} set={setOnPar} label="Set ideal amount" />
      {onPar ? (
        <TextInput style={styles.input} value={parQ} onChangeText={setParQ} placeholder="Ideal amount" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
      ) : null}

      <Pressable style={[styles.save, (!anyField || busy) && styles.dim]} disabled={!anyField || busy} onPress={applyFields}>
        <Text style={styles.saveText}>Apply to {items.length}</Text>
      </Pressable>

      <Text style={styles.section}>AMOUNT</Text>
      <Text style={styles.bulkHint}>
        Amount changes are recorded as events, so each item gets its own delta.
      </Text>
      <View style={styles.row2}>
        <TextInput style={[styles.input, styles.half]} value={setAmountTo} onChangeText={setSetAmountTo} placeholder="Set each to…" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
        <Pressable style={[styles.altBtn, busy && styles.dim]} disabled={busy} onPress={applySetAmount}>
          <Text style={styles.altBtnText}>Count</Text>
        </Pressable>
      </View>
      <View style={styles.row2}>
        <TextInput style={[styles.input, styles.half]} value={useEach} onChangeText={setUseEach} placeholder="Use this much from each…" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
        <Pressable style={[styles.altBtn, busy && styles.dim]} disabled={busy} onPress={applyUseEach}>
          <Text style={styles.altBtnText}>Use</Text>
        </Pressable>
      </View>

      <View style={styles.bulkDanger}>
        <Pressable style={styles.dangerBtn} disabled={busy} onPress={() => setConfirm('spoiled')}>
          <Text style={styles.dangerText}>All went bad</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} disabled={busy} onPress={() => setConfirm('remove')}>
          <Text style={styles.dangerText}>Remove selected</Text>
        </Pressable>
      </View>

      {confirm ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {confirm === 'remove'
              ? `Remove ${items.length} item${items.length === 1 ? '' : 's'} from the inventory? Their history is kept.`
              : `Throw away everything on hand for ${items.length} item${items.length === 1 ? '' : 's'}?`}
          </Text>
          {confirm === 'remove' ? (
            <Pressable style={styles.confirmYes} disabled={busy} onPress={applyRemove}>
              <Text style={styles.confirmYesText}>Yes, remove them</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.confirmYes} disabled={busy} onPress={() => applyDiscard('spoiled')}>
                <Text style={styles.confirmYesText}>Yes, they went bad</Text>
              </Pressable>
              <Pressable style={styles.confirmAlt} disabled={busy} onPress={() => applyDiscard('scrapped')}>
                <Text style={styles.confirmAltText}>Threw them out (not spoiled)</Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.confirmNo} onPress={() => setConfirm(null)}>
            <Text style={styles.confirmNoText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
  householdId: string;
  selecting: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  locations: Array<[string, string]>;
  onPress: () => void;
  onSaved: () => void | Promise<void>;
  onError: (m: string | null) => void;
}) {
  const { item, open, householdId, selecting, selected } = props;
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
  const [confirmToss, setConfirmToss] = useState<null | 'spoiled' | 'scrapped'>(null);

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const onHand = item.quantity ?? 0;

  // Has anything actually changed? A Save button that is always enabled teaches
  // you to ignore it.
  const dirty =
    name !== item.name ||
    brand !== (item.brand ?? '') ||
    unit !== (item.unit ?? '') ||
    store !== item.store ||
    locationId !== item.locationId ||
    category !== (item.category === 'Other' ? null : item.category) ||
    purchasedOn !== (item.purchasedOn ?? '') ||
    minQ !== (item.minQuantity != null ? String(item.minQuantity) : '') ||
    parQ !== (item.parQuantity != null ? String(item.parQuantity) : '') ||
    num(qty) !== item.quantity;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    props.onError(null);
    try {
      await fn();
      await props.onSaved();
    } catch (e) {
      props.onError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  // Quick actions on the collapsed row: the things you do twenty times a week.
  const quickUse = (amount: number) => run(() => consumeAmount(householdId, item.id, amount));
  const quickAdd = (amount: number) => run(() => recordMovement(householdId, item.id, amount, 'purchased'));
  const tossAll = (reason: 'spoiled' | 'scrapped') =>
    run(async () => {
      if (onHand <= 0) throw new Error('There is none left to throw away.');
      const fn = reason === 'spoiled' ? markSpoiled : markScrapped;
      await fn(householdId, item.id, onHand);
      setConfirmToss(null);
    });

  const save = () =>
    run(async () => {
      const minN = num(minQ);
      const parN = num(parQ);
      if (minN != null && parN != null && parN < minN) {
        throw new Error('The ideal amount should be at least the reorder point.');
      }
      await updateInventoryItem(item.id, {
        name,
        brand: brand.trim() || null,
        unit: unit.trim() || null,
        category,
        locationId,
        store,
        purchasedOn: purchasedOn.trim() || null,
        minQuantity: minN,
        parQuantity: parN,
      });
      // Quantity is a ledger balance, not a field. Changing it records a count.
      const target = num(qty);
      if (target != null && target !== item.quantity) {
        await recordCount(householdId, item.id, item.quantity ?? 0, target);
      }
    });

  const remove = () => run(() => removeInventoryItem(item.id));

  if (!open) {
    return (
      <View style={[styles.row, selecting && selected && styles.rowSelected]}>
        {selecting ? (
          <Pressable style={styles.pickHit} onPress={props.onToggleSelected}>
            <View style={[styles.box, selected && styles.boxOn]}>
              {selected ? <Text style={styles.boxTick}>✓</Text> : null}
            </View>
          </Pressable>
        ) : null}
        <Pressable style={styles.rowBody} onPress={props.onPress}>
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

          {selecting ? null : (
          <View style={styles.quickRow}>
            <Pressable style={styles.quick} disabled={busy || onHand <= 0} onPress={() => quickUse(1)}>
              <Text style={[styles.quickText, onHand <= 0 && styles.quickOff]}>− Use 1</Text>
            </Pressable>
            <Pressable style={styles.quick} disabled={busy} onPress={() => quickAdd(1)}>
              <Text style={styles.quickText}>+ Add 1</Text>
            </Pressable>
            <Pressable style={styles.quick} disabled={busy || onHand <= 0} onPress={() => quickUse(onHand)}>
              <Text style={[styles.quickText, onHand <= 0 && styles.quickOff]}>Used it all</Text>
            </Pressable>
            <Pressable style={styles.quickBad} disabled={busy || onHand <= 0} onPress={() => setConfirmToss('spoiled')}>
              <Text style={[styles.quickBadText, onHand <= 0 && styles.quickOff]}>Went bad</Text>
            </Pressable>
          </View>
          )}

          {confirmToss ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                Throw away all {formatQuantity(onHand, item.unit)}?
              </Text>
              <Pressable style={styles.confirmYes} disabled={busy} onPress={() => tossAll('spoiled')}>
                <Text style={styles.confirmYesText}>Yes, it went bad</Text>
              </Pressable>
              <Pressable style={styles.confirmAlt} disabled={busy} onPress={() => tossAll('scrapped')}>
                <Text style={styles.confirmAltText}>Threw it out (not spoiled)</Text>
              </Pressable>
              <Pressable style={styles.confirmNo} onPress={() => setConfirmToss(null)}>
                <Text style={styles.confirmNoText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>

        <Pressable style={styles.levelWrap} onPress={props.onPress}>
          {item.needsRestock ? <Text style={styles.restock}>RESTOCK</Text> : null}
          <Text style={styles.level}>{item.levelLabel}</Text>
          {item.needsRestock && item.reorderLabel ? <Text style={styles.reorder}>{item.reorderLabel}</Text> : null}
          <Text style={styles.editHint}>edit</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      {/* Save sits at the TOP as well as the bottom: on a phone, three chip
          groups push a bottom-only button below the fold and it looks like
          there's no way to save. */}
      <View style={styles.saveBar}>
        <Text style={styles.editorTitle} numberOfLines={1}>{item.name}</Text>
        <Pressable style={[styles.save, (!dirty || busy) && styles.dim]} disabled={!dirty || busy} onPress={save}>
          <Text style={styles.saveText}>{dirty ? 'Save' : 'Saved'}</Text>
        </Pressable>
        <Pressable style={styles.cancel} disabled={busy} onPress={props.onPress}>
          <Text style={styles.cancelText}>Close</Text>
        </Pressable>
      </View>

      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#6b6f8c" />
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Brand" placeholderTextColor="#6b6f8c" />
      <View style={styles.row2}>
        <TextInput style={[styles.input, styles.half]} value={qty} onChangeText={setQty} placeholder="How much" placeholderTextColor="#6b6f8c" keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.half]} value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor="#6b6f8c" />
      </View>
      <Text style={styles.note}>Changing the amount records a count. Use the quick actions to log what was used or thrown away.</Text>

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
        <Pressable style={[styles.save, (!dirty || busy) && styles.dim]} disabled={!dirty || busy} onPress={save}>
          <Text style={styles.saveText}>{dirty ? 'Save changes' : 'No changes'}</Text>
        </Pressable>
        <Pressable style={styles.cancel} disabled={busy} onPress={props.onPress}>
          <Text style={styles.cancelText}>Close</Text>
        </Pressable>
        <Pressable style={styles.remove} disabled={busy} onPress={remove}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  grow: { flex: 1 },
  selectBtn: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 12, paddingHorizontal: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  selectBtnOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  selectBtnText: { color: '#c4c8e0', fontWeight: '600' },
  selectBtnTextOn: { color: '#ffffff' },
  selBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  selCount: { color: '#F2F4FA', fontSize: 14, fontWeight: '600' },
  pickHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#3A4160', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: '#7c9bff', borderColor: '#7c9bff' },
  boxTick: { color: '#0B0E1A', fontSize: 14, fontWeight: '700' },
  rowSelected: { borderWidth: 1, borderColor: '#7c9bff' },
  bulk: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#3A4160' },
  bulkHead: { color: '#F2F4FA', fontSize: 16, fontWeight: '700' },
  bulkHint: { color: '#8a8fb0', fontSize: 12, marginTop: 4, marginBottom: 8, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  toggleLabel: { color: '#c4c8e0', fontSize: 14 },
  altBtn: { backgroundColor: '#2a2f4a', borderRadius: 12, paddingHorizontal: 20, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  altBtnText: { color: '#e8eaf6', fontWeight: '600' },
  bulkDanger: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dangerBtn: { flex: 1, borderWidth: 1, borderColor: '#4a3350', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: '#d99ac0', fontWeight: '600', fontSize: 13 },
  wrap: { padding: 20, paddingBottom: 40 },
  backBar: { paddingHorizontal: 20, paddingVertical: 12 },
  backText: { color: '#7c9bff', fontSize: 15 },
  scanBtn: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scanBtnText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 48, marginBottom: 8 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  link: { color: '#7c9bff', fontSize: 13 },
  linkDim: { color: '#4a4f70' },
  section: { color: '#8a8fb0', fontSize: 11, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  groupBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  groupBarLinks: { flexDirection: 'row', gap: 12 },
  miniLink: { color: '#6b7398', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
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
  editHint: { color: '#7c9bff', fontSize: 11, marginTop: 4 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  quick: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 999, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  quickText: { color: '#c4c8e0', fontSize: 12, fontWeight: '600' },
  quickOff: { color: '#4a4f70' },
  quickBad: { borderWidth: 1, borderColor: '#4a3350', borderRadius: 999, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  quickBadText: { color: '#d99ac0', fontSize: 12, fontWeight: '600' },
  confirm: { marginTop: 10, backgroundColor: '#1F2438', borderRadius: 12, padding: 12, gap: 8 },
  confirmText: { color: '#F2F4FA', fontSize: 14 },
  confirmYes: { backgroundColor: '#d99ac0', borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmYesText: { color: '#0B0E1A', fontWeight: '700' },
  confirmAlt: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmAltText: { color: '#c4c8e0' },
  confirmNo: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  confirmNoText: { color: '#8a8fb0' },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  editorTitle: { color: '#F2F4FA', fontSize: 16, fontWeight: '700', flex: 1 },
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
