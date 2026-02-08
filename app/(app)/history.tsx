import { useRouter, useFocusEffect } from "expo-router";
import { Clock, Layers, FileText, Mic } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";

import { colors } from "../../constants/colors";
import StorageService from "../../services/storageService";
import { RecordingSession, Note } from "../../types/recording";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SessionWithNote = RecordingSession & { notePreview: string };

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithNote[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    const recordings = await StorageService.getRecordings();
    const notes = await StorageService.getNotes();
    const noteMap = new Map<string, Note>(notes.map(n => [n.recordingId, n]));

    const merged: SessionWithNote[] = recordings.map(r => {
      const note = noteMap.get(r.id);
      const preview = note?.text?.slice(0, 120) ?? "";
      return { ...r, notePreview: preview };
    });

    const sorted = merged.sort((a, b) => {
      const aActive = a.status === "recording" || a.status === "paused";
      const bActive = b.status === "recording" || b.status === "paused";
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return b.createdAt - a.createdAt;
    });

    setSessions(sorted);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const isActive = (status: RecordingSession["status"]) =>
    status === "recording" || status === "paused";

  const renderItem = ({ item }: { item: SessionWithNote }) => (
    <Pressable
      className="bg-card rounded-xl p-4 mb-3 border border-border"
      onPress={() => {
        if (!isActive(item.status)) {
          router.push(`/session/${item.id}` as never);
        }
      }}
      style={({ pressed }) => ({
        opacity: isActive(item.status) ? 0.9 : pressed ? 0.7 : 1,
      })}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-2">
          {isActive(item.status) && (
            <View className="flex-row items-center bg-destructive/10 rounded-full px-2 py-0.5 mr-2">
              <View className="w-1.5 h-1.5 rounded-full bg-destructive mr-1" />
              <Text className="text-xs text-destructive font-sans-medium">
                {item.status === "recording" ? "Recording" : "Paused"}
              </Text>
            </View>
          )}
          <Text className="text-base font-sans-semibold text-foreground flex-1" numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground font-sans">
          {formatDate(item.createdAt)}
        </Text>
      </View>

      <View className="flex-row items-center mb-2 gap-x-3">
        <View className="flex-row items-center">
          <Clock size={14} color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground ml-1 font-sans">
            {formatDuration(item.durationMs)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Layers size={14} color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground ml-1 font-sans">
            {item.chunkCount} chunks
          </Text>
        </View>
        {(item.chunkUris?.length ?? 0) > 0 && (
          <View className="flex-row items-center">
            <Mic size={14} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground ml-1 font-sans">Audio available</Text>
          </View>
        )}
      </View>

      {item.notePreview ? (
        <Text className="text-sm text-muted-foreground font-sans" numberOfLines={2}>
          {item.notePreview}
          {item.notePreview.length >= 120 ? "..." : ""}
        </Text>
      ) : (
        <Text className="text-sm text-muted-foreground italic font-sans">
          {isActive(item.status) ? "Transcription in progress..." : "No transcript available"}
        </Text>
      )}
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <FileText size={48} color={colors.border} />
            <Text className="text-muted-foreground mt-4 text-base font-sans">
              No recordings yet
            </Text>
            <Text className="text-muted-foreground mt-1 text-sm font-sans">
              Start a recording from the Record tab
            </Text>
          </View>
        }
      />
    </View>
  );
}
