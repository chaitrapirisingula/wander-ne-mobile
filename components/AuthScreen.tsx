import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";
import { ref, set, get } from "firebase/database";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { auth, db } from "../firebase";

interface UserProfile {
  name: string;
  email: string;
  tShirtSize: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZipCode: string;
}

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tShirtSize, setTShirtSize] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [mailingCity, setMailingCity] = useState("");
  const [mailingState, setMailingState] = useState("");
  const [mailingZipCode, setMailingZipCode] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      onAuthSuccess(userCredential.user);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (!tShirtSize) {
      Alert.alert("Error", "Please select a t-shirt size");
      return;
    }
    if (!mailingAddress.trim() || !mailingCity.trim() || !mailingState.trim() || !mailingZipCode.trim()) {
      Alert.alert("Error", "Please enter all mailing address fields (address, city, state, and ZIP code)");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      
      // Save user profile data to Firebase Realtime Database
      // Note: This requires Firebase Realtime Database security rules to allow writes
      try {
        const userProfile: UserProfile = {
          name: name.trim(),
          email: email.trim(),
          tShirtSize,
          mailingAddress: mailingAddress.trim(),
          mailingCity: mailingCity.trim(),
          mailingState: mailingState.trim(),
          mailingZipCode: mailingZipCode.trim(),
        };
        
        const userProfileRef = ref(db, `users/${userCredential.user.uid}`);
        await set(userProfileRef, userProfile);
      } catch (dbError: any) {
        // If database write fails, still allow signup to succeed
        // The profile can be saved later, or check Firebase security rules
        console.warn("Failed to save user profile:", dbError);
        if (dbError.code === "PERMISSION_DENIED") {
          Alert.alert(
            "Account Created",
            "Your account was created, but there was an issue saving your profile. Please check Firebase security rules allow authenticated users to write to 'users/{userId}'.",
            [{ text: "OK" }]
          );
        }
      }
      
      onAuthSuccess(userCredential.user);
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        "Email Required",
        "Please enter your email address in the email field above, then try again."
      );
      return;
    }

    Alert.alert(
      "Reset Password",
      `Send password reset email to ${email.trim()}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send",
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert(
                "Password Reset Email Sent",
                "Please check your email for instructions to reset your password."
              );
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to send password reset email. Please check the email address."
              );
            }
          },
        },
      ]
    );
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    // Clear form
    setName("");
    setEmail("");
    setPassword("");
    setTShirtSize("");
    setMailingAddress("");
    setMailingCity("");
    setMailingState("");
    setMailingZipCode("");
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <Text style={styles.title}>{isLogin ? "Welcome Back" : "Create Account"}</Text>
        <Text style={styles.subtitle}>
          {isLogin ? "Sign in to view your profile" : "Sign up to start tracking your visits"}
        </Text>

        {!isLogin && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />
          {!isLogin && (
            <Text style={styles.hint}>Password must be at least 6 characters</Text>
          )}
          {isLogin && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isLogin && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>T-Shirt Size *</Text>
              <View style={styles.sizeContainer}>
                {T_SHIRT_SIZES.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeButton,
                      tShirtSize === size && styles.sizeButtonSelected,
                    ]}
                    onPress={() => setTShirtSize(size)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.sizeButtonText,
                        tShirtSize === size && styles.sizeButtonTextSelected,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mailing Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address"
                placeholderTextColor="#999"
                value={mailingAddress}
                onChangeText={setMailingAddress}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 2, marginRight: 10 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor="#999"
                  value={mailingCity}
                  onChangeText={setMailingCity}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>State *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="State"
                  placeholderTextColor="#999"
                  value={mailingState}
                  onChangeText={setMailingState}
                  autoCapitalize="characters"
                  maxLength={2}
                  editable={!loading}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>ZIP *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ZIP"
                  placeholderTextColor="#999"
                  value={mailingZipCode}
                  onChangeText={setMailingZipCode}
                  keyboardType="numeric"
                  maxLength={5}
                  editable={!loading}
                />
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={isLogin ? handleLogin : handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={switchMode}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
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
  hint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
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
  button: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    color: Colors.tint,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  forgotPasswordButton: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  forgotPasswordText: {
    color: Colors.tint,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});

