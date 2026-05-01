import LoadingScreen from "@/components/LoadingScreen";
import { Colors } from "@/constants/theme";
import { normalizeSearchable } from "@/lib/searchUtils";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { db } from "../../firebase";

const GUIDED_TOUR_DETAILS_URL =
  "https://outdoornebraska.gov/about/press-events/events/your-parks-adventure/";

const CARD_BORDER = "#E8E8E8";
const NOTE_AMBER = "#92400E";

interface Site {
  id: string;
  name: string;
  image?: string;
}

interface SharedEvent {
  id: string;
  title: string;
  locationLabel: string;
  cityLabel: string;
  date: string;
  siteNameForLink?: string;
  address?: string;
  note?: string;
}

const SHARED_EVENTS: SharedEvent[] = [
  {
    id: "walk-to-the-rock",
    title: "Chimney Rock: Walk to the Rock Trails",
    locationLabel: "Trails at Chimney Rock (Trailhead A at Patio)",
    cityLabel: "Bayard",
    date: "May 23, 2026",
    siteNameForLink: "Chimney Rock: Walk to the Rock Trails",
  },
  {
    id: "rock-creek-station",
    title: "Rock Creek Station State Historical Park",
    locationLabel: "Rock Creek Station State Historical Park",
    cityLabel: "Fairbury",
    date: "June 6, 2026",
    siteNameForLink: "Rock Creek Station State Historical Park",
  },
  {
    id: "alkali-station",
    title: "Alkali Station",
    locationLabel: "Alkali Station",
    cityLabel: "Ogallala",
    date: "June 13, 2026",
    address: "1171 E 80th Rd, Ogallala",
    note: "Does not have a WanderNebraska listing.",
  },
  {
    id: "l-c-visitor-center",
    title: "Missouri River Basin Lewis & Clark Trail Visitor Center",
    locationLabel: "Missouri River Basin Lewis & Clark Trail Visitor Center",
    cityLabel: "Nebraska City",
    date: "July 11, 2026",
    siteNameForLink:
      "Missouri River Basin Lewis & Clark Trail Visitor Center",
  },
  {
    id: "buffalo-bill-ranch",
    title: "Buffalo Bill Ranch State Historical Park",
    locationLabel: "Buffalo Bill Ranch State Historical Park",
    cityLabel: "North Platte",
    date: "July 11, 2026",
    siteNameForLink: "Buffalo Bill Ranch State Historical Park",
  },
  {
    id: "engineer-cantonment",
    title: "Engineer Cantonment Site",
    locationLabel: "Engineer Cantonment Site",
    cityLabel: "Omaha",
    date: "September 12, 2026",
    address: "County Road P51 and Bluebird Lane, Omaha",
    note: "Does not have a WanderNebraska listing.",
  },
];

function findSiteByName(sites: Site[], name: string): Site | null {
  const target = normalizeSearchable(name);
  if (!target) return null;
  return (
    sites.find((s) => normalizeSearchable(s?.name) === target) ?? null
  );
}

function SiteThumb({ site }: { site: Site | null }) {
  const [failed, setFailed] = useState(false);
  const showRemote = Boolean(site?.image && !failed);

  return (
    <Image
      source={
        showRemote
          ? { uri: site!.image }
          : require("@/assets/images/wander-nebraska-logo.png")
      }
      style={styles.thumbImage}
      contentFit={showRemote ? "cover" : "contain"}
      onError={() => setFailed(true)}
    />
  );
}

export default function SharedEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sitesRef = ref(db, "2026_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as Record<string, unknown>).map(
          ([id, value]) => ({
            id,
            ...(value as object),
          }),
        ) as Site[];
        setSites(sitesArray);
      } else {
        setSites([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const cards = useMemo(() => {
    return SHARED_EVENTS.map((ev) => {
      const site = ev.siteNameForLink
        ? findSiteByName(sites, ev.siteNameForLink)
        : null;
      return { ev, site };
    });
  }, [sites]);

  const openGuidedTourDetails = () => {
    Linking.openURL(GUIDED_TOUR_DETAILS_URL).catch(() => {});
  };

  if (loading) {
    return <LoadingScreen message="Loading shared events..." />;
  }

  const fs = PixelRatio.getFontScale();
  const tabBarReserve =
    52 + (fs > 1 ? Math.min(14, Math.round((fs - 1) * 12)) : 0);
  const scrollBottomPad = 28 + insets.bottom + tabBarReserve;

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
              Trail Trek Tours
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

        <Text style={styles.intro}>
          Join us at these highlighted shared events and tours across Nebraska.
        </Text>

        {cards.map(({ ev, site }) => (
          <View key={ev.id} style={styles.card}>
            <View style={styles.cardImageWrap}>
              <SiteThumb site={site} />
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{ev.date}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{ev.title}</Text>
              <Text style={styles.cardLine}>
                <Text style={styles.cardLabel}>Location:</Text>{" "}
                {ev.locationLabel}
              </Text>
              {ev.address ? (
                <Text style={styles.cardLine}>
                  <Text style={styles.cardLabel}>Address:</Text> {ev.address}
                </Text>
              ) : null}
              <Text style={styles.cardLineMuted}>
                <Text style={styles.cardLabel}>City:</Text> {ev.cityLabel}
              </Text>
              {ev.note ? <Text style={styles.note}>{ev.note}</Text> : null}

              <View style={styles.actions}>
                {site ? (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/site/${site.id}`)}
                  >
                    <Text style={styles.primaryBtnText}>View listing</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noListingBtn}>
                    <Text style={styles.noListingText}>No listing</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.outlineBtn}
                  activeOpacity={0.85}
                  onPress={openGuidedTourDetails}
                >
                  <Text style={styles.outlineBtnText}>
                    View Guided Tour Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
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
    marginBottom: 12,
  },
  headerLogoWrap: {
    flexShrink: 0,
  },
  headerLogo: {
    width: 72,
    height: 72,
  },
  titleWrap: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
  },
  intro: {
    fontSize: 15,
    color: "#374151",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
    maxWidth: 560,
    alignSelf: "center",
  },
  card: {
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: Colors.white,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cardImageWrap: {
    height: 176,
    width: "100%",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 71, 171, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.white,
  },
  cardBody: {
    padding: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    lineHeight: 24,
  },
  cardLine: {
    marginTop: 10,
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  cardLineMuted: {
    marginTop: 6,
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  cardLabel: {
    fontWeight: "600",
    color: "#111827",
  },
  note: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: NOTE_AMBER,
    lineHeight: 20,
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  noListingBtn: {
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    alignItems: "center",
  },
  noListingText: {
    color: "#4B5563",
    fontSize: 16,
    fontWeight: "600",
  },
  outlineBtn: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "bold",
  },
});
