import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

// Yellow, Blue, White theme
const AppTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFFFF", // White
    card: "#FFFFFF", // White
    text: "#000000", // Black text
    border: "#E5E5E5",
    primary: "#007AFF", // Blue
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#000000",
          }}
        />
        <Stack.Screen
          name="site/[id]"
          options={{
            title: "Site Details",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#000000",
            presentation: "card",
          }}
        />
      </Stack>

      {/* 👇 Keep text/icons dark since background is light */}
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
