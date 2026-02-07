import { File, Directory, Paths } from "expo-file-system";

import { AudioChunk } from "../types/recording";

const CHUNKS_DIR_NAME = "audio_chunks";

function getChunksDir(): Directory {
  return new Directory(Paths.document, CHUNKS_DIR_NAME);
}

export default class AudioChunkService {
  static ensureChunksDir(): void {
    const dir = getChunksDir();
    if (!dir.exists) {
      dir.create();
    }
  }

  static saveChunk(
    sourceUri: string,
    sessionId: string,
    index: number,
    durationMs: number,
  ): AudioChunk {
    this.ensureChunksDir();

    const fileName = `${sessionId}_chunk_${index}.m4a`;
    const dest = new File(getChunksDir(), fileName);
    const source = new File(sourceUri);

    source.copy(dest);

    return { uri: dest.uri, index, durationMs };
  }

  static mergeChunkUris(sessionId: string, chunkUris: string[]): string {
    // expo-file-system doesn't provide native audio concatenation.
    // For MVP, keep the last chunk as the "representative" audio file.
    // A production app would use a native module or server-side merging.
    if (chunkUris.length === 0) {
      throw new Error("No chunks to merge");
    }

    const finalFile = new File(Paths.document, `recording_${sessionId}.m4a`);
    const lastChunk = new File(chunkUris[chunkUris.length - 1]);
    lastChunk.copy(finalFile);

    return finalFile.uri;
  }

  static cleanupSessionChunks(sessionId: string): void {
    const dir = getChunksDir();
    if (!dir.exists) return;

    const items = dir.list();
    for (const item of items) {
      if (item instanceof File && item.name.startsWith(`${sessionId}_chunk_`)) {
        item.delete();
      }
    }
  }
}
