import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { onValue, ref } from "firebase/database";
import { db } from "../../firebase";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";

// Lazy load MapView to prevent import errors from breaking the tab
const getMapComponents = () => {
  if (Platform.OS === "web") {
    return { MapView: null, Marker: null };
  }
  try {
    const Maps = require("react-native-maps");
    return {
      MapView: Maps.default || Maps,
      Marker: Maps.Marker,
    };
  } catch (error) {
    console.warn("react-native-maps not available:", error);
    return { MapView: null, Marker: null };
  }
};

interface Site {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
}

// Default center for Nebraska (if no user location)
const NEBRASKA_CENTER = {
  latitude: 41.4925,
  longitude: -99.9018,
  latitudeDelta: 5.0,
  longitudeDelta: 5.0,
};

export default function MapScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Request location permission
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setLocationPermission(true);
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error("Error getting location:", error);
      }
    })();

    // Fetch sites from Firebase
    const sitesRef = ref(db, "2025_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as any)
          .map(([id, value]: any) => ({
            id,
            ...value,
          }))
          .filter((site: Site) => site.latitude && site.longitude); // Only include sites with coordinates
        setSites(sitesArray);
      } else {
        setSites([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkerPress = (site: Site) => {
    router.push(`/site/${site.id}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 1.0,
        longitudeDelta: 1.0,
      }
    : NEBRASKA_CENTER;

  // Get MapView components (lazy loaded)
  const { MapView, Marker } = getMapComponents();

  // If MapView is not available (web or error), show a placeholder
  if (!MapView || Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Map View</Text>
          <Text style={styles.placeholderSubtext}>
            {sites.length} site{sites.length !== 1 ? "s" : ""} found
          </Text>
          {sites.length > 0 && (
            <View style={styles.sitesList}>
              {sites.slice(0, 5).map((site) => (
                <Text key={site.id} style={styles.siteItem}>
                  • {site.name}
                </Text>
              ))}
              {sites.length > 5 && (
                <Text style={styles.siteItem}>... and {sites.length - 5} more</Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={locationPermission}
        showsMyLocationButton={true}
        customMapStyle={[
          {
            elementType: "geometry",
            stylers: [{ color: Colors.white }],
          },
          {
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }],
          },
          {
            elementType: "labels.text.fill",
            stylers: [{ color: Colors.text }],
          },
          {
            elementType: "labels.text.stroke",
            stylers: [{ color: Colors.white }],
          },
        ]}
      >
        {sites.map((site) => {
          if (site.latitude && site.longitude) {
            return (
              <Marker
                key={site.id}
                coordinate={{
                  latitude: site.latitude,
                  longitude: site.longitude,
                }}
                title={site.name}
                description={site.city ? `${site.city}, ${site.state || ""}` : ""}
                onPress={() => handleMarkerPress(site)}
                pinColor={Colors.secondary}
              />
            );
          }
          return null;
        })}
      </MapView>
      {sites.length === 0 && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>
            No sites with location data found. Sites need latitude and longitude
            coordinates to appear on the map.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  map: {
    flex: 1,
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
  infoOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
  },
  sitesList: {
    width: "100%",
    maxWidth: 300,
  },
  siteItem: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    paddingLeft: 10,
  },
});

