import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { Middleware } from "./types.js";
import type { SummarizationConfig } from "../../config/types.js";
import { estimateTokens, getModelMaxTokens } from "../../utils/token-estimator.js";
import { createChatModel } from "../../models/factory.js";
import { SUMMARIZATION_SYSTEM_PROMPT } from "./summarization-prompt.js";

export function createSummarizationMiddleware(
  config: SummarizationConfig,
  modelName?: string
): Middleware {
  return {
    name: "Summarization",
    enabled: config.enabled,

    async beforeModel(state, _runtimeConfig) {
      const estimated = estimateTokens(state.messages);
      const maxTokens = getModelMaxTokens(modelName);
      const threshold = maxTokens * config.maxTokenFraction;

      if (estimated <= threshold) return;

      const keepCount = config.keepRecentMessages;
      if (state.messages.length <= keepCount) return;

      const splitIndex = state.messages.length - keepCount;
      const oldMessages = state.messages.slice(0, splitIndex);
      const recentMessages = state.messages.slice(splitIndex);

      const conversationText = oldMessages
        .map((m) => {
          const role = m.getType();
          const content =
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content);
          return `[${role}]: ${content}`;
        })
        .join("\n");

      const summaryModel = await createChatModel(
        config.modelName ?? modelName
      );
      const summaryResponse = await summaryModel.invoke([
        new SystemMessage(SUMMARIZATION_SYSTEM_PROMPT),
        new HumanMessage(conversationText),
      ]);

      const summaryText =
        typeof summaryResponse.content === "string"
          ? summaryResponse.content
          : JSON.stringify(summaryResponse.content);

      const summaryMessage = new SystemMessage(
        `Previous conversation summary:\n${summaryText}`
      );

      return {
        messages: [summaryMessage, ...recentMessages],
      };
    },
  };
}
