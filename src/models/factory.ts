import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getModelConfig, getDefaultModelName } from "../config/loader.js";
import type { ProviderFactory } from "./types.js";

const PROVIDER_MAP: Record<string, ProviderFactory> = {
  openai: () =>
    import("@langchain/openai").then((m) => m.ChatOpenAI as unknown as new (config: Record<string, unknown>) => BaseChatModel),
};

export function registerProvider(name: string, factory: ProviderFactory): void {
  PROVIDER_MAP[name] = factory;
}

export async function createChatModel(name?: string): Promise<BaseChatModel> {
  const modelName = name ?? getDefaultModelName();
  const config = getModelConfig(modelName);

  const factory = PROVIDER_MAP[config.provider];
  if (!factory) {
    const available = Object.keys(PROVIDER_MAP).join(", ");
    throw new Error(
      `Unknown provider "${config.provider}". Available: ${available}. ` +
      `To add support, install the package and call registerProvider().`
    );
  }

  const ModelClass = await factory();
  const opts: Record<string, unknown> = {
    model: config.model,
    apiKey: config.apiKey,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    streaming: true,
    maxRetries: 2,
    timeout: 60000,
  };
  if (config.baseURL) {
    opts.configuration = { baseURL: config.baseURL };
  }
  return new ModelClass(opts);
}
