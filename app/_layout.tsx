import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Lock } from "lucide-react-native";
import { View, Text, Pressable, ActivityIndicator } from "react-native";

import { colors } from "../constants/colors";
import { AuthProvider, useAuth } from "../context/AuthContext";

import "../global.css";

function LockScreen() {
  const { authenticate, isLoading } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="items-center mb-10">
        <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center mb-6">
          <Lock size={36} color={colors.primary} />
        </View>
        <Text className="text-2xl font-sans-bold text-foreground mb-2">Note Taker</Text>
        <Text className="text-base font-sans text-muted-foreground text-center">
          Authenticate to access your recordings and notes.
        </Text>
      </View>

      <Pressable
        onPress={authenticate}
        disabled={isLoading}
        className="bg-primary rounded-xl px-8 py-4 w-full items-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text className="text-primary-foreground font-sans-bold text-base">Unlock</Text>
        )}
      </Pressable>
    </View>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
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
        <Stack.Screen
          name="(app)"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
