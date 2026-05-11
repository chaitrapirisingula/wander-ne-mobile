import LoadingScreen from "@/components/LoadingScreen";
import { Colors } from "@/constants/theme";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
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
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  image?: string;
}

// Default center (approx. geographic center of Nebraska) when no sites / before fit
const NEBRASKA_CENTER = {
  lat: 41.4925,
  lng: -99.9018,
};
const NEBRASKA_DEFAULT_ZOOM = 5;
// Nebraska bounding box [minLng, minLat, maxLng, maxLat]
const NEBRASKA_BBOX = [-104.053514, 39.999998, -95.30829, 43.001708] as const;

// Geocode address using Mapbox Geocoding API
const geocodeAddress = async (
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<{ lat: number; lng: number } | null> => {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("Mapbox access token is missing. Cannot geocode address.");
    return null;
  }

  try {
    const normalizedAddress = String(address).trim().replace(/\s+/g, " ");
    const normalizedCity = city ? String(city).trim().replace(/\s+/g, " ") : "";
    const normalizedState = state
      ? String(state).trim().replace(/\s+/g, " ")
      : "";
    const normalizedZip = zipCode
      ? String(zipCode).trim().replace(/\s+/g, " ")
      : "";

    const looksLikeStreetAddress = /^\d+\s+\S+/.test(normalizedAddress);

    // If we don't have city/state, bias the query toward Nebraska to avoid
    // picking similarly named POIs in other states.
    const queryParts = [
      normalizedAddress,
      normalizedCity || undefined,
      normalizedState || undefined,
      normalizedZip || undefined,
      !normalizedCity && !normalizedState ? "Nebraska" : undefined,
    ].filter(Boolean);
    const query = queryParts.join(", ");

    const fetchFeatures = async (types: string) => {
      const params = new URLSearchParams({
        access_token: MAPBOX_ACCESS_TOKEN,
        limit: "5",
        country: "us",
        types,
        proximity: `${NEBRASKA_CENTER.lng},${NEBRASKA_CENTER.lat}`,
        bbox: NEBRASKA_BBOX.join(","),
        autocomplete: "false",
      });

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();
      return Array.isArray(data?.features) ? data.features : [];
    };

    // First pass: strict for street addresses to avoid “place” centroids.
    // Fallback: broaden types if Mapbox returns nothing.
    let features = await fetchFeatures(
      looksLikeStreetAddress ? "address" : "poi,address,place"
    );
    if (features.length === 0 && looksLikeStreetAddress) {
      features = await fetchFeatures("poi,address,place");
    }

    const includesToken = (haystack: string, needle: string) =>
      haystack.toLowerCase().includes(needle.toLowerCase());

    const getContextText = (feature: any) => {
      const placeName = String(feature?.place_name || "");
      const context = Array.isArray(feature?.context) ? feature.context : [];
      const contextText = context
        .map((c: any) => c?.text)
        .filter(Boolean)
        .join(" ");
      return `${placeName} ${contextText}`.trim();
    };

    const pickBestFeature = () => {
      if (features.length === 0) return null;

      const streetNumber = looksLikeStreetAddress
        ? normalizedAddress.split(" ")[0]
        : "";

      const score = (f: any) => {
        const text = getContextText(f);
        const placeTypes = Array.isArray(f?.place_type) ? f.place_type : [];
        const isAddress = placeTypes.includes("address");
        const cityOk = normalizedCity ? includesToken(text, normalizedCity) : true;
        const stateOk = normalizedState ? includesToken(text, normalizedState) : true;
        const zipOk = normalizedZip ? includesToken(text, normalizedZip) : true;
        const streetNumberOk = streetNumber ? includesToken(text, streetNumber) : true;

        let s = 0;
        if (looksLikeStreetAddress) s += isAddress ? 50 : -10;
        if (cityOk) s += 10;
        if (stateOk) s += 10;
        if (zipOk) s += 8;
        if (streetNumberOk) s += 6;
        if (typeof f?.relevance === "number") s += f.relevance * 5;
        return s;
      };

      let best = features[0];
      let bestScore = score(best);
      for (let i = 1; i < features.length; i++) {
        const s = score(features[i]);
        if (s > bestScore) {
          best = features[i];
          bestScore = s;
        }
      }
      return best;
    };

    const best = pickBestFeature();
    if (best?.center && Array.isArray(best.center) && best.center.length >= 2) {
      const [lng, lat] = best.center;
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
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const webViewRef = useRef<any>(null);

  const markerSignature = useMemo(() => {
    // Used to force WebView reload when marker set changes.
    return sitesWithCoords
      .map((s) => {
        const lat = Number(s.lat);
        const lng = Number(s.lng);
        return `${s.id}:${isNaN(lat) ? "x" : lat.toFixed(6)}:${
          isNaN(lng) ? "x" : lng.toFixed(6)
        }`;
      })
      .sort()
      .join("|");
  }, [sitesWithCoords]);

  useEffect(() => {
    // Fetch sites from Firebase
    const sitesRef = ref(db, "2026_sites");
    const unsubscribe = onValue(
      sitesRef,
      async (snapshot) => {
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
            const lat =
              typeof site.latitude === "number"
                ? site.latitude
                : typeof site.latitude === "string"
                  ? Number(site.latitude)
                  : undefined;
            const lng =
              typeof site.longitude === "number"
                ? site.longitude
                : typeof site.longitude === "string"
                  ? Number(site.longitude)
                  : undefined;

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
                    site.state,
                    site.zipCode
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
      },
      (error) => {
        console.error("Error loading sites for map:", error);
        setSites([]);
        setSitesWithCoords([]);
        setLoading(false);
      }
    );

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
        pathname: "/site/[id]",
        params: { id: selectedSite.id, fromMap: "true" },
      });
    }
  };

  const sitesByIdWithCoords = useMemo(() => {
    const map = new Map<string, Site & { lat: number; lng: number }>();
    sitesWithCoords.forEach((s) => map.set(s.id, s));
    return map;
  }, [sitesWithCoords]);

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sites
      .filter((s) => {
        const haystack =
          `${s.name ?? ""} ${s.city ?? ""} ${s.state ?? ""} ${s.address ?? ""} ${
            s.zipCode ?? ""
          }`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 10);
  }, [searchQuery, sites]);

  const focusSiteOnMap = async (site: Site) => {
    setSelectedSite(site);
    setSearchQuery("");

    const existing = sitesByIdWithCoords.get(site.id);
    if (existing) {
      try {
        webViewRef.current?.postMessage?.(
          JSON.stringify({
            type: "focusSite",
            siteId: existing.id,
            lng: Number(existing.lng),
            lat: Number(existing.lat),
          })
        );
      } catch (error) {
        console.error("Failed to focus site on map:", error);
      }
      return;
    }

    // No coords yet: geocode on demand so the site can still be found via search.
    try {
      if (!site.address) return;
      const coords = await geocodeAddress(
        site.address,
        site.city,
        site.state,
        site.zipCode
      );
      if (!coords) return;

      const withCoords: Site & { lat: number; lng: number } = {
        ...site,
        lat: coords.lat,
        lng: coords.lng,
      };
      setSitesWithCoords((prev) =>
        prev.some((p) => p.id === site.id) ? prev : [...prev, withCoords]
      );

      webViewRef.current?.postMessage?.(
        JSON.stringify({
          type: "focusSite",
          siteId: site.id,
          lng: Number(coords.lng),
          lat: Number(coords.lat),
        })
      );
    } catch (error) {
      console.error("Failed to geocode/focus site:", error);
    }
  };

  useEffect(() => {
    // Keep marker highlight in sync with the selected card.
    try {
      if (!webViewRef.current?.postMessage) return;
      if (selectedSite?.id) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setSelectedMarker", siteId: selectedSite.id })
        );
      } else {
        webViewRef.current.postMessage(JSON.stringify({ type: "clearSelection" }));
      }
    } catch (error) {
      console.error("Failed to sync selected marker:", error);
    }
  }, [selectedSite]);

  // Generate HTML for Mapbox map (always start from Nebraska; fit all markers when loaded)
  const generateMapHTML = () => {
    const center = NEBRASKA_CENTER;

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
    .marker-selected { transform: scale(1.2); transition: transform 0.15s ease-in-out; }
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
            zoom: ${NEBRASKA_DEFAULT_ZOOM},
            attributionControl: false
          });

          const markerData = ${JSON.stringify(markerData)};
          const markersById = {};
          var selectedMarkerId = null;

          function applyMarkerStyles() {
            try {
              Object.keys(markersById).forEach(function(id) {
                var marker = markersById[id];
                if (!marker || !marker.getElement) return;
                var el = marker.getElement();
                if (!el || !el.style) return;

                var isSelected = selectedMarkerId && String(id) === String(selectedMarkerId);
                el.style.backgroundColor = isSelected ? '#007AFF' : '#FFD700';
                el.style.border = isSelected ? '3px solid #003A8C' : '3px solid #007AFF';
              });
            } catch (err) {
              // ignore
            }
          }

          function setSelectedMarker(siteId) {
            selectedMarkerId = siteId != null ? String(siteId) : null;
            applyMarkerStyles();
          }

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
                markersById[String(site.id)] = marker;
                applyMarkerStyles();

                el.addEventListener('click', function(e) {
                  if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                  setSelectedMarker(site.id);
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

            if (markerData.length > 0) {
              try {
                var bounds = new mapboxgl.LngLatBounds();
                var didExtend = false;
                markerData.forEach(function(site) {
                  var lng = Number(site.coordinates[0]);
                  var lat = Number(site.coordinates[1]);
                  if (!isNaN(lng) && !isNaN(lat) &&
                      lng >= -180 && lng <= 180 &&
                      lat >= -90 && lat <= 90 &&
                      !(lng === 0 && lat === 0)) {
                    bounds.extend([lng, lat]);
                    didExtend = true;
                  }
                });
                if (didExtend) {
                  map.fitBounds(bounds, {
                    padding: { top: 56, bottom: 56, left: 48, right: 48 },
                    maxZoom: 10,
                    duration: 0
                  });
                }
              } catch (fitErr) {
                console.error('fitBounds error:', fitErr);
              }
            }
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

          function focusSite(payload) {
            try {
              if (!payload) return;
              const siteId = payload.siteId != null ? String(payload.siteId) : '';
              const lng = Number(payload.lng);
              const lat = Number(payload.lat);
              const hasCoords = !isNaN(lng) && !isNaN(lat) &&
                lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;

              if (siteId) {
                setSelectedMarker(siteId);
              }
              if (hasCoords) {
                map.flyTo({ center: [lng, lat], zoom: 12, essential: true });
              }

              const marker = markersById[siteId];
              if (marker && marker.getElement) {
                const el = marker.getElement();
                el && el.classList && el.classList.add('marker-selected');
                setTimeout(function() {
                  try { el && el.classList && el.classList.remove('marker-selected'); } catch (_) {}
                }, 900);
              }
            } catch (err) {
              console.error('focusSite error:', err);
            }
          }

          function handleIncomingMessage(event) {
            try {
              const raw = event && event.data;
              if (!raw) return;
              const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (msg && msg.type === 'focusSite') {
                focusSite(msg);
              } else if (msg && msg.type === 'setSelectedMarker') {
                setSelectedMarker(msg.siteId);
              } else if (msg && msg.type === 'clearSelection') {
                setSelectedMarker(null);
              }
            } catch (err) {
              // ignore malformed messages
            }
          }

          // RN WebView: Android uses "document", iOS uses "window"
          document.addEventListener('message', handleIncomingMessage);
          window.addEventListener('message', handleIncomingMessage);
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
      <LoadingScreen
        message={geocoding ? "Geocoding addresses..." : "Loading map..."}
      />
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
        key={markerSignature}
        ref={webViewRef}
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
        renderLoading={() => <LoadingScreen message="Loading map..." />}
        onError={(syntheticEvent: { nativeEvent: { message: string } }) => {
          console.error("WebView error: ", syntheticEvent.nativeEvent);
        }}
      />
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search sites…"
          placeholderTextColor="#666"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          onSubmitEditing={() => {
            if (filteredSites.length > 0) void focusSiteOnMap(filteredSites[0]);
          }}
        />
        {filteredSites.length > 0 && (
          <View style={styles.searchResults}>
            <FlatList
              data={filteredSites}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultRow}
                  onPress={() => void focusSiteOnMap(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!(item.city || item.state) && (
                    <Text style={styles.searchResultSub} numberOfLines={1}>
                      {[item.city, item.state].filter(Boolean).join(", ")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.searchDivider} />}
            />
          </View>
        )}
      </View>
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
              {selectedSite.image ? (
                <Image
                  source={{ uri: selectedSite.image }}
                  style={styles.siteCardImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.siteCardDefaultImage}>
                  <Image
                    source={require("@/assets/images/wander-nebraska-logo.png")}
                    style={styles.siteCardDefaultLogo}
                    contentFit="contain"
                  />
                </View>
              )}
              <View style={styles.siteCardText}>
                <Text style={styles.siteCardName}>
                  {selectedSite.name}
                </Text>
                {(selectedSite.city || selectedSite.state) && (
                  <Text style={styles.siteCardLocation}>
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
  searchContainer: {
    position: "absolute",
    top: (Constants.statusBarHeight || 0) + 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    maxHeight: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  searchResultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  searchResultSub: {
    marginTop: 2,
    fontSize: 13,
    color: "#666",
  },
  searchDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
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
    alignItems: "flex-start",
  },
  siteCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  siteCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#EFEFEF",
  },
  siteCardDefaultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  siteCardDefaultLogo: {
    width: 48,
    height: 48,
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
