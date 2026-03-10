import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../thread-state.js";

export interface RuntimeConfig {
  modelName: string;
  threadId: string;
  thinkingEnabled?: boolean;
  [key: string]: unknown;
}

export interface BeforeModelResult {
  messages?: BaseMessage[];
  stateUpdates?: Partial<AgentStateType>;
}

export interface AfterModelResult {
  response?: AIMessage;
  stateUpdates?: Partial<AgentStateType>;
}

export interface Middleware {
  name: string;
  /** Static boolean or dynamic function to determine if middleware is active */
  enabled: boolean | ((config: RuntimeConfig) => boolean);
  /** Runs before LLM call. Can modify messages and state. */
  beforeModel?: (
    state: AgentStateType,
    config: RuntimeConfig
  ) => Promise<BeforeModelResult | void>;
  /** Runs after LLM call. Can modify the response and state. */
  afterModel?: (
    state: AgentStateType,
    response: AIMessage,
    config: RuntimeConfig
  ) => Promise<AfterModelResult | void>;
}
