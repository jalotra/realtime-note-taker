import { Mic, Square, Pause, Play, FileText } from "lucide-react-native";
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { colors } from "../../constants/colors";
import { useRecording } from "../../context/RecordingContext";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function RecordScreen() {
  const {
    isRecording,
    isPaused,
    currentNote,
    elapsedMs,
    chunkCount,
    queueDepth,
    permissionGranted,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    requestPermission,
  } = useRecording();

  const [title, setTitle] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!permissionGranted) {
      requestPermission();
    }
  }, [permissionGranted, requestPermission]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [currentNote]);

  const handleStart = async () => {
    try {
      const sessionTitle = title.trim() || `Meeting ${new Date().toLocaleString()}`;
      await startSession(sessionTitle);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to start recording");
    }
  };

  const handleStop = async () => {
    await stopSession();
    setTitle("");
  };

  const statusLabel = isPaused ? "Paused" : "Recording";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 px-4 pt-4">
        <TextInput
          className="bg-card rounded-xl px-4 py-3 text-base font-sans border border-border mb-4 text-foreground"
          placeholder="Session title (optional)"
          value={title}
          onChangeText={setTitle}
          editable={!isRecording}
          placeholderTextColor={colors.mutedForeground}
        />

        <View className="items-center py-6">
          {!isRecording ? (
            <Pressable
              onPress={handleStart}
              className="w-24 h-24 rounded-full items-center justify-center bg-primary"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Mic size={40} color={colors.primaryForeground} />
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-x-6">
              {isPaused ? (
                <Pressable
                  onPress={() => resumeSession()}
                  className="w-20 h-20 rounded-full items-center justify-center bg-primary"
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Play size={32} color={colors.primaryForeground} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => pauseSession()}
                  className="w-20 h-20 rounded-full items-center justify-center bg-primary"
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Pause size={32} color={colors.primaryForeground} />
                </Pressable>
              )}

              <Pressable
                onPress={handleStop}
                className="w-20 h-20 rounded-full items-center justify-center bg-destructive"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Square size={28} color={colors.primaryForeground} />
              </Pressable>
            </View>
          )}

          <Text className="text-3xl font-sans-bold mt-4 text-foreground tabular-nums">
            {formatDuration(elapsedMs)}
          </Text>

          {isRecording && (
            <View className="flex-row mt-2 gap-x-4">
              <View className="flex-row items-center">
                <View
                  className={`w-2 h-2 rounded-full mr-1.5 ${isPaused ? "bg-muted-foreground" : "bg-destructive"}`}
                />
                <Text className="text-sm text-muted-foreground font-sans">{statusLabel}</Text>
              </View>
              <Text className="text-sm text-muted-foreground font-sans">Chunks: {chunkCount}</Text>
              <Text className="text-sm text-muted-foreground font-sans">Queue: {queueDepth}</Text>
            </View>
          )}
        </View>

        <View className="flex-1 bg-card rounded-xl border border-border mb-4 overflow-hidden">
          <View className="flex-row items-center px-4 py-2 border-b border-border">
            <FileText size={16} color={colors.mutedForeground} />
            <Text className="text-sm font-sans-medium text-muted-foreground ml-2">
              Live Transcript
            </Text>
          </View>

          <ScrollView
            ref={scrollRef}
            className="flex-1 px-4 py-3"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {currentNote ? (
              <Text className="text-base text-foreground leading-6 font-sans">{currentNote}</Text>
            ) : (
              <Text className="text-base text-muted-foreground italic font-sans">
                {isRecording
                  ? "Waiting for transcription..."
                  : "Tap the microphone to start recording. Transcribed text will appear here in real time."}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
