import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { claimRide, postRideUpdate, requestRide } from '../api/rides';
import { useOpenRides } from '../hooks/useRides';
import type { RideView } from '../domain/rides';

import { color } from '../theme';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function RidesScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useOpenRides(householdId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [escalateId, setEscalateId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // New-ride request form.
  const [dest, setDest] = useState('');
  const [pickup, setPickup] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['rides', householdId] });

  const request = async () => {
    if (!dest.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await requestRide(householdId, dest.trim(), pickup.trim() || 'Home', null);
      setDest('');
      setPickup('');
      await refresh();
      await qc.invalidateQueries({ queryKey: ['today', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setAdding(false);
    }
  };

  const claim = async (r: RideView) => {
    setBusyId(r.id);
    setError(null);
    try {
      await claimRide(r.id, r.version);
      await refresh();
      await qc.invalidateQueries({ queryKey: ['today', householdId] });
    } catch (e) {
      // A stale version here means someone else claimed first (ADR-0008).
      setError(msg(e));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const escalate = async (r: RideView) => {
    if (!note.trim()) return;
    setBusyId(r.id);
    setError(null);
    try {
      await postRideUpdate(r.id, 'escalation', note.trim());
      setEscalateId(null);
      setNote('');
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: RideView }) => (
    <View style={[styles.card, item.needsDriver && styles.cardAlert]}>
      <Text style={styles.dest}>{item.destination}</Text>
      <Text style={styles.meta}>
        {item.statusLabel} · {item.ownerLabel}
      </Text>
      <View style={styles.row}>
        {item.needsDriver && (
          <Pressable style={styles.btn} disabled={busyId === item.id} onPress={() => claim(item)}>
            <Text style={styles.btnText}>Claim driver</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.btn, styles.btnAlt]}
          onPress={() => {
            setEscalateId(escalateId === item.id ? null : item.id);
            setNote('');
          }}
        >
          <Text style={styles.btnAltText}>Escalate</Text>
        </Pressable>
      </View>
      {escalateId === item.id && (
        <View style={styles.escalate}>
          <TextInput
            style={styles.input}
            placeholder="What's the problem?"
            placeholderTextColor={color.textFaint}
            value={note}
            onChangeText={setNote}
          />
          <Pressable style={styles.btn} disabled={busyId === item.id} onPress={() => escalate(item)}>
            <Text style={styles.btnText}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Where to? (destination)"
          placeholderTextColor={color.textFaint}
          value={dest}
          onChangeText={setDest}
        />
        <TextInput
          style={styles.input}
          placeholder="Pickup (optional, defaults to Home)"
          placeholderTextColor={color.textFaint}
          value={pickup}
          onChangeText={setPickup}
        />
        <Pressable style={[styles.addBtn, adding && styles.busy]} disabled={adding} onPress={request}>
          <Text style={styles.addText}>Request a ride</Text>
        </Pressable>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={color.accent} style={styles.spinner} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={styles.empty}>No open rides. All handled.</Text>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  composer: { padding: 20, paddingBottom: 8, gap: 10 },
  addBtn: { backgroundColor: color.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  addText: { color: color.accentInk, fontWeight: '700', fontSize: 15 },
  busy: { opacity: 0.6 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: color.border },
  cardAlert: { borderWidth: 1, borderColor: color.danger },
  dest: { color: color.text, fontSize: 16, fontWeight: '600' },
  meta: { color: color.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { backgroundColor: color.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: color.accentInk, fontWeight: '700' },
  btnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.border },
  btnAltText: { color: color.textMuted, fontWeight: '600' },
  escalate: { gap: 8, marginTop: 4 },
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: color.borderStrong },
  empty: { color: color.textFaint, textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: color.danger, textAlign: 'center', padding: 16, fontSize: 14 },
});
