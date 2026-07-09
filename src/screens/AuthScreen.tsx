import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../auth/AuthProvider';
import { emailFor, HOUSEHOLD_MEMBERS, PIN_LENGTH, type Member } from '../auth/household';
import { color, radius, space, TOUCH, type as t } from '../theme';

/**
 * Tap a name, type a PIN. No email, no keyboard.
 *
 * Supabase's error messages ("Invalid login credentials", and the 429 rate-limit
 * text about "security purposes") are written for developers. A ten-year-old
 * typing the wrong PIN should read something a human wrote.
 */
function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  const s = raw.toLowerCase();
  if (s.includes('invalid login') || s.includes('invalid credentials')) return 'That PIN is not right. Try again.';
  if (s.includes('security purposes') || s.includes('rate limit') || s.includes('too many')) {
    return 'Too many tries just now. Wait a few seconds and try again.';
  }
  if (s.includes('failed to fetch') || s.includes('network')) return "Can't reach the house right now. Check your connection.";
  if (!raw || raw === '{}') return 'Something went wrong signing in.';
  return raw;
}

export function AuthScreen() {
  const { signIn } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit automatically once the PIN is complete. Nobody wants to hunt for a
  // button after typing four digits.
  useEffect(() => {
    if (!member || pin.length !== PIN_LENGTH || busy) return;
    let cancelled = false;

    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        const email = emailFor(member.name);
        if (!email) throw new Error('Unknown person.');
        await signIn(email, pin);
      } catch (e) {
        if (cancelled) return;
        setError(friendlyError(e));
        setPin('');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pin, member, busy, signIn]);

  const press = (digit: string) => {
    setError(null);
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + digit));
  };
  const back = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  if (!member) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Text style={styles.kicker}>GREEN HOUSEHOLD</Text>
          <Text style={styles.title}>Who's this?</Text>
          <View style={styles.people}>
            {HOUSEHOLD_MEMBERS.map((m) => (
              <Pressable
                key={m.name}
                style={styles.person}
                onPress={() => {
                  setMember(m);
                  setPin('');
                  setError(null);
                }}
              >
                <Text style={styles.personInitial}>{m.name[0]}</Text>
                <Text style={styles.personName}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable
          onPress={() => {
            setMember(null);
            setPin('');
            setError(null);
          }}
          style={styles.backHit}
        >
          <Text style={styles.back}>‹ Not {member.name}?</Text>
        </Pressable>

        <Text style={styles.title}>Hi, {member.name}</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>

        <View style={styles.dots}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        <View style={styles.errorSlot}>
          {busy ? <ActivityIndicator color={color.accent} /> : error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.pad}>
          {keys.map((k, i) =>
            k === '' ? (
              <View key={`sp-${i}`} style={styles.key} />
            ) : (
              <Pressable
                key={k}
                style={styles.key}
                disabled={busy}
                onPress={() => (k === '⌫' ? back() : press(k))}
              >
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            ),
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  container: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'center', maxWidth: 460, width: '100%', alignSelf: 'center' },
  kicker: { ...t.kicker, marginBottom: 4 },
  title: { ...t.title, fontSize: 28 },
  subtitle: { color: color.textMuted, fontSize: 15, marginTop: 6 },

  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xl },
  person: {
    flexGrow: 1,
    minWidth: 130,
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  personInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.accentSoft,
    color: color.accent,
    textAlign: 'center',
    lineHeight: 40,
    fontSize: 18,
    fontWeight: '700',
    overflow: 'hidden',
  },
  personName: { color: color.text, fontSize: 16, fontWeight: '600' },

  backHit: { minHeight: TOUCH, justifyContent: 'center' },
  back: { color: color.accent, fontSize: 15 },

  dots: { flexDirection: 'row', gap: 16, marginTop: space.xl, marginBottom: space.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color.borderStrong },
  dotFilled: { backgroundColor: color.accent, borderColor: color.accent },

  errorSlot: { minHeight: 28, justifyContent: 'center' },
  error: { color: color.danger, fontSize: 14 },

  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  key: {
    width: '30%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: color.text, fontSize: 24, fontWeight: '600' },
});
