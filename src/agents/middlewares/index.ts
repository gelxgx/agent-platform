export { MiddlewareChain } from "./chain.js";
export type { Middleware, RuntimeConfig, BeforeModelResult, AfterModelResult } from "./types.js";
export { threadDataMiddleware } from "./thread-data.js";
export { danglingToolCallMiddleware } from "./dangling-tool-call.js";
export { titleMiddleware } from "./title.js";

import { MiddlewareChain } from "./chain.js";
import { threadDataMiddleware } from "./thread-data.js";
import { danglingToolCallMiddleware } from "./dangling-tool-call.js";
import { titleMiddleware } from "./title.js";

/**
 * Build the default middleware chain.
 * Order matters — matches DeerFlow's middleware execution order:
 * 1. ThreadData (before): set up thread directories
 * 2. DanglingToolCall (before): fix interrupted tool calls
 * 3. Title (after): auto-generate conversation title
 *
 * Future middlewares will be inserted at their appropriate position.
 */
export function createDefaultMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain()
    .register(threadDataMiddleware)
    .register(danglingToolCallMiddleware)
    .register(titleMiddleware);
}
