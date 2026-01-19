import { Colors } from "@/constants/theme";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";

const MAPBOX_ACCESS_TOKEN = Constants.expoConfig?.extra?.mapboxToken || "";

// Try to load WebView
let WebView: any = null;
try {
  WebView = require("react-native-webview").WebView;
} catch (error) {
  console.warn("react-native-webview not available:", error);
}

interface Site {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  image?: string;
}

// Default center for Nebraska
const NEBRASKA_CENTER = {
  lat: 41.4925,
  lng: -99.9018,
};

// Geocode address using Mapbox Geocoding API
const geocodeAddress = async (
  address: string,
  city?: string,
  state?: string
): Promise<{ lat: number; lng: number } | null> => {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("Mapbox access token is missing. Cannot geocode address.");
    return null;
  }

  try {
    const query = [address, city, state].filter(Boolean).join(", ");
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

export default function MapScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesWithCoords, setSitesWithCoords] = useState<
    Array<Site & { lat: number; lng: number }>
  >([]);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Request location permission
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error("Error getting location:", error);
      }
    })();

    // Fetch sites from Firebase
    const sitesRef = ref(db, "2025_sites");
    const unsubscribe = onValue(sitesRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as any).map(
          ([id, value]: any) => ({
            id,
            ...value,
          })
        ) as Site[];
        setSites(sitesArray);

        // Process sites with existing coordinates first
        const initialSitesWithCoords: Array<
          Site & { lat: number; lng: number }
        > = [];
        const sitesToGeocode: Site[] = [];

        sitesArray.forEach((site) => {
          let lat: number | undefined = site.latitude;
          let lng: number | undefined = site.longitude;

          if (
            typeof lat === "number" &&
            typeof lng === "number" &&
            !isNaN(lat) &&
            !isNaN(lng)
          ) {
            initialSitesWithCoords.push({ ...site, lat, lng });
          } else {
            sitesToGeocode.push(site);
          }
        });
        setSitesWithCoords(initialSitesWithCoords);

        // Geocode remaining addresses
        if (sitesToGeocode.length > 0) {
          setGeocoding(true);
          const geocodedResults = await Promise.all(
            sitesToGeocode.map(async (site) => {
              if (site.address) {
                const coords = await geocodeAddress(
                  site.address,
                  site.city,
                  site.state
                );
                if (
                  coords &&
                  typeof coords.lat === "number" &&
                  typeof coords.lng === "number" &&
                  !isNaN(coords.lat) &&
                  !isNaN(coords.lng)
                ) {
                  return { ...site, lat: coords.lat, lng: coords.lng };
                }
              }
              return null;
            })
          );

          setSitesWithCoords((prev) => [
            ...prev,
            ...(geocodedResults.filter(Boolean) as Array<
              Site & { lat: number; lng: number }
            >),
          ]);
          setGeocoding(false);
        }
        setLoading(false);
      } else {
        setSites([]);
        setSitesWithCoords([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleMarkerClick = (siteId: string) => {
    const site =
      sites.find((s) => s.id === siteId) ||
      sitesWithCoords.find((s) => s.id === siteId);
    if (site) {
      setSelectedSite(site);
    }
  };

  const handleSiteCardPress = () => {
    if (selectedSite) {
      router.push({
        pathname: `/site/${selectedSite.id}`,
        params: { fromMap: "true" },
      });
    }
  };

  // Generate HTML for Mapbox map
  const generateMapHTML = () => {
    let center = userLocation || NEBRASKA_CENTER;
    if (!center.lat || !center.lng || isNaN(center.lat) || isNaN(center.lng)) {
      center = NEBRASKA_CENTER;
    }

    // Prepare marker data - Mapbox uses [longitude, latitude]
    const markerData = sitesWithCoords
      .filter((site) => {
        const lat = Number(site.lat);
        const lng = Number(site.lng);
        return (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lng >= -180 &&
          lng <= 180 &&
          lat >= -90 &&
          lat <= 90 &&
          !(lng === 0 && lat === 0)
        );
      })
      .map((site) => ({
        id: site.id,
        name: site.name || "Unknown Site",
        coordinates: [Number(site.lng), Number(site.lat)],
      }));

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <script>
    (function() {
      // Wait for both DOM and Mapbox to be ready
      function initMap() {
        if (typeof mapboxgl === 'undefined') {
          setTimeout(initMap, 50);
          return;
        }
        
        try {
          mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
          
          const centerLng = ${center.lng};
          const centerLat = ${center.lat};
          
          if (isNaN(centerLng) || isNaN(centerLat)) {
            throw new Error('Invalid center coordinates');
          }
          
          const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [centerLng, centerLat],
            zoom: ${userLocation ? 10 : 6},
            attributionControl: false
          });

          const markerData = ${JSON.stringify(markerData)};

          map.on('load', function() {
            markerData.forEach(function(site) {
              try {
                const lng = Number(site.coordinates[0]);
                const lat = Number(site.coordinates[1]);
                
                if (isNaN(lng) || isNaN(lat) || 
                    lng < -180 || lng > 180 || 
                    lat < -90 || lat > 90 ||
                    (lng === 0 && lat === 0)) {
                  return;
                }
                
                const el = document.createElement('div');
                el.className = 'marker';
                el.style.width = '30px';
                el.style.height = '30px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#FFD700';
                el.style.border = '3px solid #007AFF';
                el.style.cursor = 'pointer';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

                const marker = new mapboxgl.Marker(el)
                  .setLngLat([lng, lat])
                  .addTo(map);

                el.addEventListener('click', function(e) {
                  if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'markerClick',
                      siteId: site.id
                    }));
                  }
                });
              } catch (err) {
                console.error('Error creating marker for site:', site.name, err);
              }
            });
          });

          map.on('click', function(e) {
            const target = e.originalEvent.target;
            if (target && (target.classList.contains('marker') || target.closest('.marker'))) {
              return;
            }
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapClick'
              }));
            }
          });

          map.on('error', function(e) {
            console.error('Map error:', e);
          });
        } catch (err) {
          console.error('Initialization error:', err);
        }
      }
      
      // Start initialization when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
      } else {
        initMap();
      }
    })();
  </script>
</body>
</html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "markerClick" && data.siteId) {
        handleMarkerClick(data.siteId);
      } else if (data.type === "mapClick") {
        setSelectedSite(null);
      }
    } catch (error) {
      console.error("Error parsing WebView message:", error);
    }
  };

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Mapbox access token is missing.</Text>
        <Text style={styles.errorSubText}>
          Please set MAPBOX_ACCESS_TOKEN in your .env file and restart.
        </Text>
      </View>
    );
  }

  if (loading || geocoding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>
          {geocoding ? "Geocoding addresses..." : "Loading map..."}
        </Text>
      </View>
    );
  }

  if (!WebView) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Map View</Text>
          <Text style={styles.placeholderSubtext}>
            {sitesWithCoords.length} site
            {sitesWithCoords.length !== 1 ? "s" : ""} found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: generateMapHTML() }}
        style={styles.map}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.tint} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        onError={(syntheticEvent: { nativeEvent: { message: string } }) => {
          console.error("WebView error: ", syntheticEvent.nativeEvent);
        }}
      />
      {sitesWithCoords.length === 0 && !loading && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>
            No sites with location data found.
          </Text>
        </View>
      )}
      {selectedSite && (
        <View style={styles.siteCardContainer}>
          <TouchableOpacity
            style={styles.siteCard}
            onPress={handleSiteCardPress}
            activeOpacity={0.9}
          >
            <View style={styles.siteCardContent}>
              {selectedSite.image && (
                <Image
                  source={{ uri: selectedSite.image }}
                  style={styles.siteCardImage}
                  contentFit="cover"
                />
              )}
              <View style={styles.siteCardText}>
                <Text style={styles.siteCardName} numberOfLines={2}>
                  {selectedSite.name}
                </Text>
                {(selectedSite.city || selectedSite.state) && (
                  <Text style={styles.siteCardLocation} numberOfLines={1}>
                    {[selectedSite.city, selectedSite.state]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
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
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
    paddingHorizontal: 20,
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
  siteCardContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  siteCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    alignItems: "center",
  },
  siteCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  siteCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#EFEFEF",
  },
  siteCardText: {
    flex: 1,
  },
  siteCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  siteCardLocation: {
    fontSize: 13,
    color: "#666",
  },
});
