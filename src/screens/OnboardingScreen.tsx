import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';

import { acceptInvite, createHousehold } from '../api/households';
import { useAuth } from '../auth/AuthProvider';

export function OnboardingScreen() {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['memberships'] });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.kicker}>HOME V2</Text>
        <Text style={styles.title}>Set up your household</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a household</Text>
          <TextInput
            style={styles.input}
            placeholder="Household name"
            placeholderTextColor="#6b6f8c"
            value={name}
            onChangeText={setName}
          />
          <Pressable
            style={[styles.button, busy && styles.busy]}
            disabled={busy}
            onPress={() => run(() => createHousehold(name.trim() || 'My Household', 'America/Chicago'))}
          >
            <Text style={styles.buttonText}>Create</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join with an invite code</Text>
          <TextInput
            style={styles.input}
            placeholder="Invite code"
            placeholderTextColor="#6b6f8c"
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <Pressable
            style={[styles.button, styles.buttonAlt, busy && styles.busy]}
            disabled={busy}
            onPress={() => run(() => acceptInvite(token.trim()))}
          >
            <Text style={[styles.buttonText, styles.buttonAltText]}>Join</Text>
          </Pressable>
        </View>

        {busy && <ActivityIndicator color="#fff" />}
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={signOut}>
          <Text style={styles.signout}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1220' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 16 },
  kicker: { color: '#8a8fb0', fontSize: 13, letterSpacing: 2 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  card: { backgroundColor: '#161a2e', borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { color: '#c4c8e0', fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1e33',
    color: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: { backgroundColor: '#7c9bff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3a3f60' },
  busy: { opacity: 0.6 },
  buttonText: { color: '#0f1220', fontSize: 16, fontWeight: '700' },
  buttonAltText: { color: '#c4c8e0' },
  error: { color: '#ff9a9a', fontSize: 14 },
  signout: { color: '#6b6f8c', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
