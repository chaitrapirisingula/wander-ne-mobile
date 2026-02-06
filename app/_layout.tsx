import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

// Wander Nebraska theme
const AppTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFFFF",
    card: "#FFFFFF",
    text: "#000000",
    border: "#E5E5E5",
    primary: "#0047AB",
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#E5C76B" }, // Wander yellow
          headerTintColor: "#0047AB",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
          }}
        />
        <Stack.Screen
          name="site/[id]"
          options={{
            title: "Site Details",
            headerBackTitle: "Back",
            headerBackVisible: true,
            presentation: "card",
          }}
        />
      </Stack>

      {/* 👇 Keep text/icons dark since background is light */}
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
