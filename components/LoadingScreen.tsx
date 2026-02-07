import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

import { colors } from "../constants/colors";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-muted-foreground mt-4 font-sans">{message}</Text>
    </View>
  );
}
