import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { useMyMemberships } from '../hooks/useHouseholds';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainScreen } from './MainScreen';

import { color } from '../theme';

// Session-driven gating: no session -> auth; signed in but no active household ->
// onboarding; otherwise -> Today for the first active household.
export function Root() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <AuthScreen />;
  return <AuthedRoot />;
}

function AuthedRoot() {
  const memberships = useMyMemberships();

  if (memberships.isLoading) return <Loading />;
  if (memberships.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Could not load your households. Pull to retry from Today once signed in.</Text>
      </View>
    );
  }

  const active = memberships.data ?? [];
  if (active.length === 0) return <OnboardingScreen />;

  const membership = active[0];
  return (
    <MainScreen
      householdId={membership.household_id}
      householdName={membership.households?.name ?? 'Home'}
      membershipId={membership.id}
    />
  );
}

function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  err: { color: color.danger, fontSize: 16, textAlign: 'center' },
});
