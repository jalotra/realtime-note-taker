import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  RecordingSession,
  Note,
  TranscriptionConfig,
  DEFAULT_TRANSCRIPTION_CONFIG,
} from "../types/recording";

const RECORDINGS_KEY = "@recordings";
const NOTES_KEY = "@notes";
const CONFIG_KEY = "@transcription_config";

export default class StorageService {
  static async getRecordings(): Promise<RecordingSession[]> {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecordingSession[];
  }

  static async saveRecording(session: RecordingSession): Promise<void> {
    const existing = await this.getRecordings();
    const idx = existing.findIndex(r => r.id === session.id);
    if (idx >= 0) {
      existing[idx] = session;
    } else {
      existing.unshift(session);
    }
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(existing));
  }

  static async getRecordingById(id: string): Promise<RecordingSession | null> {
    const all = await this.getRecordings();
    return all.find(r => r.id === id) ?? null;
  }

  static async getNotes(): Promise<Note[]> {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  }

  static async saveNote(note: Note): Promise<void> {
    const existing = await this.getNotes();
    const idx = existing.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      existing[idx] = note;
    } else {
      existing.unshift(note);
    }
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(existing));
  }

  static async getNoteById(id: string): Promise<Note | null> {
    const all = await this.getNotes();
    return all.find(n => n.id === id) ?? null;
  }

  static async getNoteByRecordingId(recordingId: string): Promise<Note | null> {
    const all = await this.getNotes();
    return all.find(n => n.recordingId === recordingId) ?? null;
  }

  static async getTranscriptionConfig(): Promise<TranscriptionConfig> {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_TRANSCRIPTION_CONFIG;
    return { ...DEFAULT_TRANSCRIPTION_CONFIG, ...JSON.parse(raw) };
  }

  static async saveTranscriptionConfig(config: TranscriptionConfig): Promise<void> {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  static async deleteRecording(id: string): Promise<void> {
    const existing = await this.getRecordings();
    const filtered = existing.filter(r => r.id !== id);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
  }

  static async deleteNote(id: string): Promise<void> {
    const existing = await this.getNotes();
    const filtered = existing.filter(n => n.id !== id);
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(filtered));
  }
}
