import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { addScannedItem, CATEGORIES, lookupBarcode } from '../api/barcode';
import { createLocation } from '../api/locations';
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
    setBusy(true);
    setError(null);
    try {
      const outcome = await addScannedItem(householdId, {
        name: draft.name.trim(),
        brand: draft.brand.trim() || null,
        unit: draft.unit.trim() || null,
        barcode: draft.barcode || null,
        category,
        locationId,
      });
      setLog((l) => [`${outcome === 'incremented' ? '+1' : 'Added'} ${draft.name.trim()}`, ...l].slice(0, 12));
      setDraft(EMPTY);
      setTypedCode('');
      lastCode.current = '';
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
        {(locationsQ.data ?? []).map((l) => (
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
            {/* @ts-expect-error react-native-web renders DOM nodes */}
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
          placeholder="Barcode number"
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

      {draft.looked ? (
        <View style={styles.card}>
          <Text style={styles.cardHead}>
            {draft.found ? 'Found it — check and save' : 'Not in the product database — name it yourself'}
          </Text>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#6b6f8c" value={draft.name} onChangeText={set('name')} />
          <TextInput style={styles.input} placeholder="Brand" placeholderTextColor="#6b6f8c" value={draft.brand} onChangeText={set('brand')} />
          <TextInput style={styles.input} placeholder="Size" placeholderTextColor="#6b6f8c" value={draft.unit} onChangeText={set('unit')} />
          <Pressable style={[styles.primary, busy && styles.dim]} disabled={busy} onPress={save}>
            <Text style={styles.primaryText}>Add to fridge</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={styles.manual}
        onPress={() => setDraft({ ...EMPTY, looked: true, found: false })}
      >
        <Text style={styles.manualText}>No barcode — add by hand</Text>
      </Pressable>

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
  primary: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  lookup: { backgroundColor: '#2a2f4a', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  lookupText: { color: '#e8eaf6', fontWeight: '600' },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 8 },
  cardHead: { color: '#c4c8e0', fontSize: 13, marginBottom: 2 },
  manual: { alignItems: 'center', paddingVertical: 10 },
  manualText: { color: '#8a8fb0', fontSize: 14 },
  spin: { marginVertical: 8 },
  section: { color: '#8a8fb0', fontSize: 12, letterSpacing: 1.5, marginBottom: 6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { borderColor: '#7c9bff', backgroundColor: '#1e2440' },
  chipText: { color: '#c4c8e0', fontSize: 13 },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  logBox: { marginTop: 10 },
  logLine: { color: '#9fe0b0', fontSize: 14, paddingVertical: 3 },
  err: { color: '#ff9a9a', fontSize: 14, marginTop: 8 },
});
