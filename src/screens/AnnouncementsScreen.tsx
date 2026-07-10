import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { createAnnouncement, type AnnouncementRow } from '../api/announcements';
import { useAnnouncements } from '../hooks/useAnnouncements';

import { color } from '../theme';

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function AnnouncementsScreen({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const q = useAnnouncements(householdId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAnnouncement(householdId, title.trim(), body.trim());
      setTitle('');
      setBody('');
      await qc.invalidateQueries({ queryKey: ['announcements', householdId] });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }: { item: AnnouncementRow }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Announcement title"
          placeholderTextColor={color.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Details (optional)"
          placeholderTextColor={color.textFaint}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Pressable style={[styles.btn, busy && styles.busy]} disabled={busy} onPress={post}>
          <Text style={styles.btnText}>Post announcement</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
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
        <Text style={styles.empty}>No active announcements.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  composer: { padding: 20, gap: 10 },
  input: { backgroundColor: color.surfaceInput, color: color.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: color.borderStrong },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  btn: { backgroundColor: color.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  busy: { opacity: 0.6 },
  btnText: { color: color.accentInk, fontWeight: '700', fontSize: 15 },
  spinner: { marginTop: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: color.border },
  title: { color: color.text, fontSize: 16, fontWeight: '600' },
  body: { color: color.textMuted, fontSize: 14, lineHeight: 20 },
  empty: { color: color.textFaint, textAlign: 'center', marginTop: 24, fontSize: 15 },
  err: { color: color.danger, fontSize: 14 },
});
