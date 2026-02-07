export type RecordingSession = {
  id: string;
  title: string;
  createdAt: number;
  durationMs: number;
  audioUri: string;
  noteId: string;
  chunkCount: number;
};

export type Note = {
  id: string;
  recordingId: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type AudioChunk = {
  uri: string;
  index: number;
  durationMs: number;
};

export type TranscriptionConfig = {
  chunkDurationSec: number;
  apiEndpoint: string;
  apiKey: string;
  model: string;
};

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  chunkDurationSec: 10,
  apiEndpoint: "https://api.openai.com/v1/audio/transcriptions",
  apiKey: "",
  model: "gpt-4o-transcribe",
};
