import type { BaseMessage } from "@langchain/core/messages";
import { loadConfig, getModelConfig } from "../config/loader.js";

const CHARS_PER_TOKEN = 4;

/**
 * Rough token estimate for a list of messages.
 * Uses the ~4 chars per token heuristic to avoid pulling in a heavy tokenizer.
 */
export function estimateTokens(messages: BaseMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === "string") {
      totalChars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if ("text" in part && typeof part.text === "string") {
          totalChars += part.text.length;
        }
      }
    }
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

const DEFAULT_MAX_TOKENS = 128_000;

/**
 * Get the context window size for the given model from config.
 * Falls back to 128 000 if not specified.
 */
export function getModelMaxTokens(modelName?: string): number {
  try {
    const config = loadConfig();
    const name = modelName ?? config.defaultModel;
    const modelConfig = getModelConfig(name);
    return modelConfig.contextWindow ?? DEFAULT_MAX_TOKENS;
  } catch {
    return DEFAULT_MAX_TOKENS;
  }
}
