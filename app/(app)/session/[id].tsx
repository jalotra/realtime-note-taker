import * as FileSystem from "expo-file-system";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useLocalSearchParams, Stack } from "expo-router";
import { SkipBack, SkipForward, Play, Pause, FileText, AlertCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";

import { colors } from "../../../constants/colors";
import StorageService from "../../../services/storageService";
import { RecordingSession, Note } from "../../../types/recording";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function resolveAudioUri(session: RecordingSession): Promise<string | null> {
  if (session.audioUri) {
    const info = await FileSystem.getInfoAsync(session.audioUri);
    if (info.exists) return session.audioUri;
  }

  const uris = session.chunkUris ?? [];
  for (const uri of uris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }

  return null;
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const rec = await StorageService.getRecordingById(id);
      setSession(rec);
      if (rec) {
        const n = await StorageService.getNoteByRecordingId(rec.id);
        setNote(n);
        const resolved = await resolveAudioUri(rec);
        setAudioUri(resolved);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground text-base font-sans">Session not found</Text>
      </View>
    );
  }

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seekBy = (seconds: number) => {
    const target = Math.max(0, Math.min(status.currentTime + seconds, status.duration));
    player.seekTo(target);
  };

  const playbackProgress =
    status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <>
      <Stack.Screen options={{ title: session.title }} />
      <ScrollView className="flex-1 bg-background">
        <View className="p-4">
          <View className="bg-card rounded-xl p-4 mb-4 border border-border">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs text-muted-foreground font-sans">
                {formatDate(session.createdAt)}
              </Text>
              <Text className="text-xs text-muted-foreground font-sans">
                {formatDuration(session.durationMs)} | {session.chunkCount} chunks
              </Text>
            </View>

            {audioUri ? (
              <>
                <View className="h-1.5 bg-secondary rounded-full mb-4 overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </View>

                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-muted-foreground font-sans">
                    {formatDuration(status.currentTime * 1000)}
                  </Text>
                  <Text className="text-xs text-muted-foreground font-sans">
                    {formatDuration(status.duration * 1000)}
                  </Text>
                </View>

                <View className="flex-row items-center justify-center gap-x-6">
                  <Pressable onPress={() => seekBy(-10)}>
                    <SkipBack size={28} color={colors.mutedForeground} />
                  </Pressable>

                  <Pressable
                    onPress={togglePlayback}
                    className="w-16 h-16 rounded-full bg-primary items-center justify-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    {status.playing ? (
                      <Pause size={28} color={colors.primaryForeground} />
                    ) : (
                      <Play size={28} color={colors.primaryForeground} />
                    )}
                  </Pressable>

                  <Pressable onPress={() => seekBy(10)}>
                    <SkipForward size={28} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </>
            ) : (
              <View className="items-center py-4">
                <AlertCircle size={24} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground font-sans mt-2">
                  Audio file not available
                </Text>
              </View>
            )}
          </View>

          {(session.chunkUris?.length ?? 0) > 1 && (
            <View className="bg-card rounded-xl p-4 mb-4 border border-border">
              <Text className="text-sm font-sans-medium text-muted-foreground mb-2">
                Audio Chunks ({session.chunkUris.length})
              </Text>
              <Text className="text-xs text-muted-foreground font-sans">
                This session was recorded in {session.chunkUris.length} segments. Playing the
                merged audio above.
              </Text>
            </View>
          )}

          <View className="bg-card rounded-xl border border-border overflow-hidden">
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <FileText size={16} color={colors.mutedForeground} />
              <Text className="text-sm font-sans-medium text-muted-foreground ml-2">
                Transcript
              </Text>
            </View>

            <View className="px-4 py-3">
              {note?.text ? (
                <Text className="text-base text-foreground leading-6 font-sans">{note.text}</Text>
              ) : (
                <Text className="text-base text-muted-foreground italic font-sans">
                  No transcript available for this session.
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
