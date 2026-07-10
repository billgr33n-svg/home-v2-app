import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  beginGoogleConnect, disconnectGoogleCalendar, fetchMyCalendarConnection,
  readCalendarCallback, syncGoogleCalendar, type CalendarCallbackStatus,
} from '../api/calendar';
import { cardBase, color, radius, space, TOUCH, type as t } from '../theme';

/**
 * Connect / Sync / Disconnect for one person's Google Calendar.
 *
 * Read-only, one direction. The scope is `calendar.readonly`, so nothing here can
 * write to, move, or delete anything in anyone's real calendar. Worth saying out
 * loud on screen, because "connect your calendar" is a scary sentence.
 *
 * Disconnect revokes the grant at Google rather than merely forgetting the token
 * locally. Forgetting a live credential is not disconnecting; it is losing it.
 */
export function CalendarConnect() {
  const qc = useQueryClient();
  const [callback, setCallback] = useState<CalendarCallbackStatus>({ kind: 'none' });
  const [notice, setNotice] = useState<string | null>(null);

  // The callback lands as ?calendar=connected on the app's own URL.
  useEffect(() => {
    const result = readCalendarCallback();
    setCallback(result);
    if (result.kind === 'connected') {
      void qc.invalidateQueries({ queryKey: ['calendarConnection'] });
    }
  }, [qc]);

  const conn = useQuery({
    queryKey: ['calendarConnection'],
    queryFn: fetchMyCalendarConnection,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['calendarConnection'] });
    void qc.invalidateQueries({ queryKey: ['events'] });
    void qc.invalidateQueries({ queryKey: ['today'] });
  };

  const connect = useMutation({
    mutationFn: beginGoogleConnect,
    onSuccess: (url) => {
      // A top-level navigation, not an XHR: Google will not render in an iframe.
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
      else void Linking.openURL(url);
    },
    onError: () => setNotice('Could not reach Google. Try again in a moment.'),
  });

  const sync = useMutation({
    mutationFn: syncGoogleCalendar,
    onSuccess: (r) => {
      setNotice(
        r.upserted === 0 && r.removed === 0
          ? 'Already up to date.'
          : `Brought in ${r.upserted} event${r.upserted === 1 ? '' : 's'}` +
              (r.removed > 0 ? `, removed ${r.removed}.` : '.'),
      );
      invalidate();
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: (r) => {
      setNotice(r.note ?? `Disconnected. Removed ${r.eventsRemoved ?? 0} imported events.`);
      invalidate();
    },
    onError: () => setNotice('Could not disconnect. Try again.'),
  });

  if (conn.isLoading) return null;

  const connected = conn.data != null;
  const busy = connect.isPending || sync.isPending || disconnect.isPending;

  return (
    <View style={styles.card}>
      <Text style={styles.section}>GOOGLE CALENDAR</Text>

      {callback.kind === 'error' ? <Text style={styles.err}>{callback.message}</Text> : null}

      {connected ? (
        <>
          <Text style={styles.account}>{conn.data!.accountEmail ?? 'Connected'}</Text>
          <Text style={styles.meta}>
            {conn.data!.lastSyncedAt
              ? `Last synced ${new Date(conn.data!.lastSyncedAt).toLocaleString()}`
              : 'Never synced yet'}
          </Text>
          {conn.data!.lastError ? <Text style={styles.err}>{conn.data!.lastError}</Text> : null}

          <View style={styles.row}>
            <Pressable style={styles.primary} disabled={busy} onPress={() => sync.mutate()}>
              <Text style={styles.primaryText}>{sync.isPending ? 'Syncing...' : 'Sync now'}</Text>
            </Pressable>
            <Pressable style={styles.danger} disabled={busy} onPress={() => disconnect.mutate()}>
              <Text style={styles.dangerText}>Disconnect</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Bring your events into Today and the calendar. Read-only — nothing here can change,
            move, or delete anything in your real Google Calendar.
          </Text>
          <Text style={styles.meta}>
            Google will warn that this app is not verified. That is expected for a family app.
            Choose Advanced, then "Go to Home v2".
          </Text>
          <Pressable style={styles.primary} disabled={busy} onPress={() => connect.mutate()}>
            <Text style={styles.primaryText}>
              {connect.isPending ? 'Opening Google...' : 'Connect Google Calendar'}
            </Text>
          </Pressable>
        </>
      )}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardBase, gap: space.sm, marginBottom: space.md },
  section: { ...t.section },
  body: { ...t.detail },
  meta: { ...t.meta },
  account: { ...t.body, fontWeight: '600' },

  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  primary: {
    minHeight: TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    marginTop: space.xs,
  },
  primaryText: { color: color.accentInk, fontWeight: '700', fontSize: 14 },
  danger: {
    minHeight: TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: color.dangerSoft,
    marginTop: space.xs,
  },
  dangerText: { color: color.danger, fontWeight: '700', fontSize: 14 },

  notice: { ...t.detail, color: color.success },
  err: { color: color.danger, fontSize: 13 },
});
