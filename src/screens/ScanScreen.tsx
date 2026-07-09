import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  addScannedItem,
  CATEGORIES,
  FRACTIONS,
  formatAmount,
  lookupBarcode,
  MEASURE_UNITS,
  STORES,
  unitProfile,
} from '../api/barcode';
import { createLocation, type StorageLocation } from '../api/locations';
import { rankSuggestions, suggestionsByBrand, type ItemSuggestion } from '../api/shopping';
import { useItemSuggestions } from '../hooks/useItemSuggestions';
import { useLocations } from '../hooks/useLocations';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

// BarcodeDetector is Chromium-only (Android Chrome, desktop Chrome/Edge).
// Safari -- including every iPhone -- does not have it. Rather than ship a
// scanner that silently fails on half the family's phones, we detect support and
// fall back to typing the number, which always works.
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
function getDetector(): BarcodeDetectorLike | null {
  if (Platform.OS !== 'web') return null;
  const w = globalThis as unknown as { BarcodeDetector?: new (o?: unknown) => BarcodeDetectorLike };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] });
  } catch {
    return null;
  }
}

interface Draft {
  barcode: string;
  name: string;
  brand: string;
  unit: string;
  looked: boolean;
  found: boolean;
}

const EMPTY: Draft = { barcode: '', name: '', brand: '', unit: '', looked: false, found: false };

export function ScanScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const locationsQ = useLocations(householdId);
  const suggestionsQ = useItemSuggestions(householdId);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [typedCode, setTypedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cameraSupported] = useState(() => getDetector() !== null);

  // Location and category are "sticky": when you're emptying the fridge you're
  // adding twenty fridge items in a row. Re-picking each time would be miserable.
  const [locationId, setLocationId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);

  // How much is there? Three ways to say it, because one size does not fit.
  //   packages -> "2 boxes"        (whole units)
  //   fraction -> "½ package"      (a partly-used container)
  //   measure  -> "1.5 lb"         (an actual weight or volume)
  const [amountMode, setAmountMode] = useState<'packages' | 'fraction' | 'measure'>('packages');
  const [packages, setPackages] = useState(1);
  const [fraction, setFraction] = useState(1);
  const [measureQty, setMeasureQty] = useState('');
  const [measureUnit, setMeasureUnit] = useState<string>('lb');
  const [minQty, setMinQty] = useState('');
  const [parQty, setParQty] = useState('');
  const [store, setStore] = useState<string | null>(null);
  const [purchasedOn, setPurchasedOn] = useState('');
  const [showAllUnits, setShowAllUnits] = useState(false);

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // Units follow the item: butter offers sticks, jam offers jars, wine offers bottles.
  const profile = useMemo(() => unitProfile(draft.name, category), [draft.name, category]);

  const amount = (): { quantity: number; unit: string | null } => {
    if (amountMode === 'packages') return { quantity: packages, unit: profile.container };
    if (amountMode === 'fraction') return { quantity: fraction, unit: profile.container };
    const q = Number(measureQty.trim());
    return { quantity: Number.isFinite(q) && q >= 0 ? q : 0, unit: measureUnit };
  };

  // Autocomplete over the household's own 260-item catalog.
  const suggestions: ItemSuggestion[] = rankSuggestions(suggestionsQ.data ?? [], draft.name, 5);
  // Typing a brand lists that brand's items, so you can pick rather than recall.
  const brandMatches: ItemSuggestion[] = suggestionsByBrand(suggestionsQ.data ?? [], draft.brand, 8);

  const applySuggestion = (s: ItemSuggestion) => {
    setDraft((d) => ({
      ...d,
      name: s.name,
      brand: s.brand ?? d.brand,
      unit: s.unit ?? d.unit,
      looked: true,
    }));
    if (s.category) setCategory(s.category);
    if (s.store) setStore(s.store);
    const p = unitProfile(s.name, s.category ?? null);
    setMeasureUnit(p.units[0]);
  };

  const addLocation = async () => {
    if (!newLocation.trim()) return;
    setError(null);
    try {
      const loc = await createLocation(householdId, newLocation);
      setNewLocation('');
      setAddingLocation(false);
      await qc.invalidateQueries({ queryKey: ['locations', householdId] });
      setLocationId(loc.id);
    } catch (e) {
      setError(msg(e));
    }
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastCode = useRef<string>('');

  const resolveCode = useCallback(async (code: string) => {
    const clean = code.replace(/\D/g, '');
    if (!clean || clean === lastCode.current) return;
    lastCode.current = clean;
    setBusy(true);
    setError(null);
    try {
      const p = await lookupBarcode(clean);
      setDraft({
        barcode: clean,
        name: p.name ?? '',
        brand: p.brand ?? '',
        unit: p.size ?? '',
        looked: true,
        found: p.found,
      });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    const detector = getDetector();
    if (!detector) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      // Give React a tick to mount the <video>.
      setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        void v.play();
        loopRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const hits = await detector.detect(videoRef.current);
            if (hits.length > 0) {
              stopCamera();
              await resolveCode(hits[0].rawValue);
            }
          } catch {
            /* a frame failed to decode; keep going */
          }
        }, 350);
      }, 50);
    } catch (e) {
      setError('Camera unavailable. You can type the barcode instead.');
      setScanning(false);
    }
  }, [resolveCode, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Give it a name before saving.');
      return;
    }
    const { quantity, unit } = amount();
    if (amountMode === 'measure' && !measureQty.trim()) {
      setError('Enter how much, or switch to packages.');
      return;
    }
    const minQ = num(minQty);
    const parQ = num(parQty);
    // The DB enforces par >= min; catch it here so the message is human.
    if (minQ != null && parQ != null && parQ < minQ) {
      setError('The ideal amount should be at least the reorder point.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const outcome = await addScannedItem(householdId, {
        name: draft.name.trim(),
        brand: draft.brand.trim() || null,
        // The package size off the label (e.g. "50 oz") lives on the catalog row;
        // `unit` here is how much we actually HAVE.
        unit,
        quantity,
        minQuantity: minQ,
        parQuantity: parQ,
        store,
        purchasedOn: purchasedOn.trim() || null,
        barcode: draft.barcode || null,
        category,
        locationId,
      });
      const amt = formatAmount(quantity, unit);
      setLog((l) => [`${outcome === 'incremented' ? 'Added to' : 'Added'} ${draft.name.trim()} — ${amt}`, ...l].slice(0, 12));
      setDraft(EMPTY);
      setTypedCode('');
      setMinQty('');
      setParQty('');
      setMeasureQty('');
      lastCode.current = '';
      // Location and category stay put — you're still standing at the same shelf.
      await qc.invalidateQueries({ queryKey: ['inventory', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.hint}>
        Scan a barcode to add it. Fresh produce and butcher-counter meat have no barcode — just type the name
        and save. Wine and spirits scan fine; the lookup often won't know them, so name them yourself.
      </Text>

      <Text style={styles.section}>WHERE</Text>
      <View style={styles.chips}>
        {(locationsQ.data ?? []).map((l: StorageLocation) => (
          <Pressable
            key={l.id}
            style={[styles.chip, locationId === l.id && styles.chipOn]}
            onPress={() => setLocationId(locationId === l.id ? null : l.id)}
          >
            <Text style={[styles.chipText, locationId === l.id && styles.chipTextOn]}>{l.name}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.chip} onPress={() => setAddingLocation((v) => !v)}>
          <Text style={styles.chipText}>+ New</Text>
        </Pressable>
      </View>
      {addingLocation ? (
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.grow]}
            placeholder="e.g. Basement fridge"
            placeholderTextColor="#6b6f8c"
            value={newLocation}
            onChangeText={setNewLocation}
          />
          <Pressable style={styles.lookup} onPress={addLocation}>
            <Text style={styles.lookupText}>Create</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>CATEGORY</Text>
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

      {cameraSupported ? (
        scanning ? (
          <View style={styles.cameraBox}>
            <video ref={videoRef} style={styles.video} muted playsInline />
            <Pressable style={styles.stop} onPress={stopCamera}>
              <Text style={styles.stopText}>Stop scanning</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.primary} onPress={startCamera}>
            <Text style={styles.primaryText}>Scan a barcode</Text>
          </Pressable>
        )
      ) : (
        <Text style={styles.warn}>
          This browser can't use the camera scanner (Safari and iPhone don't support it). Type the barcode below
          — it works the same.
        </Text>
      )}

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.grow]}
          placeholder="Barcode number (optional)"
          placeholderTextColor="#6b6f8c"
          value={typedCode}
          onChangeText={setTypedCode}
          keyboardType="number-pad"
        />
        <Pressable style={styles.lookup} disabled={busy} onPress={() => resolveCode(typedCode)}>
          <Text style={styles.lookupText}>Look up</Text>
        </Pressable>
      </View>

      {busy ? <ActivityIndicator color="#fff" style={styles.spin} /> : null}

      {
        <View style={styles.card}>
          <Text style={styles.cardHead}>
            {draft.looked
              ? draft.found
                ? 'Found it — check and save'
                : 'Not in the product database — name it yourself'
              : 'Type a name, or scan a barcode above'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Item name"
            placeholderTextColor="#6b6f8c"
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v, looked: true }))}
          />
          {suggestions.length > 0 ? (
            <View style={styles.chips}>
              {suggestions.map((s) => (
                <Pressable key={`${s.name}|${s.store ?? ''}`} style={styles.chip} onPress={() => applySuggestion(s)}>
                  {s.store ? <Text style={styles.chipStore}>{s.store}</Text> : null}
                  <Text style={styles.chipTextOn}>{s.name}</Text>
                  {s.brand || s.unit ? (
                    <Text style={styles.chipText}>{[s.brand, s.unit].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Brand (type to see everything from that brand)"
            placeholderTextColor="#6b6f8c"
            value={draft.brand}
            onChangeText={set('brand')}
          />
          {brandMatches.length > 0 ? (
            <>
              <Text style={styles.subtle}>{brandMatches.length} item{brandMatches.length === 1 ? '' : 's'} from this brand</Text>
              <View style={styles.chips}>
                {brandMatches.map((s) => (
                  <Pressable key={`b|${s.name}|${s.store ?? ''}`} style={styles.chip} onPress={() => applySuggestion(s)}>
                    {s.store ? <Text style={styles.chipStore}>{s.store}</Text> : null}
                    <Text style={styles.chipTextOn}>{s.name}</Text>
                    {s.unit ? <Text style={styles.chipText}>{s.unit}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <TextInput style={styles.input} placeholder="Package size on the label (e.g. 50 oz)" placeholderTextColor="#6b6f8c" value={draft.unit} onChangeText={set('unit')} />

          <Text style={styles.section}>HOW MUCH IS THERE</Text>
          <View style={styles.chips}>
            {(['packages', 'fraction', 'measure'] as const).map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, amountMode === m && styles.chipOn]}
                onPress={() => setAmountMode(m)}
              >
                <Text style={[styles.chipText, amountMode === m && styles.chipTextOn]}>
                  {m === 'packages'
                    ? `Whole ${profile.container}s`
                    : m === 'fraction'
                      ? `Part of a ${profile.container}`
                      : 'Weight / volume / count'}
                </Text>
              </Pressable>
            ))}
          </View>

          {amountMode === 'packages' ? (
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5, 6, 8, 12].map((n) => (
                <Pressable key={n} style={[styles.chip, packages === n && styles.chipOn]} onPress={() => setPackages(n)}>
                  <Text style={[styles.chipText, packages === n && styles.chipTextOn]}>{n}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {amountMode === 'fraction' ? (
            <View style={styles.chips}>
              {FRACTIONS.map((f) => (
                <Pressable
                  key={f.label}
                  style={[styles.chip, Math.abs(fraction - f.value) < 0.001 && styles.chipOn]}
                  onPress={() => setFraction(f.value)}
                >
                  <Text style={[styles.chipText, Math.abs(fraction - f.value) < 0.001 && styles.chipTextOn]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {amountMode === 'measure' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="How much (e.g. 1.5)"
                placeholderTextColor="#6b6f8c"
                value={measureQty}
                onChangeText={setMeasureQty}
                keyboardType="decimal-pad"
              />
              {/* Units that suit this item first; the full list stays reachable. */}
              <View style={styles.chips}>
                {profile.units.map((u) => (
                  <Pressable key={u} style={[styles.chip, measureUnit === u && styles.chipOn]} onPress={() => setMeasureUnit(u)}>
                    <Text style={[styles.chipText, measureUnit === u && styles.chipTextOn]}>{u}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.chip} onPress={() => setShowAllUnits((v) => !v)}>
                  <Text style={styles.chipText}>{showAllUnits ? 'Fewer' : 'Other units'}</Text>
                </Pressable>
              </View>
              {showAllUnits ? (
                <View style={styles.chips}>
                  {MEASURE_UNITS.filter((u) => !profile.units.includes(u)).map((u) => (
                    <Pressable key={u} style={[styles.chip, measureUnit === u && styles.chipOn]} onPress={() => setMeasureUnit(u)}>
                      <Text style={[styles.chipText, measureUnit === u && styles.chipTextOn]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.section}>BOUGHT AT (OPTIONAL)</Text>
          <View style={styles.chips}>
            {STORES.map((s) => (
              <Pressable key={s} style={[styles.chip, store === s && styles.chipOn]} onPress={() => setStore(store === s ? null : s)}>
                <Text style={[styles.chipText, store === s && styles.chipTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Purchased on (YYYY-MM-DD)"
            placeholderTextColor="#6b6f8c"
            value={purchasedOn}
            onChangeText={setPurchasedOn}
          />

          <Text style={styles.section}>REORDER (OPTIONAL)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Buy when below"
              placeholderTextColor="#6b6f8c"
              value={minQty}
              onChangeText={setMinQty}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Ideal amount"
              placeholderTextColor="#6b6f8c"
              value={parQty}
              onChangeText={setParQty}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.subtle}>
            Below the first number it lands on the shopping list. The second is what to buy back up to.
          </Text>

          <Text style={styles.preview}>Saving: {formatAmount(amount().quantity, amount().unit)}</Text>

          <Pressable style={[styles.primary, busy && styles.dim]} disabled={busy} onPress={save}>
            <Text style={styles.primaryText}>Add to inventory</Text>
          </Pressable>
        </View>
      }

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {log.length > 0 ? (
        <View style={styles.logBox}>
          <Text style={styles.section}>This session</Text>
          {log.map((l, i) => (
            <Text key={i} style={styles.logLine}>{l}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40, gap: 10 },
  hint: { color: '#a6abcc', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  warn: { color: '#ffb86b', fontSize: 13, lineHeight: 19 },
  cameraBox: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', gap: 8 },
  video: { width: '100%', height: 260, objectFit: 'cover' } as unknown as Record<string, unknown>,
  stop: { backgroundColor: '#2a2f4a', paddingVertical: 11, alignItems: 'center' },
  stopText: { color: '#e8eaf6', fontWeight: '600' },
  primary: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 48 },
  lookup: { backgroundColor: '#2a2f4a', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  lookupText: { color: '#e8eaf6', fontWeight: '600' },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 8 },
  cardHead: { color: '#c4c8e0', fontSize: 13, marginBottom: 2 },
  manual: { alignItems: 'center', paddingVertical: 10 },
  manualText: { color: '#8a8fb0', fontSize: 14 },
  spin: { marginVertical: 8 },
  section: { color: '#8a8fb0', fontSize: 12, letterSpacing: 1.5, marginBottom: 6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#3A4160', borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipStore: { color: '#7c9bff', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  chipText: { color: '#c4c8e0', fontSize: 13 },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  preview: { color: '#9fe0b0', fontSize: 13, marginTop: 2 },
  subtle: { color: '#6b6f8c', fontSize: 12, lineHeight: 17 },
  half: { flex: 1 },
  logBox: { marginTop: 10 },
  logLine: { color: '#9fe0b0', fontSize: 14, paddingVertical: 3 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 8 },
});
