export type TranscriptionProviderName = "openai" | "openrouter";

export interface ITranscriptionProvider {
  name: TranscriptionProviderName;
  label: string;
  defaultEndpoint: string;
  defaultModel: string;
  apiKeyPlaceholder: string;
  transcribe(audioUri: string, config: TranscriptionProviderConfig): Promise<string>;
}

export type TranscriptionProviderConfig = {
  apiEndpoint: string;
  apiKey: string;
  model: string;
};

export type ProviderMeta = Omit<ITranscriptionProvider, "transcribe">;

export const PROVIDER_REGISTRY: Record<TranscriptionProviderName, ProviderMeta> = {
  openai: {
    name: "openai",
    label: "OpenAI",
    defaultEndpoint: "https://api.openai.com/v1/audio/transcriptions",
    defaultModel: "gpt-4o-transcribe",
    apiKeyPlaceholder: "sk-...",
  },
  openrouter: {
    name: "openrouter",
    label: "OpenRouter",
    defaultEndpoint: "https://openrouter.ai/api/v1/audio/transcriptions",
    defaultModel: "openai/whisper-large-v3",
    apiKeyPlaceholder: "sk-or-...",
  },
};
