import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AuthScreen from "@/components/AuthScreen";
import { Colors } from "@/constants/theme";
import {
  VisitedSite,
  clearVisitedSites,
  getVisitedSites,
} from "@/lib/visitedSites";
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "../../firebase";

interface UserProfile {
  name: string;
  email: string;
  tShirtSize: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZipCode: string;
}

const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [visitedSites, setVisitedSites] = useState<VisitedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form fields
  const [editTShirtSize, setEditTShirtSize] = useState("");
  const [editMailingAddress, setEditMailingAddress] = useState("");
  const [editMailingCity, setEditMailingCity] = useState("");
  const [editMailingState, setEditMailingState] = useState("");
  const [editMailingZipCode, setEditMailingZipCode] = useState("");

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadUserProfile(currentUser.uid);
        loadVisitedSites();
      } else {
        setUserProfile(null);
        setVisitedSites([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (uid: string) => {
    try {
      const profileRef = ref(db, `users/${uid}`);
      const snapshot = await get(profileRef);
      if (snapshot.exists()) {
        const profile = snapshot.val() as UserProfile;
        setUserProfile(profile);
        // Initialize edit fields
        setEditTShirtSize(profile.tShirtSize || "");
        setEditMailingAddress(profile.mailingAddress || "");
        setEditMailingCity(profile.mailingCity || "");
        setEditMailingState(profile.mailingState || "");
        setEditMailingZipCode(profile.mailingZipCode || "");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadVisitedSites = useCallback(async () => {
    if (!user?.uid) {
      setVisitedSites([]);
      setLoading(false);
      return;
    }
    const data = await getVisitedSites(user.uid);
    setVisitedSites(data);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setLoading(true);
        loadVisitedSites();
      }
    }, [user, loadVisitedSites])
  );

  const handleRefresh = useCallback(async () => {
    if (user) {
      setRefreshing(true);
      await loadVisitedSites();
      if (user.uid) {
        await loadUserProfile(user.uid);
      }
      setRefreshing(false);
    }
  }, [user, loadVisitedSites]);

  const handleClearHistory = useCallback(async () => {
    if (!user?.uid) return;
    
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear your visit history?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearVisitedSites(user.uid);
            await loadVisitedSites();
          },
        },
      ]
    );
  }, [user, loadVisitedSites]);

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to sign out");
            }
          },
        },
      ]
    );
  };

  const handleAuthSuccess = useCallback(async (authenticatedUser: User) => {
    setUser(authenticatedUser);
    await loadUserProfile(authenticatedUser.uid);
    await loadVisitedSites();
  }, [loadVisitedSites]);

  const handleEditProfile = () => {
    if (userProfile) {
      setEditTShirtSize(userProfile.tShirtSize || "");
      setEditMailingAddress(userProfile.mailingAddress || "");
      setEditMailingCity(userProfile.mailingCity || "");
      setEditMailingState(userProfile.mailingState || "");
      setEditMailingZipCode(userProfile.mailingZipCode || "");
    }
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.uid || !userProfile) return;

    if (!editTShirtSize) {
      Alert.alert("Error", "T-Shirt size is required");
      return;
    }
    if (!editMailingAddress.trim() || !editMailingCity.trim() || !editMailingState.trim() || !editMailingZipCode.trim()) {
      Alert.alert("Error", "All mailing address fields are required");
      return;
    }

    setSaving(true);
    try {
      const updatedProfile: UserProfile = {
        ...userProfile,
        tShirtSize: editTShirtSize,
        mailingAddress: editMailingAddress.trim(),
        mailingCity: editMailingCity.trim(),
        mailingState: editMailingState.trim(),
        mailingZipCode: editMailingZipCode.trim(),
      };

      const profileRef = ref(db, `users/${user.uid}`);
      await set(profileRef, updatedProfile);
      setUserProfile(updatedProfile);
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    // Reset to original values
    if (userProfile) {
      setEditTShirtSize(userProfile.tShirtSize || "");
      setEditMailingAddress(userProfile.mailingAddress || "");
      setEditMailingCity(userProfile.mailingCity || "");
      setEditMailingState(userProfile.mailingState || "");
      setEditMailingZipCode(userProfile.mailingZipCode || "");
    }
  };

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

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Show loading while fetching profile data
  if (loading && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Show authenticated profile
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>
            {userProfile?.name ? `Hi, ${userProfile.name}` : "Your Profile"}
          </Text>
          <Text style={styles.subtitle}>
            {visitedSites.length} site{visitedSites.length === 1 ? "" : "s"}{" "}
            visited
          </Text>
          {userProfile && !editing && (
            <View style={styles.profileInfo}>
              {userProfile.tShirtSize && (
                <Text style={styles.profileText}>
                  T-Shirt Size: {userProfile.tShirtSize}
                </Text>
              )}
              {(userProfile.mailingAddress || userProfile.mailingCity) && (
                <Text style={styles.profileText}>
                  Mailing: {[userProfile.mailingAddress, userProfile.mailingCity, userProfile.mailingState, userProfile.mailingZipCode].filter(Boolean).join(", ")}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleCancelEdit}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.inputContainer}>
              <Text style={styles.label}>T-Shirt Size *</Text>
              <View style={styles.sizeContainer}>
                {T_SHIRT_SIZES.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeButton,
                      editTShirtSize === size && styles.sizeButtonSelected,
                    ]}
                    onPress={() => setEditTShirtSize(size)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.sizeButtonText,
                        editTShirtSize === size && styles.sizeButtonTextSelected,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mailing Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address"
                placeholderTextColor="#999"
                value={editMailingAddress}
                onChangeText={setEditMailingAddress}
                autoCapitalize="words"
                editable={!saving}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 2, marginRight: 10 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor="#999"
                  value={editMailingCity}
                  onChangeText={setEditMailingCity}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="State"
                  placeholderTextColor="#999"
                  value={editMailingState}
                  onChangeText={setEditMailingState}
                  autoCapitalize="characters"
                  maxLength={2}
                  editable={!saving}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>ZIP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ZIP"
                  placeholderTextColor="#999"
                  value={editMailingZipCode}
                  onChangeText={setEditMailingZipCode}
                  keyboardType="numeric"
                  maxLength={5}
                  editable={!saving}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {visitedSites.length > 0 && (
        <View style={styles.clearSection}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>Clear history</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={visitedSites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          visitedSites.length === 0 ? styles.emptyList : styles.listContent
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
    marginBottom: 20,
  },
  headerLeft: {
    marginBottom: 12,
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
  profileInfo: {
    marginTop: 12,
  },
  profileText: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  logoutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 14,
  },
  clearSection: {
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  clearButtonText: {
    color: Colors.text,
    fontWeight: "600",
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
  headerButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  editButton: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E1E1",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
  },
  modalCancelText: {
    fontSize: 16,
    color: Colors.tint,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: "#E1E1E1",
  },
  sizeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: Colors.tint,
  },
  sizeButtonSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  sizeButtonText: {
    fontSize: 14,
    color: Colors.tint,
    fontWeight: "500",
  },
  sizeButtonTextSelected: {
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 40,
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
