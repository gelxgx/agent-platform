import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../thread-state.js";
import type { Middleware, RuntimeConfig } from "./types.js";

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  register(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  private isEnabled(middleware: Middleware, config: RuntimeConfig): boolean {
    if (typeof middleware.enabled === "function") {
      return middleware.enabled(config);
    }
    return middleware.enabled;
  }

  async runBeforeModel(
    state: AgentStateType,
    config: RuntimeConfig
  ): Promise<{ messages: BaseMessage[]; stateUpdates: Partial<AgentStateType> }> {
    let messages = [...state.messages];
    let stateUpdates: Partial<AgentStateType> = {};

    for (const mw of this.middlewares) {
      if (!mw.beforeModel || !this.isEnabled(mw, config)) continue;
      const result = await mw.beforeModel({ ...state, messages }, config);
      if (result?.messages) {
        messages = result.messages;
      }
      if (result?.stateUpdates) {
        stateUpdates = { ...stateUpdates, ...result.stateUpdates };
      }
    }

    return { messages, stateUpdates };
  }

  async runAfterModel(
    state: AgentStateType,
    response: AIMessage,
    config: RuntimeConfig
  ): Promise<{ response: AIMessage; stateUpdates: Partial<AgentStateType> }> {
    let currentResponse = response;
    let stateUpdates: Partial<AgentStateType> = {};

    for (const mw of this.middlewares) {
      if (!mw.afterModel || !this.isEnabled(mw, config)) continue;
      const result = await mw.afterModel(state, currentResponse, config);
      if (result?.response) {
        currentResponse = result.response;
      }
      if (result?.stateUpdates) {
        stateUpdates = { ...stateUpdates, ...result.stateUpdates };
      }
    }

    return { response: currentResponse, stateUpdates };
  }

  getMiddlewares(): readonly Middleware[] {
    return this.middlewares;
  }
}
