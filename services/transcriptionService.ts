import axios from "axios";
import * as FileSystem from "expo-file-system";

import {
  TranscriptionProviderName,
  TranscriptionProviderConfig,
  PROVIDER_REGISTRY,
  ITranscriptionProvider,
} from "../types/transcriptionProvider";

/** Shared transcription logic — both providers use an OpenAI-compatible multipart endpoint */
async function sharedTranscribe(
  audioUri: string,
  config: TranscriptionProviderConfig,
): Promise<string> {
  const { apiEndpoint, apiKey, model } = config;

  if (!apiKey) {
    throw new Error("Transcription API key is not configured");
  }

  const file = await FileSystem.getInfoAsync(audioUri);
  if (!file.exists) {
    throw new Error(`Audio file not found: ${audioUri}`);
  }

  const fileName = file.uri.split("/").pop() ?? "chunk.m4a";

  const formData = new FormData();
  formData.append("file", {
    uri: audioUri,
    name: fileName,
    type: "audio/m4a",
  } as unknown as Blob);
  formData.append("model", model);

  const { data } = await axios.post(apiEndpoint, formData, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return (data.text as string) ?? "";
}

class OpenAIProvider implements ITranscriptionProvider {
  name: TranscriptionProviderName = "openai";
  label = PROVIDER_REGISTRY.openai.label;
  defaultEndpoint = PROVIDER_REGISTRY.openai.defaultEndpoint;
  defaultModel = PROVIDER_REGISTRY.openai.defaultModel;
  apiKeyPlaceholder = PROVIDER_REGISTRY.openai.apiKeyPlaceholder;

  async transcribe(audioUri: string, config: TranscriptionProviderConfig): Promise<string> {
    return sharedTranscribe(audioUri, config);
  }
}

class OpenRouterProvider implements ITranscriptionProvider {
  name: TranscriptionProviderName = "openrouter";
  label = PROVIDER_REGISTRY.openrouter.label;
  defaultEndpoint = PROVIDER_REGISTRY.openrouter.defaultEndpoint;
  defaultModel = PROVIDER_REGISTRY.openrouter.defaultModel;
  apiKeyPlaceholder = PROVIDER_REGISTRY.openrouter.apiKeyPlaceholder;

  async transcribe(audioUri: string, config: TranscriptionProviderConfig): Promise<string> {
    return sharedTranscribe(audioUri, config);
  }
}

const providers: Record<TranscriptionProviderName, ITranscriptionProvider> = {
  openai: new OpenAIProvider(),
  openrouter: new OpenRouterProvider(),
};

export default class TranscriptionService {
  static getProvider(name: TranscriptionProviderName): ITranscriptionProvider {
    return providers[name];
  }

  static async transcribe(
    audioUri: string,
    providerName: TranscriptionProviderName,
    config: TranscriptionProviderConfig,
  ): Promise<string> {
    const provider = providers[providerName];
    return provider.transcribe(audioUri, config);
  }
}
