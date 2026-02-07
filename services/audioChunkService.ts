import * as FileSystem from "expo-file-system";

import { AudioChunk } from "../types/recording";

const CHUNKS_DIR_NAME = "audio_chunks";

function getChunksDirUri(): string {
  return `${FileSystem.documentDirectory}${CHUNKS_DIR_NAME}/`;
}

export default class AudioChunkService {
  static async ensureChunksDir(): Promise<void> {
    const dirUri = getChunksDirUri();
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  }

  static async saveChunk(
    sourceUri: string,
    sessionId: string,
    index: number,
    durationMs: number,
  ): Promise<AudioChunk> {
    await this.ensureChunksDir();

    const fileName = `${sessionId}_chunk_${index}.m4a`;
    const destUri = `${getChunksDirUri()}${fileName}`;

    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    return { uri: destUri, index, durationMs };
  }

  static async mergeChunkUris(sessionId: string, chunkUris: string[]): Promise<string> {
    if (chunkUris.length === 0) {
      throw new Error("No chunks to merge");
    }

    const finalUri = `${FileSystem.documentDirectory}recording_${sessionId}.m4a`;
    const lastChunk = chunkUris[chunkUris.length - 1];
    await FileSystem.copyAsync({ from: lastChunk, to: finalUri });

    return finalUri;
  }

  static async cleanupSessionChunks(sessionId: string): Promise<void> {
    const dirUri = getChunksDirUri();
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) return;

    const items = await FileSystem.readDirectoryAsync(dirUri);
    for (const name of items) {
      if (name.startsWith(`${sessionId}_chunk_`)) {
        await FileSystem.deleteAsync(`${dirUri}${name}`, { idempotent: true });
      }
    }
  }
}
