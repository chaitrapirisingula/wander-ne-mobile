import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import LoadingScreen from "@/components/LoadingScreen";
import { Colors } from "@/constants/theme";
import { formatFeatureLabel } from "@/lib/featureDisplay";
import { isSpecial50Site } from "@/lib/special50";

import { db } from "../../firebase";

interface Site {
  id: string;
  name: string;
  city?: string;
  state?: string;
  image?: string;
  features?: string;
  special50?: boolean;
  [key: string]: any;
}

interface Sponsor {
  id: string;
  city?: string;
  link?: string;
}

function pickFirstString(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** RTDB may use city/link or City/Link (or url). */
function sponsorCityFromRecord(r: Record<string, unknown>): string | undefined {
  return pickFirstString(r, ["city", "City", "cityName", "location"]);
}

function sponsorLinkFromRecord(r: Record<string, unknown>): string | undefined {
  return pickFirstString(r, ["link", "Link", "url", "URL", "website", "href"]);
}

/** "Lincoln, NE" → "lincoln" so city and chamber matching behave like a city search. */
function primarySearchToken(searchQuery: string): string {
  const t = searchQuery.trim().toLowerCase();
  if (!t) return "";
  return t.split(",")[0]?.trim() ?? t;
}

function normalizeChamberUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Exact labels from site data (case-insensitive keys). */
const FEATURE_ICON_EXACT: Record<
  string,
  keyof typeof MaterialIcons.glyphMap
> = {
  "large group friendly": "groups",
  "native american centric": "diversity-3",
  "pet-friendly": "pets",
  "pet friendly": "pets",
  "picnic area": "outdoor-grill",
  "restaurants near by": "local-dining",
  "restaurants nearby": "local-dining",
};

// Feature icon mapping — check specific phrases before generic substrings (e.g. parking before park).
const getFeatureIcon = (
  feature: string
): keyof typeof MaterialIcons.glyphMap => {
  const normalized = feature.toLowerCase().trim();
  const exact = FEATURE_ICON_EXACT[normalized];
  if (exact) return exact;

  if (
    normalized.includes("native american") ||
    normalized.includes("indigenous")
  )
    return "diversity-3";
  if (normalized.includes("large group") || normalized.includes("group friendly"))
    return "groups";
  if (normalized.includes("pet-friendly") || normalized.includes("pet friendly"))
    return "pets";
  if (normalized.includes("picnic")) return "outdoor-grill";
  if (
    normalized.includes("restaurant") ||
    normalized.includes("dining near") ||
    normalized.includes("eateries near")
  )
    return "local-dining";

  if (normalized.includes("library") || normalized.includes("book"))
    return "menu-book";
  if (normalized.includes("wheelchair") || normalized.includes("accessible"))
    return "accessible";
  if (normalized.includes("wifi") || normalized.includes("wi-fi")) return "wifi";
  if (normalized.includes("parking")) return "local-parking";
  if (normalized.includes("restroom") || normalized.includes("rest room"))
    return "wc";
  if (normalized.includes("cafe") || normalized.includes("coffee"))
    return "local-cafe";
  if (normalized.includes("gift") || normalized.includes("shop"))
    return "card-giftcard";
  if (normalized.includes("museum")) return "museum";
  if (normalized.includes("playground")) return "child-care";
  if (normalized.includes("park")) return "park";

  return "place";
};

// Parse features string into array
const parseFeatures = (features?: string): string[] => {
  if (!features) return [];
  return features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
};

/** Match filter-chip order (same as `allFeatures`: sorted union of all site labels). */
const orderFeaturesLikeFilters = (
  parsed: string[],
  canonicalSorted: string[]
): string[] => {
  const indexByLower = new Map(
    canonicalSorted.map((label, i) => [label.toLowerCase(), i])
  );
  return [...parsed].sort((a, b) => {
    const ia = indexByLower.get(a.toLowerCase());
    const ib = indexByLower.get(b.toLowerCase());
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  });
};

export default function SitesScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set()
  );
  const [filterSpecial50, setFilterSpecial50] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Get all unique features from all sites
  const allFeatures = useMemo(() => {
    const featureSet = new Set<string>();
    sites.forEach((site) => {
      parseFeatures(site.features).forEach((feature) => {
        featureSet.add(feature);
      });
    });
    return Array.from(featureSet).sort();
  }, [sites]);

  useEffect(() => {
    const sitesRef = ref(db, "2026_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as any).map(
          ([id, value]: any) => ({
            id,
            ...(value as object),
          })
        ) as Site[];
        setSites(sitesArray);
      } else {
        setSites([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sponsorsRef = ref(db, "2026_sponsors");
    const unsubscribe = onValue(sponsorsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data as Record<string, unknown>).map(
          ([id, value]) => {
            const rest =
              typeof value === "object" && value !== null
                ? (value as Record<string, unknown>)
                : {};
            return { id, ...rest } as Sponsor;
          }
        );
        setSponsors(list);
      } else {
        setSponsors([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const matchingSponsors = useMemo(() => {
    const q = primarySearchToken(searchQuery);
    if (!q) return [];
    const matched = sponsors.filter((s) => {
      const rec = s as Record<string, unknown>;
      const city = sponsorCityFromRecord(rec);
      const link = sponsorLinkFromRecord(rec);
      if (!city || !link) return false;
      const cl = city.toLowerCase();
      return cl.includes(q) || (q.length >= 2 && q.includes(cl));
    });
    return [...matched].sort((a, b) =>
      (sponsorCityFromRecord(a as Record<string, unknown>) ?? "").localeCompare(
        sponsorCityFromRecord(b as Record<string, unknown>) ?? "",
        undefined,
        { sensitivity: "base", numeric: true }
      )
    );
  }, [sponsors, searchQuery]);

  const openChamberWebsite = (link: string) => {
    const url = normalizeChamberUrl(link);
    if (!url) return;
    Alert.alert("Open website?", `Open this chamber website?\n\n${url}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open",
        onPress: () => {
          Linking.openURL(url).catch(() => {
            Alert.alert("Error", "Could not open the link.");
          });
        },
      },
    ]);
  };

  const filteredSites = useMemo(() => {
    let filtered = sites;

    // Filter by search query (same city token as chamber banner, e.g. before comma)
    const query = primarySearchToken(searchQuery);
    if (query) {
      filtered = filtered.filter((site) => {
        const valuesToSearch = [site.name, site.city]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return valuesToSearch.some((value) => value.includes(query));
      });
    }

    // Filter by special50 (DB may store boolean, string "true", or 1)
    if (filterSpecial50) {
      filtered = filtered.filter((site) => isSpecial50Site(site.special50));
    }

    // Filter by selected features
    if (selectedFeatures.size > 0) {
      filtered = filtered.filter((site) => {
        const siteFeatures = parseFeatures(site.features);
        return Array.from(selectedFeatures).every((selectedFeature) =>
          siteFeatures.some(
            (siteFeature) =>
              siteFeature.toLowerCase() === selectedFeature.toLowerCase()
          )
        );
      });
    }

    return [...filtered].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [searchQuery, selectedFeatures, filterSpecial50, sites]);

  const toggleFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) {
      newSelected.delete(feature);
    } else {
      newSelected.add(feature);
    }
    setSelectedFeatures(newSelected);
  };

  const handleSitePress = (siteId: string) => {
    router.push(`/site/${siteId}`);
  };

  const renderSiteCard = ({ item }: { item: Site }) => {
    const locationLabel = item.city?.trim() || "";
    const features = orderFeaturesLikeFilters(
      parseFeatures(item.features),
      allFeatures
    );

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleSitePress(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.imageWrapper}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={styles.defaultImageWrapper}>
              <Image
                source={require("@/assets/images/wander-nebraska-logo.png")}
                style={styles.defaultImageLogo}
                contentFit="contain"
              />
            </View>
          )}
          {isSpecial50Site(item.special50) && (
            <View style={styles.special50Badge}>
              <Image
                source={require("@/assets/images/your-parks-adventure-logo.png")}
                style={styles.special50Logo}
                contentFit="contain"
              />
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.name}>{item.name}</Text>
          {locationLabel ? (
            <Text style={styles.location}>{locationLabel}</Text>
          ) : (
            <Text style={styles.locationMuted}>Location unavailable</Text>
          )}
          {features.length > 0 && (
            <View style={styles.featuresContainer}>
              {features.slice(0, 5).map((feature, index) => (
                <View key={`${item.id}-f-${index}`} style={styles.featureTag}>
                  <MaterialIcons
                    name={getFeatureIcon(feature)}
                    size={14}
                    color={Colors.tint}
                  />
                </View>
              ))}
              {features.length > 5 && (
                <Text style={styles.moreFeaturesText}>
                  +{features.length - 5}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Sites</Text>
        <Image
          source={require("@/assets/images/wander-nebraska-logo.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
      </View>
      <TextInput
        placeholder="Search by name or city"
        placeholderTextColor="#666"
        style={[
          styles.searchInput,
          matchingSponsors.length > 0 && styles.searchInputWithSponsorBelow,
        ]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {matchingSponsors.length > 0 && (
        <View style={styles.sponsorChamberSection}>
          <Text style={styles.sponsorChamberLabel}>Chamber of commerce sponsors</Text>
          {matchingSponsors.map((s, index) => {
            const rec = s as Record<string, unknown>;
            const cityLabel = sponsorCityFromRecord(rec) ?? "";
            const linkRaw = sponsorLinkFromRecord(rec) ?? "";
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sponsorChamberRow,
                  index === matchingSponsors.length - 1 &&
                    styles.sponsorChamberRowLast,
                ]}
                onPress={() => openChamberWebsite(linkRaw)}
                activeOpacity={0.75}
              >
                <MaterialIcons
                  name="open-in-new"
                  size={18}
                  color={Colors.tint}
                  style={styles.sponsorChamberIcon}
                />
                <View style={styles.sponsorChamberTextCol}>
                  <Text style={styles.sponsorChamberCity}>{cityLabel}</Text>
                  <Text style={styles.sponsorChamberUrl} numberOfLines={2}>
                    {normalizeChamberUrl(linkRaw).replace(/^https:\/\//i, "")}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {(allFeatures.length > 0 || sites.some((s) => isSpecial50Site(s.special50))) && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            {sites.some((s) => isSpecial50Site(s.special50)) && (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterSpecial50 && styles.filterChipSelected,
                ]}
                onPress={() => setFilterSpecial50(!filterSpecial50)}
                activeOpacity={0.7}
              >
                <Image
                  source={require("@/assets/images/your-parks-adventure-logo.png")}
                  style={styles.filterChipLogo}
                  contentFit="contain"
                />
                <Text
                  style={[
                    styles.filterChipText,
                    filterSpecial50 && styles.filterChipTextSelected,
                  ]}
                >
                  Special 50
                </Text>
              </TouchableOpacity>
            )}
            {allFeatures.map((feature) => {
              const isSelected = selectedFeatures.has(feature);
              return (
                <TouchableOpacity
                  key={feature}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}
                  onPress={() => toggleFeature(feature)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={getFeatureIcon(feature)}
                    size={16}
                    color={isSelected ? Colors.white : Colors.tint}
                    style={styles.filterChipIcon}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {formatFeatureLabel(feature)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {(selectedFeatures.size > 0 || filterSpecial50) && (
            <TouchableOpacity
              style={styles.clearFilters}
              onPress={() => {
                setSelectedFeatures(new Set());
                setFilterSpecial50(false);
              }}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {loading ? (
        <LoadingScreen message="Loading sites..." />
      ) : (
        <FlatList
          data={filteredSites}
          keyExtractor={(item) => item.id}
          renderItem={renderSiteCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No sites found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedFeatures.size > 0 || filterSpecial50
                  ? "Try adjusting your filters or search to find sites."
                  : "Try adjusting your search or filters."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    backgroundColor: Colors.white,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLogo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
  },
  searchInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E1E1E1",
    color: Colors.text,
  },
  searchInputWithSponsorBelow: {
    marginBottom: 10,
  },
  sponsorChamberSection: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#C5DCF5",
  },
  sponsorChamberLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sponsorChamberRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sponsorChamberRowLast: {
    marginBottom: 0,
  },
  sponsorChamberIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  sponsorChamberTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sponsorChamberCity: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  sponsorChamberUrl: {
    fontSize: 13,
    color: Colors.tint,
    textDecorationLine: "underline",
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    overflow: "hidden",
    minHeight: 120,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
    position: "relative",
  },
  special50Badge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  special50Logo: {
    width: 32,
    height: 32,
  },
  image: {
    width: 120,
    height: 120,
  },
  defaultImageWrapper: {
    width: 120,
    height: 120,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultImageLogo: {
    width: 72,
    height: 72,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#999",
    fontSize: 12,
  },
  cardContent: {
    flex: 1,
    padding: 14,
    justifyContent: "flex-start",
    minHeight: 120,
    alignSelf: "stretch",
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
  },
  location: {
    fontSize: 14,
    color: "#555",
  },
  locationMuted: {
    fontSize: 14,
    color: "#A1A1A1",
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: Colors.tint,
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  filterChipIcon: {
    marginRight: 4,
  },
  filterChipLogo: {
    width: 18,
    height: 18,
    marginRight: 4,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.tint,
    fontWeight: "500",
  },
  filterChipTextSelected: {
    color: Colors.white,
  },
  clearFilters: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  clearFiltersText: {
    fontSize: 12,
    color: Colors.tint,
    textDecorationLine: "underline",
  },
  featuresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  featureTag: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F7FF",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E8F0",
  },
  moreFeaturesText: {
    fontSize: 11,
    color: "#666",
    fontStyle: "italic",
  },
});
