export { MiddlewareChain } from "./chain.js";
export type { Middleware, RuntimeConfig, BeforeModelResult, AfterModelResult } from "./types.js";
export { threadDataMiddleware } from "./thread-data.js";
export { danglingToolCallMiddleware } from "./dangling-tool-call.js";
export { titleMiddleware } from "./title.js";
export { subagentLimitMiddleware } from "./subagent-limit.js";

import { MiddlewareChain } from "./chain.js";
import { threadDataMiddleware } from "./thread-data.js";
import { danglingToolCallMiddleware } from "./dangling-tool-call.js";
import { titleMiddleware } from "./title.js";
import { subagentLimitMiddleware } from "./subagent-limit.js";
import { createMemoryMiddleware } from "../../memory/middleware.js";
import { loadConfig } from "../../config/loader.js";
import { DEFAULT_MEMORY_CONFIG } from "../../memory/types.js";

/**
 * Build the default middleware chain.
 * Order:
 * 1. ThreadData (before): set up thread directories
 * 2. DanglingToolCall (before): fix interrupted tool calls
 * 3. Memory (before+after): inject memory / collect for extraction
 * 4. SubagentLimit (after): cap concurrent task tool calls
 * 5. Title (after): auto-generate conversation title
 */
export function createDefaultMiddlewareChain(): MiddlewareChain {
  const config = loadConfig();
  const memConfig = { ...DEFAULT_MEMORY_CONFIG, ...config.memory };

  return new MiddlewareChain()
    .register(threadDataMiddleware)
    .register(danglingToolCallMiddleware)
    .register(createMemoryMiddleware(memConfig))
    .register(subagentLimitMiddleware)
    .register(titleMiddleware);
}
