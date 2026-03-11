export { MiddlewareChain } from "./chain.js";
export type { Middleware, RuntimeConfig, BeforeModelResult, AfterModelResult } from "./types.js";
export { threadDataMiddleware } from "./thread-data.js";
export { danglingToolCallMiddleware } from "./dangling-tool-call.js";
export { titleMiddleware } from "./title.js";
export { subagentLimitMiddleware } from "./subagent-limit.js";
export { createSummarizationMiddleware } from "./summarization.js";
export { clarificationMiddleware } from "./clarification.js";

import { MiddlewareChain } from "./chain.js";
import { threadDataMiddleware } from "./thread-data.js";
import { danglingToolCallMiddleware } from "./dangling-tool-call.js";
import { titleMiddleware } from "./title.js";
import { subagentLimitMiddleware } from "./subagent-limit.js";
import { createMemoryMiddleware } from "../../memory/middleware.js";
import { createSummarizationMiddleware } from "./summarization.js";
import { clarificationMiddleware } from "./clarification.js";
import { sandboxMiddleware } from "../../sandbox/middleware.js";
import { loadConfig } from "../../config/loader.js";
import { DEFAULT_MEMORY_CONFIG } from "../../memory/types.js";
import type { SummarizationConfig } from "../../config/types.js";

const DEFAULT_SUMMARIZATION_CONFIG: SummarizationConfig = {
  enabled: false,
  maxTokenFraction: 0.7,
  keepRecentMessages: 6,
};

/**
 * Build the default middleware chain.
 * Order:
 * 1. ThreadData (before): set up thread directories
 * 2. DanglingToolCall (before): fix interrupted tool calls
 * 3. Summarization (before): compress long conversations
 * 4. Memory (before+after): inject memory / collect for extraction
 * 5. Sandbox (before): sandbox context
 * 6. SubagentLimit (after): cap concurrent task tool calls
 * 7. Title (after): auto-generate conversation title
 * 8. Clarification (after): detect ask_clarification tool calls
 */
export function createDefaultMiddlewareChain(): MiddlewareChain {
  const config = loadConfig();
  const memConfig = { ...DEFAULT_MEMORY_CONFIG, ...config.memory };
  const sumConfig = { ...DEFAULT_SUMMARIZATION_CONFIG, ...config.summarization };

  return new MiddlewareChain()
    .register(threadDataMiddleware)
    .register(danglingToolCallMiddleware)
    .register(createSummarizationMiddleware(sumConfig))
    .register(createMemoryMiddleware(memConfig))
    .register(sandboxMiddleware)
    .register(subagentLimitMiddleware)
    .register(titleMiddleware)
    .register(clarificationMiddleware);
}
