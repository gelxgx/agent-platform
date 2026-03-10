export { MiddlewareChain } from "./chain.js";
export type { Middleware, RuntimeConfig, BeforeModelResult, AfterModelResult } from "./types.js";
export { threadDataMiddleware } from "./thread-data.js";
export { danglingToolCallMiddleware } from "./dangling-tool-call.js";
export { titleMiddleware } from "./title.js";

import { MiddlewareChain } from "./chain.js";
import { threadDataMiddleware } from "./thread-data.js";
import { danglingToolCallMiddleware } from "./dangling-tool-call.js";
import { titleMiddleware } from "./title.js";
import { createMemoryMiddleware } from "../../memory/middleware.js";
import { loadConfig } from "../../config/loader.js";
import { DEFAULT_MEMORY_CONFIG } from "../../memory/types.js";

/**
 * Build the default middleware chain.
 * Order matches DeerFlow's middleware execution order:
 * 1. ThreadData (before): set up thread directories
 * 2. DanglingToolCall (before): fix interrupted tool calls
 * 3. Memory (before+after): inject memory context / collect for extraction
 * 4. Title (after): auto-generate conversation title
 */
export function createDefaultMiddlewareChain(): MiddlewareChain {
  const config = loadConfig();
  const memConfig = { ...DEFAULT_MEMORY_CONFIG, ...config.memory };

  return new MiddlewareChain()
    .register(threadDataMiddleware)
    .register(danglingToolCallMiddleware)
    .register(createMemoryMiddleware(memConfig))
    .register(titleMiddleware);
}
