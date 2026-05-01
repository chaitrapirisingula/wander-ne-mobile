import { Tabs } from "expo-router";
import React from "react";
import { PixelRatio } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";

const fontScale = PixelRatio.getFontScale();
const tabBarExtraVertical =
  fontScale > 1 ? Math.min(14, Math.round((fontScale - 1) * 12)) : 0;

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="sites"
      screenOptions={{
        tabBarActiveTintColor: Colors.tabIconSelected,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors.footer,
          paddingTop: 4 + tabBarExtraVertical,
          paddingBottom: 4 + tabBarExtraVertical,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="map.fill" color={color} />
          ),
          tabBarLabel: "Map",
        }}
      />
      <Tabs.Screen
        name="sites"
        options={{
          title: "Sites",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
          tabBarLabel: "Sites",
        }}
      />
      <Tabs.Screen
        name="shared-events"
        options={{
          title: "Tours",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="figure.hiking" color={color} />
          ),
          tabBarLabel: "Tours",
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
          tabBarLabel: "Events",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle" color={color} />
          ),
          tabBarLabel: "Profile",
        }}
      />
    </Tabs>
  );
}
