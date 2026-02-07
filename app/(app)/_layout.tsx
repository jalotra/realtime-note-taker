import { Tabs } from "expo-router";
import { Mic, List, Settings } from "lucide-react-native";
import React from "react";

import { colors } from "../../constants/colors";
import { RecordingProvider } from "../../context/RecordingContext";

export default function AppLayout() {
  return (
    <RecordingProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            paddingVertical: 5,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
            fontFamily: "Figtree_500Medium",
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.primaryForeground,
          headerTitleStyle: {
            fontWeight: "bold",
            fontFamily: "Figtree_700Bold",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Record",
            tabBarIcon: ({ color, size }) => <Mic size={size} color={color} />,
            tabBarLabel: "Record",
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => <List size={size} color={color} />,
            tabBarLabel: "History",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
            tabBarLabel: "Settings",
          }}
        />
        <Tabs.Screen
          name="session/[id]"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </RecordingProvider>
  );
}
