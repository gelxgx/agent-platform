import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ProviderFactory = () => Promise<new (config: Record<string, unknown>) => BaseChatModel>;

export interface ModelFactoryOptions {
  modelName?: string;
  thinkingEnabled?: boolean;
}
