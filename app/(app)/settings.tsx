import Slider from "@react-native-community/slider";
import { Bell, HelpCircle, MessageCircle, ChevronRight } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Alert, Switch, TouchableOpacity } from "react-native";

import { colors } from "../../constants/colors";
import Button from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useRecording } from "../../context/RecordingContext";
import { PROVIDER_REGISTRY, TranscriptionProviderName } from "../../types/transcriptionProvider";
import type { LucideIcon } from "lucide-react-native";

type SettingItemProps = {
  icon: LucideIcon;
  title: string;
  onPress?: () => void;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  showToggle?: boolean;
  showArrow?: boolean;
  description?: string;
};

const SettingItem: React.FC<SettingItemProps> = ({
  icon: Icon,
  title,
  onPress,
  value,
  onValueChange,
  showToggle = false,
  showArrow = true,
  description,
}) => {
  return (
    <TouchableOpacity
      className={`flex-row p-4 ${description ? "items-start" : "items-center"}`}
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="w-8 items-center">
        <Icon size={22} color={colors.primary} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-base font-sans-medium text-foreground">{title}</Text>
        {description && (
          <Text className="text-muted-foreground text-sm mt-1 font-sans">{description}</Text>
        )}
      </View>
      {showToggle && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.ring }}
          thumbColor={value ? colors.primary : colors.secondary}
        />
      )}
      {showArrow && !showToggle && <ChevronRight size={20} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
};

export default function SettingsScreen() {
  const { lock } = useAuth();
  const { config, updateConfig } = useRecording();

  const [provider, setProvider] = useState<TranscriptionProviderName>(config.provider);
  const [apiEndpoint, setApiEndpoint] = useState(config.apiEndpoint);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [chunkDuration, setChunkDuration] = useState(config.chunkDurationSec);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    setProvider(config.provider);
    setApiEndpoint(config.apiEndpoint);
    setApiKey(config.apiKey);
    setModel(config.model);
    setChunkDuration(config.chunkDurationSec);
  }, [config]);

  const handleProviderChange = (name: TranscriptionProviderName) => {
    setProvider(name);
    const meta = PROVIDER_REGISTRY[name];
    setApiEndpoint(meta.defaultEndpoint);
    setModel(meta.defaultModel);
  };

  const handleSaveConfig = async () => {
    await updateConfig({
      provider,
      apiEndpoint: apiEndpoint.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      chunkDurationSec: chunkDuration,
    });
    Alert.alert("Saved", "Transcription settings updated.");
  };

  const handleLock = () => {
    Alert.alert("Lock App", "Are you sure you want to lock the app?", [
      { text: "Cancel", style: "cancel" },
      { text: "Lock", onPress: () => lock(), style: "destructive" },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Text className="px-4 pb-2 text-sm font-sans-semibold text-muted-foreground uppercase">
          Transcription
        </Text>
        <View className="bg-card rounded-xl mb-6 p-4 border border-border">
          <Text className="text-sm font-sans-medium text-foreground mb-2">Provider</Text>
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {(Object.keys(PROVIDER_REGISTRY) as TranscriptionProviderName[]).map(key => {
              const isActive = provider === key;
              return (
                <TouchableOpacity
                  key={key}
                  className={`flex-1 py-2.5 rounded-lg border items-center ${
                    isActive ? "bg-primary border-primary" : "bg-secondary border-border"
                  }`}
                  onPress={() => handleProviderChange(key)}
                >
                  <Text
                    className={`text-sm font-sans-medium ${
                      isActive ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {PROVIDER_REGISTRY[key].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="text-sm font-sans-medium text-foreground mb-1">API Endpoint</Text>
          <TextInput
            className="bg-secondary rounded-lg px-3 py-2.5 text-sm font-sans border border-border mb-3 text-foreground"
            value={apiEndpoint}
            onChangeText={setApiEndpoint}
            placeholder={PROVIDER_REGISTRY[provider].defaultEndpoint}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text className="text-sm font-sans-medium text-foreground mb-1">API Key</Text>
          <TextInput
            className="bg-secondary rounded-lg px-3 py-2.5 text-sm font-sans border border-border mb-3 text-foreground"
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={PROVIDER_REGISTRY[provider].apiKeyPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text className="text-sm font-sans-medium text-foreground mb-1">Model</Text>
          <TextInput
            className="bg-secondary rounded-lg px-3 py-2.5 text-sm font-sans border border-border mb-3 text-foreground"
            value={model}
            onChangeText={setModel}
            placeholder={PROVIDER_REGISTRY[provider].defaultModel}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text className="text-sm font-sans-medium text-foreground mb-1">
            Chunk Duration: {chunkDuration}s
          </Text>
          <View className="flex-row items-center mb-4">
            <Text className="text-xs text-muted-foreground mr-2 font-sans">5s</Text>
            <View className="flex-1">
              <Slider
                minimumValue={5}
                maximumValue={30}
                step={1}
                value={chunkDuration}
                onValueChange={setChunkDuration}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
            <Text className="text-xs text-muted-foreground ml-2 font-sans">30s</Text>
          </View>

          <Button label="Save Configuration" onPress={handleSaveConfig} />
        </View>

        <Text className="px-4 pb-2 text-sm font-sans-semibold text-muted-foreground uppercase">
          Preferences
        </Text>
        <View className="bg-card rounded-xl mb-6 border border-border">
          <SettingItem
            icon={Bell}
            title="Notifications"
            showToggle
            showArrow={false}
            value={notifications}
            onValueChange={setNotifications}
          />
        </View>

        <Text className="px-4 pb-2 text-sm font-sans-semibold text-muted-foreground uppercase">
          Account
        </Text>
        <View className="bg-card rounded-xl mb-6 border border-border">
          <SettingItem
            icon={HelpCircle}
            title="Help Center"
            onPress={() => Alert.alert("Help Center", "Help center screen would appear here")}
          />
          <View className="h-px bg-border mx-4" />
          <SettingItem
            icon={MessageCircle}
            title="Contact Us"
            onPress={() => Alert.alert("Contact Us", "Contact form would appear here")}
          />
        </View>

        <Button label="Lock App" onPress={handleLock} variant="secondary" />
      </View>
    </ScrollView>
  );
}
