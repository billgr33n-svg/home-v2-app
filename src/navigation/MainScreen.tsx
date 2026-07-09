import React, { useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../auth/AuthProvider';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { AssetsScreen } from '../screens/AssetsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { MealsTab } from '../screens/MealsTab';
import { PollsScreen } from '../screens/PollsScreen';
import { RidesScreen } from '../screens/RidesScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { color, CONTENT_MAX_WIDTH, radius, space, TOUCH, type as t } from '../theme';

// Scan is not a destination — it's an action on the inventory, so it lives
// inside that screen rather than taking a permanent slot down here.
type Tab =
  | 'today' | 'events' | 'rides' | 'meals' | 'announce'
  | 'polls' | 'shop' | 'inventory' | 'tasks' | 'upkeep';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'events', label: 'Events' },
  { key: 'rides', label: 'Rides' },
  { key: 'meals', label: 'Meals' },
  { key: 'announce', label: 'News' },
  { key: 'polls', label: 'Polls' },
  { key: 'shop', label: 'Shop' },
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

      <View style={styles.headerOuter}>
        <View style={styles.column}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker} numberOfLines={1}>
                {props.householdName.toUpperCase()}
              </Text>
              <Text style={styles.title}>{TABS.find((x) => x.key === tab)?.label}</Text>
            </View>
            <Pressable onPress={signOut} hitSlop={12} style={styles.signoutHit}>
              <Text style={styles.signout}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.column}>
          {tab === 'today' && <TodayScreen householdId={props.householdId} />}
          {tab === 'events' && <EventsScreen householdId={props.householdId} />}
          {tab === 'rides' && <RidesScreen householdId={props.householdId} />}
          {tab === 'meals' && <MealsTab householdId={props.householdId} />}
          {tab === 'announce' && <AnnouncementsScreen householdId={props.householdId} />}
          {tab === 'polls' && <PollsScreen householdId={props.householdId} />}
          {tab === 'shop' && <ShopScreen householdId={props.householdId} />}
          {tab === 'inventory' && <InventoryScreen householdId={props.householdId} />}
          {tab === 'tasks' && <TasksScreen householdId={props.householdId} />}
          {tab === 'upkeep' && <AssetsScreen householdId={props.householdId} />}
        </View>
      </View>

      {/*
        Ten tabs need ~940px to sit side by side. An iPhone gives 390. Squeezing
        them yields 35px targets — under the 44pt minimum and unusable. So the
        bar scrolls horizontally and every tab keeps a real target.
      */}
      <View style={styles.tabbarOuter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabbar}
        >
          {TABS.map((x) => {
            const active = tab === x.key;
            return (
              <Pressable key={x.key} style={styles.tab} onPress={() => setTab(x.key)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {x.label}
                </Text>
                <View style={[styles.indicator, active && styles.indicatorOn]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },

  // Centre the content column on wide screens instead of stretching chips to 1400px.
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flex: 1 },
  headerOuter: { width: '100%' },

  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  kicker: t.kicker,
  title: { ...t.title, marginTop: 2 },
  signoutHit: { minHeight: TOUCH, justifyContent: 'center', paddingLeft: space.md },
  signout: { color: color.textFaint, fontSize: 14 },

  body: { flex: 1, width: '100%' },

  tabbarOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    // Keep clear of the iPhone home indicator.
    paddingBottom: Platform.OS === 'web' ? space.xs : space.md,
  },
  tabbar: { paddingHorizontal: space.sm },
  tab: {
    minWidth: 80,
    minHeight: TOUCH + 8,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { color: color.textFaint, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: color.text },
  indicator: {
    height: 3,
    width: 22,
    borderRadius: radius.sm,
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  indicatorOn: { backgroundColor: color.accent },
});
