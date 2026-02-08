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

type RecordingRuntime = {
  sessionId: string | null;
  title: string;
  note: string;
  chunkIndex: number;
  chunkUris: string[];
  queue: AudioChunk[];
  isRecording: boolean;
  isPaused: boolean;
  isRotating: boolean;
  isProcessing: boolean;
  sessionStartTime: number;
  elapsedAtPause: number;
  config: TranscriptionConfig;
};

type TimerKey = "rotation" | "consumer" | "elapsed";

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

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
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
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

  const runtimeRef = useRef<RecordingRuntime>({
    sessionId: null,
    title: "",
    note: "",
    chunkIndex: 0,
    chunkUris: [],
    queue: [],
    isRecording: false,
    isPaused: false,
    isRotating: false,
    isProcessing: false,
    sessionStartTime: 0,
    elapsedAtPause: 0,
    config: DEFAULT_TRANSCRIPTION_CONFIG,
  });

  const timersRef = useRef<{
    rotation: ReturnType<typeof setInterval> | null;
    consumer: ReturnType<typeof setInterval> | null;
    elapsed: ReturnType<typeof setInterval> | null;
  }>({ rotation: null, consumer: null, elapsed: null });

  const durationMillisRef = useRef(0);

  useEffect(() => {
    StorageService.getTranscriptionConfig().then(c => {
      setConfig(c);
      runtimeRef.current.config = c;
    });
  }, []);

  useEffect(() => {
    durationMillisRef.current = recorderState.durationMillis ?? 0;
  }, [recorderState.durationMillis]);

  const clearTimer = useCallback((key: TimerKey) => {
    const timer = timersRef.current[key];
    if (timer) clearInterval(timer);
    timersRef.current[key] = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    clearTimer("rotation");
    clearTimer("consumer");
    clearTimer("elapsed");
  }, [clearTimer]);

  const waitForRotation = useCallback(async () => {
    while (runtimeRef.current.isRotating) {
      await sleep(50);
    }
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
    const rt = runtimeRef.current;
    if (!rt.isRecording || rt.isPaused || !rt.sessionId) return;

    rt.isRotating = true;
    try {
      const durationMs = durationMillisRef.current;
      await recorder.stop();

      const uri = recorder.uri;
      if (uri) {
        const chunk = await AudioChunkService.saveChunk(uri, rt.sessionId, rt.chunkIndex, durationMs);
        rt.queue.push(chunk);
        rt.chunkUris.push(chunk.uri);
        rt.chunkIndex += 1;
        setChunkCount(rt.chunkIndex);
        setQueueDepth(rt.queue.length);
      }

      if (!rt.isPaused) {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (err) {
      console.error("Chunk rotation error:", err);
    } finally {
      rt.isRotating = false;
    }
  }, [recorder]);

  const processQueue = useCallback(async () => {
    const rt = runtimeRef.current;
    if (rt.isProcessing) return;
    if (rt.queue.length === 0) return;

    rt.isProcessing = true;

    try {
      const chunk = rt.queue.shift()!;
      setQueueDepth(rt.queue.length);

      const text = await TranscriptionService.transcribe(chunk.uri, rt.config.provider, {
        apiEndpoint: rt.config.apiEndpoint,
        apiKey: rt.config.apiKey,
        model: rt.config.model,
      });
      if (text.trim()) {
        const separator = rt.note.length > 0 ? " " : "";
        rt.note = rt.note + separator + text.trim();
        setCurrentNote(rt.note);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      rt.isProcessing = false;
    }
  }, []);

  const startRotationTimer = useCallback(() => {
    clearTimer("rotation");
    const rt = runtimeRef.current;
    timersRef.current.rotation = setInterval(() => {
      rotateChunk();
    }, rt.config.chunkDurationSec * 1000);
  }, [clearTimer, rotateChunk]);

  const startElapsedTimer = useCallback(() => {
    clearTimer("elapsed");
    timersRef.current.elapsed = setInterval(() => {
      setElapsedMs(Date.now() - runtimeRef.current.sessionStartTime);
    }, 250);
  }, [clearTimer]);

  const startSession = useCallback(
    async (title: string) => {
      const rt = runtimeRef.current;
      const sessionId = `session_${Date.now()}`;
      const granted = permissionGranted || (await requestPermission());
      if (!granted) {
        throw new Error("Microphone permission not granted");
      }

      rt.title = title;
      rt.note = "";
      rt.chunkIndex = 0;
      rt.queue = [];
      rt.chunkUris = [];
      rt.isProcessing = false;
      rt.isRotating = false;
      rt.sessionStartTime = Date.now();
      rt.sessionId = sessionId;
      rt.isPaused = false;
      rt.elapsedAtPause = 0;

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
        createdAt: rt.sessionStartTime,
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
        createdAt: rt.sessionStartTime,
        updatedAt: rt.sessionStartTime,
      };
      await StorageService.saveNote(preliminaryNote);

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      rt.isRecording = true;

      startRotationTimer();

      clearTimer("consumer");
      timersRef.current.consumer = setInterval(() => {
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
      clearTimer,
    ],
  );

  const pauseSession = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt.isRecording || rt.isPaused) return;

    clearTimer("rotation");
    clearTimer("elapsed");

    await waitForRotation();

    rt.isPaused = true;
    setIsPaused(true);
    rt.elapsedAtPause = Date.now() - rt.sessionStartTime;

    try {
      recorder.pause();
    } catch {
      try {
        await recorder.stop();
      } catch {}
    }

    if (rt.sessionId) {
      StorageService.saveRecording({
        id: rt.sessionId,
        title: rt.title || `Meeting ${new Date().toLocaleString()}`,
        createdAt: rt.sessionStartTime,
        durationMs: rt.elapsedAtPause,
        audioUri: "",
        chunkUris: [...rt.chunkUris],
        noteId: `note_${rt.sessionId}`,
        chunkCount: rt.chunkIndex,
        status: "paused",
      });
    }
  }, [clearTimer, recorder, waitForRotation]);

  const resumeSession = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt.isRecording || !rt.isPaused) return;

    rt.isPaused = false;
    setIsPaused(false);

    const pausedDuration = rt.elapsedAtPause;
    rt.sessionStartTime = Date.now() - pausedDuration;

    try {
      await recorder.prepareToRecordAsync();
    } catch {}
    recorder.record();

    startRotationTimer();
    startElapsedTimer();

    if (rt.sessionId) {
      StorageService.saveRecording({
        id: rt.sessionId,
        title: rt.title || `Meeting ${new Date().toLocaleString()}`,
        createdAt: rt.sessionStartTime,
        durationMs: pausedDuration,
        audioUri: "",
        chunkUris: [...rt.chunkUris],
        noteId: `note_${rt.sessionId}`,
        chunkCount: rt.chunkIndex,
        status: "recording",
      });
    }
  }, [recorder, startRotationTimer, startElapsedTimer]);

  const stopSession = useCallback(async () => {
    const rt = runtimeRef.current;
    rt.isRecording = false;
    rt.isPaused = false;
    setIsRecording(false);
    setIsPaused(false);

    clearAllTimers();

    const sid = rt.sessionId;
    const totalDuration = Date.now() - rt.sessionStartTime;

    await waitForRotation();

    try {
      const durationMs = durationMillisRef.current;
      try {
        await recorder.stop();
      } catch {}

      const uri = recorder.uri;
      if (uri && sid) {
        const chunk = await AudioChunkService.saveChunk(uri, sid, rt.chunkIndex, durationMs);
        rt.queue.push(chunk);
        rt.chunkUris.push(chunk.uri);
        rt.chunkIndex += 1;
        setChunkCount(rt.chunkIndex);
      }
    } catch (err) {
      console.error("Error saving final chunk:", err);
    }

    while (rt.queue.length > 0) {
      try {
        await processQueue();
      } catch {
        break;
      }
    }

    let audioUri = "";
    if (sid && rt.chunkUris.length > 0) {
      try {
        audioUri = await AudioChunkService.mergeChunkUris(sid, rt.chunkUris);
      } catch (err) {
        console.error("Error merging chunks:", err);
        audioUri = rt.chunkUris[rt.chunkUris.length - 1];
      }
    }

    if (sid) {
      const noteId = `note_${sid}`;
      const now = Date.now();

      const session: RecordingSession = {
        id: sid,
        title: rt.title || `Recording ${new Date().toLocaleString()}`,
        createdAt: rt.sessionStartTime,
        durationMs: totalDuration,
        audioUri,
        chunkUris: [...rt.chunkUris],
        noteId,
        chunkCount: rt.chunkIndex,
        status: "completed",
      };

      const note: Note = {
        id: noteId,
        recordingId: sid,
        text: rt.note,
        createdAt: rt.sessionStartTime,
        updatedAt: now,
      };

      try {
        await StorageService.saveRecording(session);
        await StorageService.saveNote(note);
      } catch (err) {
        console.error("Error persisting session:", err);
      }
    }

    rt.sessionId = null;
    setCurrentSessionId(null);
    setElapsedMs(0);
  }, [clearAllTimers, processQueue, recorder, waitForRotation]);

  const updateConfig = useCallback(async (partial: Partial<TranscriptionConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      runtimeRef.current.config = next;
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
