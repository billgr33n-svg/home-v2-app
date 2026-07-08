import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { claimRide, postRideUpdate } from '../api/rides';
import { useOpenRides } from '../hooks/useRides';
import type { RideView } from '../domain/rides';

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

  const refresh = () => qc.invalidateQueries({ queryKey: ['rides', householdId] });

  const claim = async (r: RideView) => {
    setBusyId(r.id);
    setError(null);
    try {
      await claimRide(r.id, r.version);
      await refresh();
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
            placeholderTextColor="#6b6f8c"
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
      {q.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spinner} />
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
  spinner: { marginTop: 24 },
  list: { padding: 20, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 8 },
  cardAlert: { borderWidth: 1, borderColor: '#ff6b6b' },
  dest: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  meta: { color: '#a6abcc', fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { backgroundColor: '#7c9bff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: '#0f1220', fontWeight: '700' },
  btnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3a3f60' },
  btnAltText: { color: '#c4c8e0', fontWeight: '600' },
  escalate: { gap: 8, marginTop: 4 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  empty: { color: '#8a8fb0', textAlign: 'center', marginTop: 32, fontSize: 15 },
  err: { color: '#ff9a9a', textAlign: 'center', padding: 16, fontSize: 14 },
});
