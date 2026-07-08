import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { closePoll, createPoll, respondToPoll, type PollView } from '../api/polls';
import { tallyLabel } from '../domain/polls';
import { usePolls } from '../hooks/usePolls';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function PollsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = usePolls(householdId);
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['polls', householdId] });

  const create = async () => {
    const opts = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) {
      setError('Add a question and at least two options.');
      return;
    }
    setBusyId('new');
    setError(null);
    try {
      await createPoll(householdId, question.trim(), opts);
      setQuestion('');
      setOptionsText('');
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const respond = async (p: PollView, opt: string) => {
    setBusyId(p.id);
    setError(null);
    try {
      await respondToPoll(p.id, opt);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const close = async (p: PollView) => {
    setBusyId(p.id);
    setError(null);
    try {
      await closePoll(p.id, p.version, p.myResponse ?? p.options[0] ?? '');
      await refresh();
    } catch (e) {
      // Stale version means it was already closed/changed (ADR-0008).
      setError(msg(e));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: PollView }) => (
    <View style={styles.card}>
      <Text style={styles.q}>{item.question}</Text>
      <Text style={styles.tally}>
        {tallyLabel(item.tally)}
        {item.closedAt ? ' · closed' : ''}
      </Text>
      <View style={styles.opts}>
        {item.options.map((opt) => (
          <Pressable
            key={opt}
            disabled={Boolean(item.closedAt) || busyId === item.id}
            style={[styles.opt, item.myResponse === opt && styles.optActive]}
            onPress={() => respond(item, opt)}
          >
            <Text style={[styles.optText, item.myResponse === opt && styles.optTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>
      {!item.closedAt && (
        <Pressable style={styles.close} disabled={busyId === item.id} onPress={() => close(item)}>
          <Text style={styles.closeText}>Close poll</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Poll question"
          placeholderTextColor="#6b6f8c"
          value={question}
          onChangeText={setQuestion}
        />
        <TextInput
          style={styles.input}
          placeholder="Options, comma separated"
          placeholderTextColor="#6b6f8c"
          value={optionsText}
          onChangeText={setOptionsText}
        />
        <Pressable style={[styles.btn, busyId === 'new' && styles.busy]} disabled={busyId === 'new'} onPress={create}>
          <Text style={styles.btnText}>Create poll</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>

      {q.isLoading ? (
        <ActivityIndicator color="#fff" style={styles.spinner} />
      ) : q.isError ? (
        <Text style={styles.err}>{msg(q.error)}</Text>
      ) : q.data && q.data.length > 0 ? (
        <FlatList data={q.data} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      ) : (
        <Text style={styles.empty}>No polls yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  composer: { padding: 20, gap: 10 },
  input: { backgroundColor: '#1a1e33', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  btn: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  busy: { opacity: 0.6 },
  btnText: { color: '#0f1220', fontWeight: '700', fontSize: 15 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: '#161a2e', borderRadius: 14, padding: 14, gap: 10 },
  q: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  tally: { color: '#8a8fb0', fontSize: 13 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { borderWidth: 1, borderColor: '#3a3f60', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  optActive: { backgroundColor: '#7c9bff', borderColor: '#7c9bff' },
  optText: { color: '#c4c8e0', fontSize: 14 },
  optTextActive: { color: '#0f1220', fontWeight: '700' },
  close: { alignSelf: 'flex-start', marginTop: 2 },
  closeText: { color: '#8a8fb0', fontSize: 13 },
  empty: { color: '#8a8fb0', textAlign: 'center', marginTop: 24, fontSize: 15 },
  err: { color: '#ff9a9a', fontSize: 14 },
});
