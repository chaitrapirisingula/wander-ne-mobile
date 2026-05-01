import LoadingScreen from "@/components/LoadingScreen";
import { Colors } from "@/constants/theme";
import {
  type AgendaEvent,
  type CalendarCell,
  MONTH_NAMES,
  WEEKDAYS,
  buildMonthCells,
  chunkCells,
  dateKey,
  eventDayKey,
  formatDisplayDate,
  formatTimeDisplay,
  parseEventDateString,
} from "@/lib/eventsUtils";
import { normalizeSearchable } from "@/lib/searchUtils";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { get, onValue, ref } from "firebase/database";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { db } from "../../firebase";

interface Site {
  id: string;
  name: string;
  image?: string;
}

function buildSiteByNormalizedName(sites: Site[]): Map<string, Site> {
  const map = new Map<string, Site>();
  sites.forEach((s) => {
    const k = normalizeSearchable(s.name);
    if (k) map.set(k, s);
  });
  return map;
}

function EventThumb({
  siteRecord,
  variant,
}: {
  siteRecord: Site | null;
  variant: "timeline" | "calendar";
}) {
  const [failed, setFailed] = useState(false);
  const showRemote = Boolean(siteRecord?.image && !failed);

  return (
    <View
      style={[
        styles.eventThumbShell,
        variant === "timeline"
          ? styles.eventThumbShellTimeline
          : styles.eventThumbShellCalendar,
      ]}
    >
      <Image
        source={
          showRemote
            ? { uri: siteRecord!.image }
            : require("@/assets/images/wander-nebraska-logo.png")
        }
        style={styles.eventThumbImage}
        contentFit={showRemote ? "cover" : "contain"}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

function EventBlock({
  ev,
  siteRecord,
  hasSiteLink,
  onSitePress,
  variant,
}: {
  ev: AgendaEvent;
  siteRecord: Site | null;
  hasSiteLink: boolean;
  onSitePress: () => void;
  variant: "timeline" | "calendar";
}) {
  const timeStr = formatTimeDisplay(ev.time);
  const titleStyle =
    variant === "timeline" ? styles.eventTitleTimeline : styles.eventTitleCal;

  return (
    <View
      style={
        variant === "timeline"
          ? styles.eventBlockTimeline
          : styles.eventBlockCalendar
      }
    >
      <EventThumb siteRecord={siteRecord} variant={variant} />
      <View style={styles.eventBody}>
        <Text style={titleStyle}>{ev.name || "Event"}</Text>
        {ev.site ? (
          hasSiteLink ? (
            <TouchableOpacity onPress={onSitePress} activeOpacity={0.7}>
              <Text style={styles.eventSiteLink}>{ev.site}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.eventSitePlain}>{ev.site}</Text>
          )
        ) : null}
        {timeStr ? <Text style={styles.eventTime}>{timeStr}</Text> : null}
        {ev.description ? (
          <Text style={styles.eventDescription}>{ev.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [sites, setSites] = useState<Site[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "timeline">(
    "calendar",
  );
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const sitesRef = ref(db, "2026_sites");
    const unsub = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data as Record<string, unknown>).map(
          ([id, value]) => ({
            id,
            ...(value as object),
          }),
        ) as Site[];
        setSites(list);
      } else {
        setSites([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await get(ref(db, "2026_events"));
        if (cancelled) return;
        if (snapshot.exists()) {
          const list: AgendaEvent[] = [];
          snapshot.forEach((child) => {
            const val = child.val();
            if (val && typeof val === "object") {
              list.push({
                ...(val as AgendaEvent),
                id: child.key ?? "",
              });
            }
          });
          list.sort((a, b) => {
            const da = parseEventDateString(a.date);
            const db = parseEventDateString(b.date);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return da.getTime() - db.getTime();
          });
          setEvents(list);
        } else {
          setEvents([]);
        }
        setFetchError(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const siteByNormalizedName = useMemo(
    () => buildSiteByNormalizedName(sites),
    [sites],
  );

  const getSite = useCallback(
    (siteName: string | undefined): Site | null => {
      if (!siteName) return null;
      return siteByNormalizedName.get(normalizeSearchable(siteName)) ?? null;
    },
    [siteByNormalizedName],
  );

  const goToSite = useCallback(
    (siteName: string | undefined) => {
      const site = getSite(siteName);
      if (!site) return;
      router.push(`/site/${site.id}`);
    },
    [getSite, router],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    events.forEach((ev) => {
      const d = parseEventDateString(ev.date);
      if (!d) return;
      const k = dateKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    });
    return map;
  }, [events]);

  const timelineEvents = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return events.filter((ev) => {
      const d = parseEventDateString(ev.date);
      if (!d) return false;
      return d >= startOfToday;
    });
  }, [events]);

  const calendarCells = useMemo(
    () => buildMonthCells(calView.year, calView.month),
    [calView.year, calView.month],
  );

  const calendarRows = useMemo(
    () => chunkCells(calendarCells, 7),
    [calendarCells],
  );

  const today = new Date();
  const todayKey = dateKey(today);

  const selectedEvents =
    selectedKey && eventsByDay.has(selectedKey)
      ? eventsByDay.get(selectedKey)!
      : [];

  const goPrevMonth = () => {
    setCalView((v) => {
      let m = v.month - 1;
      let y = v.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      return { year: y, month: m };
    });
    setSelectedKey(null);
  };

  const goNextMonth = () => {
    setCalView((v) => {
      let m = v.month + 1;
      let y = v.year;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
    setSelectedKey(null);
  };

  const setMode = (next: "calendar" | "timeline") => {
    setViewMode(next);
    if (next === "timeline") setSelectedKey(null);
  };

  const fontScaleEvents = PixelRatio.getFontScale();
  const tabBarReserve =
    52 +
    (fontScaleEvents > 1
      ? Math.min(14, Math.round((fontScaleEvents - 1) * 12))
      : 0);
  const scrollBottomPad = 28 + insets.bottom + tabBarReserve;

  const modalBodyMaxHeight = Math.max(
    280,
    Math.round(windowHeight * 0.72 - 150),
  );

  const selectedDayLabel = useMemo(() => {
    const first = selectedEvents[0];
    const d = first ? parseEventDateString(first.date) : null;
    return d ? formatDisplayDate(d) : "";
  }, [selectedEvents]);

  if (loading) {
    return <LoadingScreen message="Loading events…" />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>
              2026 Events
            </Text>
          </View>
          <View style={styles.headerLogoWrap}>
            <Image
              source={require("@/assets/images/wander-nebraska-logo.png")}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </View>
        </View>

        {!fetchError && events.length > 0 ? (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === "calendar" && styles.modeBtnActive,
              ]}
              onPress={() => setMode("calendar")}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  viewMode === "calendar" && styles.modeBtnTextActive,
                ]}
              >
                Calendar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === "timeline" && styles.modeBtnActive,
              ]}
              onPress={() => setMode("timeline")}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  viewMode === "timeline" && styles.modeBtnTextActive,
                ]}
              >
                Timeline
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {fetchError ? (
          <Text style={styles.errorCenter}>
            Could not load events. Please try again later.
          </Text>
        ) : (
          <>
            {viewMode === "timeline" &&
              events.length > 0 &&
              timelineEvents.length > 0 && (
                <View style={styles.timelineOuter}>
                  <View style={styles.timelineLine} />
                  {timelineEvents.map((ev, idx) => {
                    const d = parseEventDateString(ev.date);
                    const siteRecord = getSite(ev.site);
                    const hasLink = Boolean(siteRecord);
                    const prev = idx > 0 ? timelineEvents[idx - 1] : null;
                    const showDateHeader =
                      idx === 0 || eventDayKey(ev) !== eventDayKey(prev!);

                    return (
                      <View
                        key={ev.id}
                        style={[
                          styles.timelineItem,
                          showDateHeader &&
                            idx > 0 &&
                            styles.timelineItemDayBreak,
                        ]}
                      >
                        {showDateHeader ? (
                          <View style={styles.timelineDateHeaderPill}>
                            <Text style={styles.timelineDateHeader}>
                              {d
                                ? formatDisplayDate(d)
                                : `Date: ${ev.date || "TBA"}`}
                            </Text>
                          </View>
                        ) : null}
                        <EventBlock
                          ev={ev}
                          siteRecord={siteRecord}
                          hasSiteLink={hasLink}
                          onSitePress={() => goToSite(ev.site)}
                          variant="timeline"
                        />
                      </View>
                    );
                  })}
                </View>
              )}

            {viewMode === "timeline" &&
              events.length > 0 &&
              timelineEvents.length === 0 && (
                <Text style={styles.mutedCenter}>
                  No upcoming events on the timeline. Past events stay on the
                  calendar.
                </Text>
              )}

            {viewMode === "calendar" && (
              <View style={styles.calendarWrap}>
                <View style={styles.calendarCard}>
                  <View style={styles.calHeader}>
                    <TouchableOpacity
                      onPress={goPrevMonth}
                      style={styles.calNavBtn}
                      accessibilityLabel="Previous month"
                    >
                      <Text style={styles.calNavBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.calMonthTitle}>
                      {MONTH_NAMES[calView.month]} {calView.year}
                    </Text>
                    <TouchableOpacity
                      onPress={goNextMonth}
                      style={styles.calNavBtn}
                      accessibilityLabel="Next month"
                    >
                      <Text style={styles.calNavBtnText}>→</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((w) => (
                      <View key={w} style={styles.weekdayCell}>
                        <Text style={styles.weekdayText}>{w}</Text>
                      </View>
                    ))}
                  </View>

                  {calendarRows.map((row, ri) => (
                    <View key={`row-${ri}`} style={styles.calRow}>
                      {row.map((cell) => (
                        <CalendarDayCell
                          key={cell.key}
                          cell={cell}
                          eventsByDay={eventsByDay}
                          todayKey={todayKey}
                          selectedKey={selectedKey}
                          setSelectedKey={setSelectedKey}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {events.length === 0 && !fetchError ? (
              <Text style={styles.mutedCenter}>
                No events are listed yet. Check back soon.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedKey && selectedEvents.length > 0)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedKey(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedKey(null)}
          />
          <View
            style={[styles.modalCard, { paddingBottom: 8 + insets.bottom }]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalBackBtn}
                onPress={() => setSelectedKey(null)}
              >
                <Text style={styles.modalBackBtnText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedDayLabel}</Text>
            </View>
            <ScrollView
              style={[styles.modalScroll, { maxHeight: modalBodyMaxHeight }]}
              contentContainerStyle={styles.modalScrollContent}
            >
              {selectedEvents.map((ev, i) => {
                const siteRecord = getSite(ev.site);
                const hasLink = Boolean(siteRecord);
                return (
                  <View
                    key={ev.id}
                    style={[
                      styles.modalEventWrap,
                      i < selectedEvents.length - 1 && styles.modalEventBorder,
                    ]}
                  >
                    <EventBlock
                      ev={ev}
                      siteRecord={siteRecord}
                      hasSiteLink={hasLink}
                      onSitePress={() => goToSite(ev.site)}
                      variant="calendar"
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CalendarDayCell({
  cell,
  eventsByDay,
  todayKey,
  selectedKey,
  setSelectedKey,
}: {
  cell: CalendarCell;
  eventsByDay: Map<string, AgendaEvent[]>;
  todayKey: string;
  selectedKey: string | null;
  setSelectedKey: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const dayCellMinHeight = Math.max(
    72,
    Math.round(64 * PixelRatio.getFontScale()),
  );

  if (cell.type === "pad") {
    return (
      <View
        style={[
          styles.dayCell,
          styles.dayCellPad,
          { minHeight: dayCellMinHeight },
        ]}
      />
    );
  }

  const k = dateKey(cell.date);
  const dayEvents = eventsByDay.get(k) || [];
  const hasEvents = dayEvents.length > 0;
  const isToday = k === todayKey;
  const isSelected = selectedKey === k;

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        { minHeight: dayCellMinHeight },
        hasEvents ? styles.dayCellHasEvents : styles.dayCellEmpty,
        isToday && styles.dayCellToday,
        isSelected && styles.dayCellSelected,
      ]}
      disabled={!hasEvents}
      onPress={() =>
        setSelectedKey(isSelected ? null : k)
      }
      activeOpacity={hasEvents ? 0.7 : 1}
      accessibilityLabel={
        hasEvents
          ? `${cell.date.getDate()}, ${dayEvents.length} event(s)`
          : undefined
      }
    >
      <Text
        style={[styles.dayNum, isToday && styles.dayNumToday]}
        numberOfLines={1}
      >
        {cell.date.getDate()}
      </Text>
      {hasEvents ? (
        <Text style={styles.dayEventHint} numberOfLines={2}>
          {dayEvents.length === 1
            ? dayEvents[0].name || "Event"
            : `${dayEvents.length} events`}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLogoWrap: { flexShrink: 0 },
  headerLogo: { width: 72, height: 72 },
  titleWrap: { flex: 1, marginRight: 12, minWidth: 0 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
  },
  modeToggle: {
    flexDirection: "row",
    alignSelf: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary,
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  errorCenter: {
    textAlign: "center",
    color: "#B91C1C",
    fontSize: 16,
    marginTop: 12,
  },
  mutedCenter: {
    textAlign: "center",
    color: "#4B5563",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  timelineOuter: {
    position: "relative",
    paddingLeft: 8,
    marginBottom: 16,
  },
  timelineLine: {
    position: "absolute",
    left: 18,
    top: 12,
    bottom: 24,
    width: 2,
    backgroundColor: "#BFDBFE",
    borderRadius: 1,
  },
  timelineItem: {
    paddingLeft: 36,
    paddingBottom: 26,
    position: "relative",
  },
  timelineItemDayBreak: {
    marginTop: 8,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: "#CBD5E1",
  },
  timelineDateHeaderPill: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  timelineDateHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E3A8A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  eventBlockTimeline: {
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "rgba(249, 250, 251, 0.95)",
  },
  eventBlockCalendar: {
    flexDirection: "column",
    gap: 10,
  },
  eventThumbShell: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  eventThumbShellTimeline: {
    aspectRatio: 4 / 3,
    maxHeight: 200,
  },
  eventThumbShellCalendar: {
    aspectRatio: 4 / 3,
    maxHeight: 160,
  },
  eventThumbImage: {
    width: "100%",
    height: "100%",
  },
  eventBody: { flex: 1, minWidth: 0 },
  eventTitleTimeline: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E40AF",
  },
  eventTitleCal: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  eventSiteLink: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary,
  },
  eventSitePlain: {
    marginTop: 6,
    fontSize: 15,
    color: Colors.primary,
  },
  eventTime: {
    marginTop: 6,
    fontSize: 14,
    color: "#4B5563",
  },
  eventDescription: {
    marginTop: 10,
    fontSize: 14,
    color: "#374151",
    lineHeight: 21,
  },
  calendarWrap: { marginBottom: 16 },
  calendarCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    backgroundColor: Colors.white,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calNavBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "700",
  },
  calMonthTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  weekdayRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#EFF6FF",
  },
  weekdayCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E40AF",
  },
  calRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  dayCell: {
    flex: 1,
    padding: 4,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  dayCellPad: {
    backgroundColor: "#F9FAFB",
  },
  dayCellEmpty: {
    backgroundColor: Colors.white,
  },
  dayCellHasEvents: {
    backgroundColor: "#FFFBEB",
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: "#60A5FA",
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  dayNumToday: {
    color: Colors.primary,
  },
  dayEventHint: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "600",
    color: "#78350F",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: Colors.primary,
  },
  modalBackBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  modalBackBtnText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  modalScroll: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalEventWrap: { paddingBottom: 16 },
  modalEventBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 16,
  },
});
