import { Colors } from "@/constants/theme";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
  const [locationPermission, setLocationPermission] = useState(false);
  const router = useRouter();
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    // Request location permission
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setLocationPermission(true);
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

        // Geocode addresses for sites without coordinates
        setGeocoding(true);
        const sitesWithCoordinates: Array<Site & { lat: number; lng: number }> =
          [];

        for (const site of sitesArray) {
          let lat: number | undefined = site.latitude;
          let lng: number | undefined = site.longitude;

          // Validate existing coordinates
          if (lat !== undefined && lng !== undefined) {
            lat = Number(lat);
            lng = Number(lng);
            if (isNaN(lat) || isNaN(lng)) {
              lat = undefined;
              lng = undefined;
            }
          }

          // If no valid coordinates, geocode the address
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            if (site.address) {
              const coords = await geocodeAddress(
                site.address,
                site.city,
                site.state
              );
              if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
                lat = coords.lat;
                lng = coords.lng;
              }
            }
          }

          // Only add if we have valid coordinates
          if (
            lat !== undefined &&
            lng !== undefined &&
            !isNaN(lat) &&
            !isNaN(lng)
          ) {
            sitesWithCoordinates.push({
              ...site,
              lat: Number(lat),
              lng: Number(lng),
            });
          }
        }

        setSitesWithCoords(sitesWithCoordinates);
        setGeocoding(false);
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
    router.push(`/site/${siteId}`);
  };

  // Generate HTML for Mapbox map
  const generateMapHTML = () => {
    // Ensure center coordinates are valid
    let center = userLocation || NEBRASKA_CENTER;
    if (!center.lat || !center.lng || isNaN(center.lat) || isNaN(center.lng)) {
      center = NEBRASKA_CENTER;
    }

    // Filter out any sites with invalid coordinates
    const markerData = sitesWithCoords
      .filter((site) => {
        const lat = Number(site.lat);
        const lng = Number(site.lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
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
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
    .mapboxgl-popup-content { padding: 12px; }
    .mapboxgl-popup-content h3 { margin: 0 0 4px 0; font-size: 14px; font-weight: 600; }
    .error { 
      position: absolute; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      padding: 20px; 
      background: white; 
      border-radius: 8px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="error" class="error" style="display: none;"></div>
  <script>
    (function() {
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
          console.log('Map loaded with', markerData.length, 'markers');
          markerData.forEach(function(site) {
            try {
              const lng = site.coordinates[0];
              const lat = site.coordinates[1];
              
              // Validate coordinates before creating marker
              if (isNaN(lng) || isNaN(lat) || lng === 0 || lat === 0) {
                console.warn('Skipping invalid coordinates for site:', site.name, site.coordinates);
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
                .setPopup(
                  new mapboxgl.Popup({ offset: 25 })
                    .setHTML('<h3>' + (site.name || 'Unknown Site') + '</h3>')
                )
                .addTo(map);

              el.addEventListener('click', function() {
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

        map.on('error', function(e) {
          console.error('Map error:', e);
          document.getElementById('error').style.display = 'block';
          document.getElementById('error').textContent = 'Map error: ' + (e.error ? e.error.message : 'Unknown error');
        });

        // Handle script errors
        window.addEventListener('error', function(e) {
          console.error('Script error:', e);
          document.getElementById('error').style.display = 'block';
          document.getElementById('error').textContent = 'Error loading map: ' + e.message;
        });
      } catch (err) {
        console.error('Initialization error:', err);
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Failed to initialize map: ' + err.message;
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
      }
    } catch (error) {
      console.error("Error parsing WebView message:", error);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("Map state:", {
      sitesCount: sites.length,
      sitesWithCoordsCount: sitesWithCoords.length,
      loading,
      geocoding,
      hasWebView: !!WebView,
    });
  }, [sites.length, sitesWithCoords.length, loading, geocoding]);

  if (loading || geocoding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>
          {geocoding ? "Geocoding addresses..." : "Loading map..."}
        </Text>
        {sites.length > 0 && (
          <Text style={styles.debugText}>
            Found {sites.length} sites, geocoding{" "}
            {sites.length - sitesWithCoords.length} addresses...
          </Text>
        )}
      </View>
    );
  }

  // If WebView is not available, show placeholder
  if (!WebView) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Map View</Text>
          <Text style={styles.placeholderSubtext}>
            {sitesWithCoords.length} site
            {sitesWithCoords.length !== 1 ? "s" : ""} found
          </Text>
          <Text style={styles.installText}>
            Please install react-native-webview to view the map:
          </Text>
          <Text style={styles.installCommand}>
            npx expo install react-native-webview
          </Text>
          {sitesWithCoords.length > 0 && (
            <View style={styles.sitesList}>
              {sitesWithCoords.slice(0, 5).map((site) => (
                <Text key={site.id} style={styles.siteItem}>
                  • {site.name}
                </Text>
              ))}
              {sitesWithCoords.length > 5 && (
                <Text style={styles.siteItem}>
                  ... and {sitesWithCoords.length - 5} more
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  const htmlContent = generateMapHTML();
  console.log("Generated HTML length:", htmlContent.length);
  console.log("Sites with coords:", sitesWithCoords.length);

  return (
    <View style={styles.container}>
      {WebView ? (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
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
            const { nativeEvent } = syntheticEvent;
            console.error("WebView error: ", nativeEvent);
          }}
          onHttpError={(syntheticEvent: {
            nativeEvent: { statusCode: number };
          }) => {
            const { nativeEvent } = syntheticEvent;
            console.error("WebView HTTP error: ", nativeEvent);
          }}
          onLoadEnd={() => {
            console.log("WebView loaded successfully");
          }}
          onLoadStart={() => {
            console.log("WebView loading started");
          }}
          onShouldStartLoadWithRequest={() => true}
        />
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>WebView not available</Text>
        </View>
      )}
      {sitesWithCoords.length === 0 && !loading && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>
            No sites with location data found. Sites need addresses or
            coordinates to appear on the map.
          </Text>
        </View>
      )}
      {sitesWithCoords.length > 0 && (
        <View style={styles.siteCountOverlay}>
          <Text style={styles.siteCountText}>
            {sitesWithCoords.length} site
            {sitesWithCoords.length !== 1 ? "s" : ""} on map
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
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
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
  installText: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 20,
    textAlign: "center",
  },
  installCommand: {
    fontSize: 12,
    color: Colors.tint,
    fontFamily: "monospace",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
  },
  sitesList: {
    width: "100%",
    maxWidth: 300,
    marginTop: 20,
  },
  siteItem: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    paddingLeft: 10,
  },
  siteCountOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  siteCountText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "600",
  },
});
