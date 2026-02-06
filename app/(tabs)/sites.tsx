import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import LoadingScreen from "@/components/LoadingScreen";
import { Colors } from "@/constants/theme";

import { db } from "../../firebase";

interface Site {
  id: string;
  name: string;
  city?: string;
  state?: string;
  image?: string;
  features?: string;
  [key: string]: any;
}

// Feature icon mapping
const getFeatureIcon = (
  feature: string,
): keyof typeof MaterialIcons.glyphMap => {
  const normalized = feature.toLowerCase().trim();
  if (normalized.includes("library") || normalized.includes("book"))
    return "menu-book";
  if (normalized.includes("wheelchair") || normalized.includes("accessible"))
    return "accessible";
  if (normalized.includes("wifi") || normalized.includes("wi-fi"))
    return "wifi";
  if (normalized.includes("parking")) return "local-parking";
  if (normalized.includes("restroom") || normalized.includes("rest room"))
    return "wc";
  if (normalized.includes("cafe") || normalized.includes("coffee"))
    return "local-cafe";
  if (normalized.includes("gift") || normalized.includes("shop"))
    return "card-giftcard";
  if (normalized.includes("museum")) return "museum";
  if (normalized.includes("park")) return "park";
  if (normalized.includes("playground")) return "child-care";
  return "star"; // Default icon
};

// Parse features string into array
const parseFeatures = (features?: string): string[] => {
  if (!features) return [];
  return features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
};

export default function SitesScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(),
  );
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
    const sitesRef = ref(db, "2025_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as any).map(
          ([id, value]: any) => ({
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

  const filteredSites = useMemo(() => {
    let filtered = sites;

    // Filter by search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter((site) => {
        const valuesToSearch = [
          site.name,
          site.city,
          site.state,
          site.city && site.state ? `${site.city} ${site.state}` : undefined,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return valuesToSearch.some((value) => value.includes(query));
      });
    }

    // Filter by selected features
    if (selectedFeatures.size > 0) {
      filtered = filtered.filter((site) => {
        const siteFeatures = parseFeatures(site.features);
        return Array.from(selectedFeatures).every((selectedFeature) =>
          siteFeatures.some(
            (siteFeature) =>
              siteFeature.toLowerCase() === selectedFeature.toLowerCase(),
          ),
        );
      });
    }

    return filtered;
  }, [searchQuery, selectedFeatures, sites]);

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
    const locationLabel = [item.city, item.state].filter(Boolean).join(", ");
    const features = parseFeatures(item.features);

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
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No Image</Text>
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
                <View key={index} style={styles.featureTag}>
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
        placeholder="Search by name, city, or state"
        placeholderTextColor="#666"
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {allFeatures.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Features:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
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
                    {feature}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {selectedFeatures.size > 0 && (
            <TouchableOpacity
              style={styles.clearFilters}
              onPress={() => setSelectedFeatures(new Set())}
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
                {selectedFeatures.size > 0
                  ? "Try adjusting your filters or search to find sites."
                  : "Try adjusting your search to find a site by name, city, or state."}
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
  listContent: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    overflow: "hidden",
    height: 120,
    minHeight: 120,
    maxHeight: 120,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
  },
  image: {
    width: 120,
    height: 120,
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
    justifyContent: "center",
    minHeight: 120,
    maxHeight: 120,
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
