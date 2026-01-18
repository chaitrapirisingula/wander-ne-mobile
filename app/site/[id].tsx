import { User, onAuthStateChanged } from "firebase/auth";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { addVisitedSite, isSiteVisited } from "@/lib/visitedSites";
import { auth, db } from "../../firebase";

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
  email?: string;
  facebook?: string;
  latitude?: number;
  longitude?: number;
}

// Calculate distance between two coordinates in miles (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geocode address using Mapbox Geocoding API
const geocodeAddress = async (
  address: string,
  city?: string,
  state?: string
): Promise<{ lat: number; lng: number } | null> => {
  const MAPBOX_ACCESS_TOKEN =
    Platform.OS === "web"
      ? ""
      : require("expo-constants").default.expoConfig?.extra?.mapboxToken || "";

  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn("Mapbox access token is missing. Cannot geocode address.");
    return null;
  }

  try {
    const query = [address, city, state].filter(Boolean).join(", ");
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isVisited, setIsVisited] = useState(false);
  const [markingVisited, setMarkingVisited] = useState(false);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && id) {
        checkIfVisited(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const checkIfVisited = async (userId: string) => {
    try {
      const visited = await isSiteVisited(userId, id!);
      setIsVisited(visited);
    } catch (error) {
      console.error("Error checking visited status:", error);
    }
  };

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

  const handleMarkAsVisited = async () => {
    // Check if user is logged in
    if (!user) {
      Alert.alert(
        "Login Required",
        "You must be logged in to mark a site as visited. Would you like to go to your profile to log in?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Go to Profile",
            onPress: () => {
              router.push("/(tabs)/profile");
            },
          },
        ]
      );
      return;
    }

    if (!site) return;

    setMarkingVisited(true);

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location permissions to verify you're near the site."
        );
        setMarkingVisited(false);
        return;
      }

      // Get user's current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      // Get site coordinates
      let siteLat: number | undefined = site.latitude;
      let siteLng: number | undefined = site.longitude;

      // If no coordinates, try to geocode the address
      if (!siteLat || !siteLng) {
        if (site.address) {
          const coords = await geocodeAddress(site.address, site.city, site.state);
          if (coords) {
            siteLat = coords.lat;
            siteLng = coords.lng;
          }
        }
      }

      if (!siteLat || !siteLng) {
        Alert.alert(
          "Location Error",
          "Unable to determine the site's location. Please ensure the site has an address or coordinates."
        );
        setMarkingVisited(false);
        return;
      }

      // Calculate distance
      const distance = calculateDistance(userLat, userLng, siteLat, siteLng);
      const distanceInMiles = distance;

      if (distanceInMiles > 1) {
        Alert.alert(
          "Too Far Away",
          `You are ${distanceInMiles.toFixed(2)} miles away from this site. You must be within 1 mile to mark it as visited.`
        );
        setMarkingVisited(false);
        return;
      }

      // Mark as visited
      await addVisitedSite(user.uid, {
        id: site.id,
        name: site.name ?? "Unknown site",
        city: site.city,
        state: site.state,
        image: site.image,
      });

      setIsVisited(true);
      Alert.alert("Success", "Site marked as visited!");
    } catch (error: any) {
      console.error("Error marking as visited:", error);
      Alert.alert("Error", error.message || "Failed to mark site as visited");
    } finally {
      setMarkingVisited(false);
    }
  };

  const handlePhonePress = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWebsitePress = (url: string) => {
    Alert.alert(
      "Open Website?",
      `Would you like to open ${url}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open",
          onPress: () => {
            Linking.openURL(url);
          },
        },
      ]
    );
  };

  const handleAddressPress = (address: string, city?: string, state?: string, zipCode?: string) => {
    const fullAddress = [address, city, state, zipCode].filter(Boolean).join(", ");
    const encodedAddress = encodeURIComponent(fullAddress);
    
    Alert.alert(
      "Open in Maps?",
      `Would you like to open directions to ${fullAddress}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open",
          onPress: () => {
            // Try to open in native maps app, fallback to web
            const mapsUrl = Platform.OS === "ios" 
              ? `maps://maps.apple.com/?daddr=${encodedAddress}`
              : `google.navigation:q=${encodedAddress}`;
            
            Linking.openURL(mapsUrl).catch(() => {
              // Fallback to web-based maps
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
            });
          },
        },
      ]
    );
  };

  const handleEmailPress = (email: string) => {
    Alert.alert(
      "Open Email?",
      `Would you like to send an email to ${email}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open",
          onPress: () => {
            Linking.openURL(`mailto:${email}`);
          },
        },
      ]
    );
  };

  const handleFacebookPress = (facebook: string) => {
    let url = facebook;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    
    Alert.alert(
      "Open Facebook?",
      `Would you like to open ${url}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open",
          onPress: () => {
            Linking.openURL(url);
          },
        },
      ]
    );
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

        {/* Mark as Visited Button */}
        <TouchableOpacity
          style={[styles.markVisitedButton, isVisited && styles.markVisitedButtonDisabled]}
          onPress={handleMarkAsVisited}
          disabled={markingVisited || isVisited}
          activeOpacity={0.8}
        >
          {markingVisited ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.markVisitedButtonText}>
              {isVisited ? "✓ Already Visited" : "Mark as Visited"}
            </Text>
          )}
        </TouchableOpacity>

        {(site.address || site.city) && (
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity
              onPress={() =>
                handleAddressPress(
                  site.address || "",
                  site.city,
                  site.state,
                  site.zipCode
                )
              }
            >
              <Text style={[styles.value, styles.link]}>
                {[site.address, site.city, site.state, site.zipCode]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </TouchableOpacity>
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

        {site.email && (
          <View style={styles.section}>
            <Text style={styles.label}>Email</Text>
            <TouchableOpacity onPress={() => handleEmailPress(site.email!)}>
              <Text style={[styles.value, styles.link]}>{site.email}</Text>
            </TouchableOpacity>
          </View>
        )}

        {site.facebook && (
          <View style={styles.section}>
            <Text style={styles.label}>Facebook</Text>
            <TouchableOpacity onPress={() => handleFacebookPress(site.facebook!)}>
              <Text style={[styles.value, styles.link]} numberOfLines={1}>
                {site.facebook}
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
  markVisitedButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    minHeight: 50,
  },
  markVisitedButtonDisabled: {
    backgroundColor: "#999999",
  },
  markVisitedButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
