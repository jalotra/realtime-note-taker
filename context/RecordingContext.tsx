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
  isPaused: boolean;
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
  pauseSession: () => void;
  resumeSession: () => void;
  updateConfig: (partial: Partial<TranscriptionConfig>) => Promise<void>;
  requestPermission: () => Promise<boolean>;
};

type RecordingContextType = RecordingContextState & RecordingContextActions;

const RecordingContext = createContext<RecordingContextType | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
  const isPausedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const configRef = useRef<TranscriptionConfig>(DEFAULT_TRANSCRIPTION_CONFIG);
  const elapsedAtPause = useRef(0);

  useEffect(() => {
    StorageService.getTranscriptionConfig().then((c) => {
      setConfig(c);
      configRef.current = c;
    });
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
    if (!isRecordingRef.current || isPausedRef.current) return;

    const sid = sessionIdRef.current;
    if (!sid) return;

    try {
      const durationMs = recorderState.durationMillis ?? 0;
      await recorder.stop();

      const uri = recorder.uri;
      if (uri) {
        const chunk = await AudioChunkService.saveChunk(uri, sid, chunkIndex.current, durationMs);
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
  }, [recorder, recorderState.durationMillis]);

  const processQueue = useCallback(async () => {
    if (isProcessing.current) return;
    if (chunkQueue.current.length === 0) return;

    isProcessing.current = true;

    try {
      const chunk = chunkQueue.current.shift()!;
      setQueueDepth(chunkQueue.current.length);

      const text = await TranscriptionService.transcribe(chunk.uri, configRef.current);
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
  }, []);

  const startRotationTimer = useCallback(() => {
    if (rotationTimer.current) clearInterval(rotationTimer.current);
    rotationTimer.current = setInterval(
      () => {
        rotateChunk();
      },
      configRef.current.chunkDurationSec * 1000,
    );
  }, [rotateChunk]);

  const startElapsedTimer = useCallback(() => {
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    elapsedTimer.current = setInterval(() => {
      setElapsedMs(Date.now() - sessionStartTime.current);
    }, 250);
  }, []);

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
      sessionIdRef.current = sessionId;
      isPausedRef.current = false;
      elapsedAtPause.current = 0;

      setCurrentSessionId(sessionId);
      setCurrentNote("");
      setChunkCount(0);
      setQueueDepth(0);
      setElapsedMs(0);
      setIsPaused(false);

      const noteId = `note_${sessionId}`;
      const preliminarySession: RecordingSession = {
        id: sessionId,
        title: title || `Meeting ${new Date().toLocaleString()}`,
        createdAt: sessionStartTime.current,
        durationMs: 0,
        audioUri: "",
        chunkUris: [],
        noteId,
        chunkCount: 0,
        status: "recording",
      };
      await StorageService.saveRecording(preliminarySession);

      const preliminaryNote: Note = {
        id: noteId,
        recordingId: sessionId,
        text: "",
        createdAt: sessionStartTime.current,
        updatedAt: sessionStartTime.current,
      };
      await StorageService.saveNote(preliminaryNote);

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      isRecordingRef.current = true;

      startRotationTimer();

      consumerTimer.current = setInterval(() => {
        processQueue();
      }, 1500);

      startElapsedTimer();
    },
    [
      permissionGranted,
      requestPermission,
      recorder,
      startRotationTimer,
      startElapsedTimer,
      processQueue,
    ],
  );

  const pauseSession = useCallback(() => {
    if (!isRecordingRef.current || isPausedRef.current) return;

    isPausedRef.current = true;
    setIsPaused(true);

    recorder.pause();

    elapsedAtPause.current = Date.now() - sessionStartTime.current;

    if (rotationTimer.current) {
      clearInterval(rotationTimer.current);
      rotationTimer.current = null;
    }
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }

    const sid = sessionIdRef.current;
    if (sid) {
      StorageService.saveRecording({
        id: sid,
        title: titleRef.current || `Meeting ${new Date().toLocaleString()}`,
        createdAt: sessionStartTime.current,
        durationMs: elapsedAtPause.current,
        audioUri: "",
        chunkUris: [...chunkUris.current],
        noteId: `note_${sid}`,
        chunkCount: chunkIndex.current,
        status: "paused",
      });
    }
  }, [recorder]);

  const resumeSession = useCallback(() => {
    if (!isRecordingRef.current || !isPausedRef.current) return;

    isPausedRef.current = false;
    setIsPaused(false);

    const pausedDuration = elapsedAtPause.current;
    sessionStartTime.current = Date.now() - pausedDuration;

    recorder.record();

    startRotationTimer();
    startElapsedTimer();

    const sid = sessionIdRef.current;
    if (sid) {
      StorageService.saveRecording({
        id: sid,
        title: titleRef.current || `Meeting ${new Date().toLocaleString()}`,
        createdAt: sessionStartTime.current,
        durationMs: pausedDuration,
        audioUri: "",
        chunkUris: [...chunkUris.current],
        noteId: `note_${sid}`,
        chunkCount: chunkIndex.current,
        status: "recording",
      });
    }
  }, [recorder, startRotationTimer, startElapsedTimer]);

  const stopSession = useCallback(async () => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    if (rotationTimer.current) clearInterval(rotationTimer.current);
    if (consumerTimer.current) clearInterval(consumerTimer.current);
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    rotationTimer.current = null;
    consumerTimer.current = null;
    elapsedTimer.current = null;

    const sid = sessionIdRef.current;
    const totalDuration = Date.now() - sessionStartTime.current;

    try {
      const durationMs = recorderState.durationMillis ?? 0;
      await recorder.stop();

      const uri = recorder.uri;
      if (uri && sid) {
        const chunk = await AudioChunkService.saveChunk(
          uri,
          sid,
          chunkIndex.current,
          durationMs,
        );
        chunkQueue.current.push(chunk);
        chunkUris.current.push(chunk.uri);
        chunkIndex.current += 1;
        setChunkCount(chunkIndex.current);
      }
    } catch (err) {
      console.error("Error saving final chunk:", err);
    }

    while (chunkQueue.current.length > 0) {
      try {
        await processQueue();
      } catch {
        break;
      }
    }

    let audioUri = "";
    if (sid && chunkUris.current.length > 0) {
      try {
        audioUri = await AudioChunkService.mergeChunkUris(sid, chunkUris.current);
      } catch (err) {
        console.error("Error merging chunks:", err);
        audioUri = chunkUris.current[chunkUris.current.length - 1];
      }
    }

    if (sid) {
      const noteId = `note_${sid}`;
      const now = Date.now();

      const session: RecordingSession = {
        id: sid,
        title: titleRef.current || `Recording ${new Date().toLocaleString()}`,
        createdAt: sessionStartTime.current,
        durationMs: totalDuration,
        audioUri,
        chunkUris: [...chunkUris.current],
        noteId,
        chunkCount: chunkIndex.current,
        status: "completed",
      };

      const note: Note = {
        id: noteId,
        recordingId: sid,
        text: noteRef.current,
        createdAt: sessionStartTime.current,
        updatedAt: now,
      };

      try {
        await StorageService.saveRecording(session);
        await StorageService.saveNote(note);
      } catch (err) {
        console.error("Error persisting session:", err);
      }
    }

    sessionIdRef.current = null;
    setCurrentSessionId(null);
    setElapsedMs(0);
  }, [recorder, recorderState.durationMillis, processQueue]);

  const updateConfig = useCallback(async (partial: Partial<TranscriptionConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      configRef.current = next;
      StorageService.saveTranscriptionConfig(next);
      return next;
    });
  }, []);

  const value: RecordingContextType = {
    isRecording,
    isPaused,
    currentNote,
    currentSessionId,
    elapsedMs,
    chunkCount,
    queueDepth,
    config,
    permissionGranted,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
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
