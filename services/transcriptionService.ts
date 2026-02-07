import { File } from "expo-file-system";

import { TranscriptionConfig } from "../types/recording";

export default class TranscriptionService {
  static async transcribe(audioUri: string, config: TranscriptionConfig): Promise<string> {
    const { apiEndpoint, apiKey, model } = config;

    if (!apiKey) {
      throw new Error("Transcription API key is not configured");
    }

    const file = new File(audioUri);
    if (!file.exists) {
      throw new Error(`Audio file not found: ${audioUri}`);
    }

    const fileName = file.name ?? "chunk.m4a";

    const formData = new FormData();
    formData.append("file", {
      uri: audioUri,
      name: fileName,
      type: "audio/m4a",
    } as unknown as Blob);
    formData.append("model", model);

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Transcription failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    return (result.text as string) ?? "";
  }
}
