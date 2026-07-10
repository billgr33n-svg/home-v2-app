import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { fetchEventsInRange, type EventView } from '../api/events';
import {
  addDays,
  dateKey,
  groupByDay,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  timeLabel,
  timeRangeLabel,
} from '../domain/calendar';
import { cardBase, color, CONTENT_MAX_WIDTH, radius, shadow, space, TOUCH, type as t } from '../theme';

/**
 * The family calendar, as a ladder: Month shows the shape of the month and a
 * dot per event; tapping a day opens that day's list; tapping an event opens
 * the full detail (time, place, notes). Week trades breadth for detail — seven
 * stacked day rows with every event titled and timed. Stacked rows, not seven
 * columns: a 390px phone gives a column 46px, which fits a dot but not a life.
 */
type Mode = 'week' | 'month';

function useEventsRange(householdId: string, from: Date, to: Date) {
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  return useQuery({
    queryKey: ['events-range', householdId, fromKey, toKey],
    queryFn: () => fetchEventsInRange(householdId, from.toISOString(), to.toISOString(), fromKey, toKey),
    enabled: Boolean(householdId),
  });
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekTitle(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const a = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const b =
    weekStart.getMonth() === end.getMonth()
      ? end.toLocaleDateString(undefined, { day: 'numeric' })
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

function dayTitle(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function HouseCalendar(props: {
  householdId: string;
  initialMode?: Mode;
  /** When a parent owns the week/month switch (EventsScreen), hide ours. */
  hideModeToggle?: boolean;
}) {
  const today = dateKey(new Date());
  const [mode, setMode] = useState<Mode>(props.initialMode ?? 'week');
  // One anchor drives both views: the week containing it, or the month containing it.
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const [openEvent, setOpenEvent] = useState<EventView | null>(null);

  const weekStart = startOfWeek(anchor);
  const monthStart = startOfMonth(anchor);
  const gridDays = useMemo(() => monthGridDays(monthStart), [monthStart.getTime()]);

  const from = mode === 'week' ? weekStart : gridDays[0];
  const to = mode === 'week' ? addDays(weekStart, 7) : addDays(gridDays[0], 42);
  const q = useEventsRange(props.householdId, from, to);
  const byDay = useMemo(() => groupByDay(q.data ?? []), [q.data]);

  const step = (dir: -1 | 1) => {
    if (mode === 'week') setAnchor(addDays(weekStart, dir * 7));
    else setAnchor(new Date(monthStart.getFullYear(), monthStart.getMonth() + dir, 1));
  };
  const jumpToday = () => {
    setAnchor(new Date());
    setSelectedDay(today);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        {props.hideModeToggle ? <View /> : (
        <View style={styles.segment}>
          {(['week', 'month'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.segmentBtn, mode === m && styles.segmentOn]}
              onPress={() => setMode(m)}
              accessibilityRole="button"
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                {m === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>
        )}
        <Pressable onPress={jumpToday} style={styles.todayBtn}>
          <Text style={styles.todayBtnText}>Today</Text>
        </Pressable>
      </View>

      <View style={styles.nav}>
        <Pressable onPress={() => step(-1)} style={styles.navBtn} accessibilityLabel="Previous">
          <Text style={styles.navGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>{mode === 'week' ? weekTitle(weekStart) : monthTitle(monthStart)}</Text>
        <Pressable onPress={() => step(1)} style={styles.navBtn} accessibilityLabel="Next">
          <Text style={styles.navGlyph}>›</Text>
        </Pressable>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={color.accent} style={{ marginTop: space.xxl }} />
      ) : q.isError ? (
        <Text style={styles.loadError}>Couldn't load the calendar. Pull down or try again.</Text>
      ) : mode === 'week' ? (
        <WeekView weekStart={weekStart} byDay={byDay} today={today} onOpen={setOpenEvent} />
      ) : (
        <MonthView
          gridDays={gridDays}
          monthStart={monthStart}
          byDay={byDay}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onOpen={setOpenEvent}
        />
      )}

      <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </View>
  );
}

function WeekView(props: {
  weekStart: Date;
  byDay: Map<string, EventView[]>;
  today: string;
  onOpen: (e: EventView) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.weekList}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(props.weekStart, i);
        const key = dateKey(d);
        const events = props.byDay.get(key) ?? [];
        const isToday = key === props.today;
        return (
          <View key={key} style={[styles.dayRow, isToday && styles.dayRowToday]}>
            <View style={styles.dayCol}>
              <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{WEEKDAYS[d.getDay()]}</Text>
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
            </View>
            <View style={styles.dayEvents}>
              {events.length === 0 ? (
                <Text style={styles.dayEmpty}>Nothing planned</Text>
              ) : (
                events.map((e) => (
                  <Pressable key={e.id} style={styles.eventChip} onPress={() => props.onOpen(e)}>
                    <Text style={styles.eventTime}>{e.allDay ? 'All day' : timeLabel(e.startsAt)}</Text>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    {e.location ? (
                      <Text style={styles.eventWhere} numberOfLines={1}>
                        📍 {e.location}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function MonthView(props: {
  gridDays: Date[];
  monthStart: Date;
  byDay: Map<string, EventView[]>;
  today: string;
  selectedDay: string | null;
  onSelectDay: (k: string) => void;
  onOpen: (e: EventView) => void;
}) {
  const month = props.monthStart.getMonth();
  const selectedEvents = props.selectedDay ? (props.byDay.get(props.selectedDay) ?? []) : [];
  return (
    <ScrollView contentContainerStyle={styles.monthWrap}>
      <View style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.gridHead}>
            {w[0]}
          </Text>
        ))}
        {props.gridDays.map((d) => {
          const key = dateKey(d);
          const events = props.byDay.get(key) ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = key === props.today;
          const selected = key === props.selectedDay;
          return (
            <Pressable
              key={key}
              style={[styles.cell, selected && styles.cellSelected]}
              onPress={() => props.onSelectDay(key)}
            >
              <View style={[styles.cellNumWrap, isToday && styles.cellNumToday]}>
                <Text
                  style={[
                    styles.cellNum,
                    !inMonth && styles.cellNumOut,
                    isToday && styles.cellNumTodayText,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.dots}>
                {events.slice(0, 3).map((e) => (
                  <View key={e.id} style={styles.eventDot} />
                ))}
                {events.length > 3 ? <Text style={styles.dotMore}>+</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {props.selectedDay ? (
        <View style={styles.dayPanel}>
          <Text style={styles.dayPanelTitle}>{dayTitle(props.selectedDay)}</Text>
          {selectedEvents.length === 0 ? (
            <Text style={styles.dayEmpty}>Nothing planned</Text>
          ) : (
            selectedEvents.map((e) => (
              <Pressable key={e.id} style={styles.eventChip} onPress={() => props.onOpen(e)}>
                <Text style={styles.eventTime}>{e.allDay ? 'All day' : timeRangeLabel(e)}</Text>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {e.title}
                </Text>
                {e.location ? (
                  <Text style={styles.eventWhere} numberOfLines={1}>
                    📍 {e.location}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

export function EventDetailModal(props: { event: EventView | null; onClose: () => void }) {
  const e = props.event;
  return (
    <Modal visible={e !== null} animationType="slide" transparent onRequestClose={props.onClose}>
      <Pressable style={styles.scrim} onPress={props.onClose} accessibilityLabel="Close" />
      {e ? (
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.detailKicker}>
              {dayTitle(e.allDay ? e.startsAt : dateKey(new Date(e.startsAt))).toUpperCase()}
            </Text>
            <Text style={styles.detailTitle}>{e.title}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>🕐</Text>
              <Text style={styles.detailText}>{timeRangeLabel(e)}</Text>
            </View>
            {e.location ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📍</Text>
                <Text style={styles.detailText}>{e.location}</Text>
              </View>
            ) : null}
            {e.description ? (
              <View style={styles.detailNotes}>
                <Text style={styles.detailNotesLabel}>NOTES</Text>
                <Text style={styles.detailText}>{e.description}</Text>
              </View>
            ) : null}
            <Pressable style={styles.closeBtn} onPress={props.onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

/**
 * The Today screen's doorway into the calendar: a compact card with Week and
 * Month buttons that open the full calendar as a sheet. A card, not a tab —
 * Today stays the reflex screen, and the calendar is one tap away.
 */
export function CalendarCard(props: { householdId: string }) {
  const [open, setOpen] = useState<Mode | null>(null);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardKicker}>CALENDAR</Text>
        <Text style={styles.cardTitle}>What's coming up</Text>
      </View>
      <View style={styles.cardBtns}>
        <Pressable style={styles.cardBtn} onPress={() => setOpen('week')}>
          <Text style={styles.cardBtnText}>📅 Week</Text>
        </Pressable>
        <Pressable style={styles.cardBtn} onPress={() => setOpen('month')}>
          <Text style={styles.cardBtnText}>🗓️ Month</Text>
        </Pressable>
      </View>

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={styles.fullSheet}>
          <View style={styles.fullHead}>
            <Text style={styles.fullTitle}>Calendar</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={12} style={styles.fullClose}>
              <Text style={styles.fullCloseText}>Done</Text>
            </Pressable>
          </View>
          {open ? <HouseCalendar householdId={props.householdId} initialMode={open} /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentBtn: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  segmentOn: { backgroundColor: color.accent },
  segmentText: { color: color.textMuted, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: color.accentInk },
  todayBtn: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.md },
  todayBtnText: { color: color.accent, fontSize: 14, fontWeight: '600' },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.xs,
  },
  navBtn: { minWidth: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navGlyph: { color: color.accent, fontSize: 28, fontWeight: '600', marginTop: -2 },
  navTitle: { ...t.heading, fontSize: 18 },

  weekList: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  dayRow: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    ...shadow.card,
  },
  dayRowToday: { borderColor: color.success, borderWidth: 2, backgroundColor: '#FDFEFB' },
  dayCol: { width: 44, alignItems: 'center', gap: 1 },
  dayName: { ...t.meta, fontWeight: '700' },
  dayNameToday: { color: color.success },
  dayNum: { fontSize: 20, fontWeight: '700', color: color.textMuted },
  dayNumToday: { color: color.success },
  dayEvents: { flex: 1, gap: space.sm, justifyContent: 'center' },
  dayEmpty: { ...t.detail, color: color.textFaint, paddingVertical: space.sm },

  eventChip: {
    minHeight: TOUCH,
    justifyContent: 'center',
    backgroundColor: color.accentSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 1,
  },
  eventTime: { color: color.accent, fontSize: 12, fontWeight: '700' },
  eventTitle: { color: color.text, fontSize: 15, fontWeight: '600' },
  eventWhere: { ...t.detail },

  monthWrap: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.sm,
    ...shadow.card,
  },
  gridHead: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...t.meta,
    fontWeight: '700',
    color: color.success,
    paddingVertical: space.xs,
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 52,
    alignItems: 'center',
    paddingTop: 4,
    borderRadius: radius.sm,
    gap: 2,
  },
  cellSelected: { backgroundColor: color.accentSoft },
  cellNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumToday: { backgroundColor: color.success },
  cellNum: { fontSize: 14, fontWeight: '600', color: color.text },
  cellNumOut: { color: color.textFaint, fontWeight: '400' },
  cellNumTodayText: { color: '#FFFFFF' },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center', minHeight: 8 },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.accent },
  dotMore: { color: color.accent, fontSize: 10, fontWeight: '700', marginTop: -2 },

  loadError: { ...t.detail, color: color.danger, textAlign: 'center', marginTop: space.xxl },
  dayPanel: { gap: space.sm },
  dayPanelTitle: { ...t.heading },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30, 42, 30, 0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
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
  sheetBody: { padding: space.xl, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  detailKicker: { ...t.kicker },
  detailTitle: { ...t.title, fontSize: 22 },
  detailRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  detailIcon: { fontSize: 15, marginTop: 1 },
  detailText: { ...t.body, flex: 1, fontSize: 15 },
  detailNotes: { gap: space.xs, marginTop: space.xs },
  detailNotesLabel: { ...t.section },
  closeBtn: {
    marginTop: space.md,
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: color.accentInk, fontSize: 15, fontWeight: '700' },

  card: { ...cardBase, gap: space.md },
  cardHead: { gap: 2 },
  cardKicker: { ...t.section },
  cardTitle: { ...t.heading },
  cardBtns: { flexDirection: 'row', gap: space.sm },
  cardBtn: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnText: { color: color.accent, fontSize: 15, fontWeight: '700' },

  fullSheet: { flex: 1, backgroundColor: color.bg },
  fullHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  fullTitle: { ...t.title },
  fullClose: { minHeight: TOUCH, justifyContent: 'center' },
  fullCloseText: { color: color.accent, fontSize: 16, fontWeight: '700' },
});
