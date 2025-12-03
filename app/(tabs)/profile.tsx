import { Image } from "expo-image";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import {
  VisitedSite,
  clearVisitedSites,
  getVisitedSites,
} from "@/lib/visitedSites";
import { useFocusEffect } from "@react-navigation/native";

export default function ProfileScreen() {
  const [visitedSites, setVisitedSites] = useState<VisitedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVisitedSites = useCallback(async () => {
    const data = await getVisitedSites();
    setVisitedSites(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadVisitedSites();
    }, [loadVisitedSites])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVisitedSites();
    setRefreshing(false);
  }, [loadVisitedSites]);

  const handleClearHistory = useCallback(async () => {
    await clearVisitedSites();
    await loadVisitedSites();
  }, [loadVisitedSites]);

  const renderItem = ({ item }: { item: VisitedSite }) => {
    const locationLabel = [item.city, item.state].filter(Boolean).join(", ");
    const visitedDate = new Date(item.visitedAt).toLocaleDateString();

    return (
      <View style={styles.card}>
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
          <Text style={styles.siteName}>{item.name}</Text>
          {locationLabel ? (
            <Text style={styles.location}>{locationLabel}</Text>
          ) : (
            <Text style={styles.locationMuted}>Location unavailable</Text>
          )}
          <Text style={styles.visitedText}>Visited on {visitedDate}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>
            {visitedSites.length} site{visitedSites.length === 1 ? "" : "s"}{" "}
            visited
          </Text>
        </View>
        {visitedSites.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>Clear history</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={visitedSites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          visitedSites.length === 0 ? styles.emptyList : undefined
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptySubtitle}>
              Visit a site to start tracking your progress across Nebraska.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  clearButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    color: Colors.text,
    fontWeight: "600",
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
  siteName: {
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
  visitedText: {
    fontSize: 13,
    color: "#888",
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text,
  },
  emptyState: {
    marginTop: 80,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
});
