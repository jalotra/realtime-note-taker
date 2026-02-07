import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
  useAudioRecorderState,
} from "expo-audio";
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

import AudioChunkService from "../services/audioChunkService";
import StorageService from "../services/storageService";
import TranscriptionService from "../services/transcriptionService";
import {
  AudioChunk,
  TranscriptionConfig,
  DEFAULT_TRANSCRIPTION_CONFIG,
  RecordingSession,
  Note,
} from "../types/recording";

type RecordingContextState = {
  isRecording: boolean;
  currentNote: string;
  currentSessionId: string | null;
  elapsedMs: number;
  chunkCount: number;
  queueDepth: number;
  config: TranscriptionConfig;
  permissionGranted: boolean;
};

type RecordingContextActions = {
  startSession: (title: string) => Promise<void>;
  stopSession: () => Promise<void>;
  updateConfig: (partial: Partial<TranscriptionConfig>) => Promise<void>;
  requestPermission: () => Promise<boolean>;
};

type RecordingContextType = RecordingContextState & RecordingContextActions;

const RecordingContext = createContext<RecordingContextType | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [isRecording, setIsRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [queueDepth, setQueueDepth] = useState(0);
  const [config, setConfig] = useState<TranscriptionConfig>(DEFAULT_TRANSCRIPTION_CONFIG);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const chunkQueue = useRef<AudioChunk[]>([]);
  const chunkIndex = useRef(0);
  const chunkUris = useRef<string[]>([]);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const consumerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessing = useRef(false);
  const sessionStartTime = useRef(0);
  const titleRef = useRef("");
  const noteRef = useRef("");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    StorageService.getTranscriptionConfig().then(setConfig);
  }, []);

  const requestPermission = useCallback(async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setPermissionGranted(status.granted);
    if (status.granted) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    }
    return status.granted;
  }, []);

  const rotateChunk = useCallback(async () => {
    if (!isRecordingRef.current) return;

    try {
      const durationMs = recorderState.durationMillis ?? 0;
      await recorder.stop();

      const uri = recorder.uri;
      if (uri) {
        const sessionId = currentSessionId ?? "unknown";
        const chunk = AudioChunkService.saveChunk(
          uri,
          sessionId,
          chunkIndex.current,
          durationMs,
        );
        chunkQueue.current.push(chunk);
        chunkUris.current.push(chunk.uri);
        chunkIndex.current += 1;
        setChunkCount(chunkIndex.current);
        setQueueDepth(chunkQueue.current.length);
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error("Chunk rotation error:", err);
    }
  }, [recorder, recorderState.durationMillis, currentSessionId]);

  const processQueue = useCallback(async () => {
    if (isProcessing.current) return;
    if (chunkQueue.current.length === 0) return;

    isProcessing.current = true;

    try {
      const chunk = chunkQueue.current.shift()!;
      setQueueDepth(chunkQueue.current.length);

      const text = await TranscriptionService.transcribe(chunk.uri, config);
      if (text.trim()) {
        const separator = noteRef.current.length > 0 ? " " : "";
        noteRef.current = noteRef.current + separator + text.trim();
        setCurrentNote(noteRef.current);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      isProcessing.current = false;
    }
  }, [config]);

  const startSession = useCallback(
    async (title: string) => {
      const sessionId = `session_${Date.now()}`;
      const granted = permissionGranted || (await requestPermission());
      if (!granted) {
        throw new Error("Microphone permission not granted");
      }

      titleRef.current = title;
      noteRef.current = "";
      chunkIndex.current = 0;
      chunkQueue.current = [];
      chunkUris.current = [];
      isProcessing.current = false;
      sessionStartTime.current = Date.now();

      setCurrentSessionId(sessionId);
      setCurrentNote("");
      setChunkCount(0);
      setQueueDepth(0);
      setElapsedMs(0);

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      isRecordingRef.current = true;

      rotationTimer.current = setInterval(
        () => {
          rotateChunk();
        },
        config.chunkDurationSec * 1000,
      );

      consumerTimer.current = setInterval(() => {
        processQueue();
      }, 1500);

      elapsedTimer.current = setInterval(() => {
        setElapsedMs(Date.now() - sessionStartTime.current);
      }, 250);
    },
    [permissionGranted, requestPermission, recorder, config, rotateChunk, processQueue],
  );

  const stopSession = useCallback(async () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (rotationTimer.current) clearInterval(rotationTimer.current);
    if (consumerTimer.current) clearInterval(consumerTimer.current);
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    rotationTimer.current = null;
    consumerTimer.current = null;
    elapsedTimer.current = null;

    try {
      const durationMs = recorderState.durationMillis ?? 0;
      await recorder.stop();

      const uri = recorder.uri;
      if (uri && currentSessionId) {
        const chunk = AudioChunkService.saveChunk(
          uri,
          currentSessionId,
          chunkIndex.current,
          durationMs,
        );
        chunkQueue.current.push(chunk);
        chunkUris.current.push(chunk.uri);
        chunkIndex.current += 1;
        setChunkCount(chunkIndex.current);
      }

      // Drain remaining queue
      while (chunkQueue.current.length > 0) {
        await processQueue();
      }

      const totalDuration = Date.now() - sessionStartTime.current;

      if (currentSessionId && chunkUris.current.length > 0) {
        const audioUri = AudioChunkService.mergeChunkUris(
          currentSessionId,
          chunkUris.current,
        );

        const noteId = `note_${currentSessionId}`;
        const now = Date.now();

        const session: RecordingSession = {
          id: currentSessionId,
          title: titleRef.current || `Recording ${new Date().toLocaleString()}`,
          createdAt: sessionStartTime.current,
          durationMs: totalDuration,
          audioUri,
          noteId,
          chunkCount: chunkIndex.current,
        };

        const note: Note = {
          id: noteId,
          recordingId: currentSessionId,
          text: noteRef.current,
          createdAt: sessionStartTime.current,
          updatedAt: now,
        };

        await StorageService.saveRecording(session);
        await StorageService.saveNote(note);
        AudioChunkService.cleanupSessionChunks(currentSessionId);
      }
    } catch (err) {
      console.error("Stop session error:", err);
    }

    setCurrentSessionId(null);
    setElapsedMs(0);
  }, [recorder, recorderState.durationMillis, currentSessionId, processQueue]);

  const updateConfig = useCallback(async (partial: Partial<TranscriptionConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      StorageService.saveTranscriptionConfig(next);
      return next;
    });
  }, []);

  const value: RecordingContextType = {
    isRecording,
    currentNote,
    currentSessionId,
    elapsedMs,
    chunkCount,
    queueDepth,
    config,
    permissionGranted,
    startSession,
    stopSession,
    updateConfig,
    requestPermission,
  };

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording(): RecordingContextType {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error("useRecording must be used within a RecordingProvider");
  }
  return ctx;
}
