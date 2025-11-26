import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { addVisitedSite } from "@/lib/visitedSites";
import { db } from "../../firebase";

interface Site {
  id: string;
  name: string;
  features?: string;
  hours?: string;
  image?: string;
  address?: string;
  mailing?: string;
  more?: string;
  nearby?: string;
  phone?: string;
  state?: string;
  website?: string;
  zipCode?: string;
  city?: string;
}

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const siteRef = ref(db, `2025_sites/${id}`);
    const unsubscribe = onValue(
      siteRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const snapshotValue = snapshot.val();
          const siteData = { id, ...snapshotValue };
          setSite(siteData);
          addVisitedSite({
            id,
            name: snapshotValue.name ?? "Unknown site",
            city: snapshotValue.city,
            state: snapshotValue.state,
            image: snapshotValue.image,
          });
        } else {
          setSite(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching site:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handlePhonePress = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWebsitePress = (url: string) => {
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!site) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Site not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {site.image && (
        <Image
          source={{ uri: site.image }}
          style={styles.headerImage}
          contentFit="cover"
        />
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{site.name}</Text>

        {(site.address || site.city) && (
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            {site.address && <Text style={styles.value}>{site.address}</Text>}
            {site.city && (
              <Text style={styles.value}>
                {site.city}
                {site.state && `, ${site.state}`}
                {site.zipCode && ` ${site.zipCode}`}
              </Text>
            )}
          </View>
        )}

        {site.hours && (
          <View style={styles.section}>
            <Text style={styles.label}>Hours</Text>
            <Text style={styles.value}>{site.hours}</Text>
          </View>
        )}

        {site.phone && (
          <View style={styles.section}>
            <Text style={styles.label}>Phone</Text>
            <TouchableOpacity onPress={() => handlePhonePress(site.phone!)}>
              <Text style={[styles.value, styles.link]}>{site.phone}</Text>
            </TouchableOpacity>
          </View>
        )}

        {site.website && (
          <View style={styles.section}>
            <Text style={styles.label}>Website</Text>
            <TouchableOpacity onPress={() => handleWebsitePress(site.website!)}>
              <Text style={[styles.value, styles.link]} numberOfLines={1}>
                {site.website}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {site.features && (
          <View style={styles.section}>
            <Text style={styles.label}>Features</Text>
            <Text style={styles.value}>{site.features}</Text>
          </View>
        )}

        {site.mailing && (
          <View style={styles.section}>
            <Text style={styles.label}>Mailing Address</Text>
            <Text style={styles.value}>{site.mailing}</Text>
          </View>
        )}

        {site.nearby && (
          <View style={styles.section}>
            <Text style={styles.label}>Nearby</Text>
            <Text style={styles.value}>{site.nearby}</Text>
          </View>
        )}

        {site.more && (
          <View style={styles.section}>
            <Text style={styles.label}>More Information</Text>
            <Text style={styles.value}>{site.more}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  headerImage: {
    width: "100%",
    height: 250,
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#000000",
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: "#000000",
    lineHeight: 24,
  },
  link: {
    color: "#007AFF",
    textDecorationLine: "underline",
  },
  errorText: {
    fontSize: 18,
    color: "#666666",
    textAlign: "center",
    marginTop: 50,
  },
});
