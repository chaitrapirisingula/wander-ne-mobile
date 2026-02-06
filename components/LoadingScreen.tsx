import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = "Loading...",
}: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/wander-nebraska-logo.png")}
        style={styles.logo}
        contentFit="contain"
      />
      <ActivityIndicator
        size="large"
        color={Colors.primary}
        style={styles.spinner}
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: Colors.text,
  },
});
