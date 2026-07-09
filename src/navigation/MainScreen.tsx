import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../auth/AuthProvider';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { AssetsScreen } from '../screens/AssetsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { MealsTab } from '../screens/MealsTab';
import { PollsScreen } from '../screens/PollsScreen';
import { RidesScreen } from '../screens/RidesScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TodayScreen } from '../screens/TodayScreen';

type Tab =
  | 'today' | 'events' | 'rides' | 'meals' | 'announce'
  | 'polls' | 'shop' | 'scan' | 'inventory' | 'tasks' | 'upkeep';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'events', label: 'Events' },
  { key: 'rides', label: 'Rides' },
  { key: 'meals', label: 'Meals' },
  { key: 'announce', label: 'News' },
  { key: 'polls', label: 'Polls' },
  { key: 'shop', label: 'Shop' },
  { key: 'scan', label: 'Scan' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'upkeep', label: 'Upkeep' },
];

export function MainScreen(props: { householdId: string; householdName: string; membershipId: string }) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('today');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{props.householdName.toUpperCase()}</Text>
          <Text style={styles.title}>{TABS.find((t) => t.key === tab)?.label}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.signout}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {tab === 'today' && <TodayScreen householdId={props.householdId} />}
        {tab === 'events' && <EventsScreen householdId={props.householdId} />}
        {tab === 'rides' && <RidesScreen householdId={props.householdId} />}
        {tab === 'meals' && <MealsTab householdId={props.householdId} />}
        {tab === 'announce' && <AnnouncementsScreen householdId={props.householdId} />}
        {tab === 'polls' && <PollsScreen householdId={props.householdId} />}
        {tab === 'shop' && <ShopScreen householdId={props.householdId} />}
        {tab === 'scan' && <ScanScreen householdId={props.householdId} />}
        {tab === 'inventory' && <InventoryScreen householdId={props.householdId} />}
        {tab === 'tasks' && <TasksScreen householdId={props.householdId} />}
        {tab === 'upkeep' && <AssetsScreen householdId={props.householdId} />}
      </View>

      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1220' },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { color: '#8a8fb0', fontSize: 12, letterSpacing: 2 },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '700' },
  signout: { color: '#6b6f8c', fontSize: 14 },
  body: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#242844',
    paddingBottom: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: '#6b6f8c', fontSize: 13, fontWeight: '600' },
  tabActive: { color: '#ffffff' },
});
