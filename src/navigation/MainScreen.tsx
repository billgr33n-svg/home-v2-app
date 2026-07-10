import React, { useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../auth/AuthProvider';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { AssetsScreen } from '../screens/AssetsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { KitchenScreen } from '../screens/KitchenScreen';
import { MealsTab } from '../screens/MealsTab';
import { PollsScreen } from '../screens/PollsScreen';
import { RidesScreen } from '../screens/RidesScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WasteScreen } from '../screens/WasteScreen';
import { cardBase, color, CONTENT_MAX_WIDTH, radius, shadow, space, TOUCH, type as t } from '../theme';
import {
  BAR_SECTIONS,
  destinationFor,
  landingFor,
  sectionFor,
  type ScreenKey,
  type Section,
  type SectionKey,
} from './sections';

/**
 * Four sections in the bar, a More sheet for everything else, and a landing list
 * inside any section that holds more than one destination. See ./sections.ts for
 * why, and adr/ADR-0012.
 *
 * State is (section, screen | null). A null screen means "show this section's
 * landing list". Tapping the section you are already in walks you back out to
 * that list, which is the behaviour every native tab bar has trained people to
 * expect.
 */
export function MainScreen(props: { householdId: string; householdName: string; membershipId: string }) {
  const { signOut } = useAuth();
  const [section, setSection] = useState<SectionKey>('today');
  const [screen, setScreen] = useState<ScreenKey | null>('today');
  const [moreOpen, setMoreOpen] = useState(false);

  const openSection = (s: Section) => {
    setMoreOpen(false);
    setSection(s.key);
    setScreen(landingFor(s));
  };

  const current = screen ? destinationFor(screen) : undefined;
  const activeSection = screen ? sectionFor(screen) : BAR_SECTIONS.find((s) => s.key === section);
  const heading = current?.label ?? activeSection?.label ?? 'Home';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.headerOuter}>
        <View style={styles.column}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker} numberOfLines={1}>
                {props.householdName.toUpperCase()}
              </Text>
              <Text style={styles.title}>{heading}</Text>
            </View>
            <Pressable onPress={signOut} hitSlop={12} style={styles.signoutHit}>
              <Text style={styles.signout}>Sign out</Text>
            </Pressable>
          </View>

          {/* Inside a multi-destination section, a sub-bar beats a back button. */}
          {activeSection && activeSection.destinations.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subbar}>
              {activeSection.destinations.map((d) => {
                const on = screen === d.key;
                return (
                  <Pressable key={d.key} onPress={() => setScreen(d.key)} style={[styles.pill, on && styles.pillOn]}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.column}>
          {screen === null && activeSection ? (
            <SectionLanding section={activeSection} onPick={setScreen} />
          ) : null}
          {screen === 'today' && <TodayScreen householdId={props.householdId} />}
          {screen === 'meals' && <MealsTab householdId={props.householdId} />}
          {screen === 'shop' && <ShopScreen householdId={props.householdId} />}
          {screen === 'inventory' && <InventoryScreen householdId={props.householdId} />}
          {screen === 'waste' && <WasteScreen householdId={props.householdId} />}
          {screen === 'kitchen' && <KitchenScreen householdId={props.householdId} />}
          {screen === 'tasks' && <TasksScreen householdId={props.householdId} />}
          {screen === 'upkeep' && <AssetsScreen householdId={props.householdId} />}
          {screen === 'events' && <EventsScreen householdId={props.householdId} />}
          {screen === 'announce' && <AnnouncementsScreen householdId={props.householdId} />}
          {screen === 'polls' && <PollsScreen householdId={props.householdId} />}
          {screen === 'rides' && <RidesScreen householdId={props.householdId} />}
        </View>
      </View>

      {/*
        Five slots at 20% each. No horizontal scroll, no hidden destinations, and
        every target clears 44pt on a 320px phone (64px per slot).
      */}
      <View style={styles.tabbarOuter}>
        <View style={styles.tabbar}>
          {BAR_SECTIONS.map((s) => {
            const active = !moreOpen && activeSection?.key === s.key;
            return (
              <Pressable key={s.key} style={styles.tab} onPress={() => openSection(s)} accessibilityRole="tab">
                <View style={[styles.tabIconWrap, active && styles.tabIconWrapOn]}>
                  <Text style={styles.tabIcon}>{s.icon}</Text>
                </View>
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.tab} onPress={() => setMoreOpen(true)} accessibilityRole="button">
            <View style={[styles.tabIconWrap, moreOpen && styles.tabIconWrapOn]}>
              <Text style={styles.tabIcon}>⋯</Text>
            </View>
            <Text style={[styles.tabText, moreOpen && styles.tabTextActive]}>More</Text>
          </Pressable>
        </View>
      </View>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onPick={(k) => {
          setMoreOpen(false);
          const s = sectionFor(k);
          if (s) setSection(s.key);
          setScreen(k);
        }}
      />
    </SafeAreaView>
  );
}

function SectionLanding(props: { section: Section; onPick: (k: ScreenKey) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.landing}>
      {props.section.destinations.map((d) => (
        <Pressable key={d.key} style={styles.landingRow} onPress={() => props.onPick(d.key)}>
          <View style={styles.landingIconWrap}>
            <Text style={styles.landingIcon}>{d.icon}</Text>
          </View>
          <View style={styles.landingText}>
            <Text style={styles.landingTitle}>{d.label}</Text>
            <Text style={styles.landingBlurb}>{d.blurb}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Everything, flat, in one place. The bar is for the things you reach for; this
 * is for the thing you are looking for. New domains land here before they earn a
 * section.
 */
function MoreSheet(props: { open: boolean; onClose: () => void; onPick: (k: ScreenKey) => void }) {
  return (
    <Modal visible={props.open} animationType="slide" transparent onRequestClose={props.onClose}>
      <Pressable style={styles.scrim} onPress={props.onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView contentContainerStyle={styles.sheetBody}>
          {BAR_SECTIONS.filter((s) => s.key !== 'today').map((s) => (
            <View key={s.key} style={styles.sheetGroup}>
              <Text style={styles.sheetSection}>{s.label.toUpperCase()}</Text>
              {s.destinations.map((d) => (
                <Pressable key={d.key} style={styles.sheetRow} onPress={() => props.onPick(d.key)}>
                  <Text style={styles.landingIcon}>{d.icon}</Text>
                  <View style={styles.sheetRowText}>
                    <Text style={styles.sheetRowTitle}>{d.label}</Text>
                    <Text style={styles.sheetRowBlurb}>{d.blurb}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          <Text style={styles.sheetFooter}>Grown in Milton, GA 🌱 · Go Duke 💙</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },

  // Centre the content column on wide screens instead of stretching chips to 1400px.
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flex: 1 },
  // A hairline of leaf green under the header: the garden hedge line.
  headerOuter: {
    width: '100%',
    backgroundColor: color.bg,
    borderBottomWidth: 2,
    borderBottomColor: color.successSoft,
  },

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

  subbar: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm },
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pillOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  pillText: { color: color.textMuted, fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: color.accent },

  body: { flex: 1, width: '100%' },

  landing: { padding: space.xl, gap: space.md },
  landingRow: {
    ...cardBase,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
  },
  landingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  landingIcon: { fontSize: 22 },
  landingText: { flex: 1, gap: 2 },
  landingTitle: { ...t.heading },
  landingBlurb: { ...t.detail },
  chevron: { color: color.textFaint, fontSize: 26, paddingLeft: space.md },

  tabbarOuter: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    paddingBottom: Platform.OS === 'web' ? space.xs : space.md,
  },
  tabbar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.xs,
  },
  tab: {
    flex: 1,
    minHeight: TOUCH + 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: space.xs,
  },
  // The active section sits on a pale Duke-blue pill: one glance at the bar
  // tells you where you are, and the pill is a bigger visual target than a dot.
  tabIconWrap: {
    minWidth: 52,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabIconWrapOn: { backgroundColor: color.accentSoft },
  tabIcon: { fontSize: 17 },
  tabText: { color: color.textFaint, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: color.accent, fontWeight: '700' },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(36, 31, 27, 0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.border,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.borderStrong,
    marginTop: space.md,
  },
  sheetBody: { padding: space.xl, gap: space.xl },
  sheetGroup: { gap: space.sm },
  sheetSection: { ...t.section, marginBottom: space.xs },
  sheetRow: {
    ...cardBase,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  sheetRowText: { flex: 1, gap: 2 },
  sheetRowTitle: { ...t.heading },
  sheetRowBlurb: { ...t.detail },
  sheetFooter: {
    ...t.meta,
    textAlign: 'center',
    paddingVertical: space.md,
  },
});
