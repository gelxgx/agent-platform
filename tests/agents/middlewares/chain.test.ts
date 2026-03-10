import { describe, it, expect } from "vitest";
import { MiddlewareChain } from "../../../src/agents/middlewares/chain.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { Middleware, RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [new HumanMessage("hello")],
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
    ...overrides,
  } as AgentStateType;
}

const testConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test-thread",
};

describe("MiddlewareChain", () => {
  it("should run beforeModel middlewares in order", async () => {
    const order: string[] = [];

    const mw1: Middleware = {
      name: "first",
      enabled: true,
      beforeModel: async () => {
        order.push("first");
      },
    };

    const mw2: Middleware = {
      name: "second",
      enabled: true,
      beforeModel: async () => {
        order.push("second");
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw1).register(mw2);
    await chain.runBeforeModel(makeState(), testConfig);

    expect(order).toEqual(["first", "second"]);
  });

  it("should skip disabled middlewares", async () => {
    const order: string[] = [];

    const enabled: Middleware = {
      name: "enabled",
      enabled: true,
      beforeModel: async () => { order.push("enabled"); },
    };

    const disabled: Middleware = {
      name: "disabled",
      enabled: false,
      beforeModel: async () => { order.push("disabled"); },
    };

    const chain = new MiddlewareChain();
    chain.register(enabled).register(disabled);
    await chain.runBeforeModel(makeState(), testConfig);

    expect(order).toEqual(["enabled"]);
  });

  it("should support dynamic enabled check", async () => {
    const order: string[] = [];

    const mw: Middleware = {
      name: "dynamic",
      enabled: (config) => config.modelName === "gpt-4o",
      beforeModel: async () => { order.push("dynamic"); },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    await chain.runBeforeModel(makeState(), testConfig);
    expect(order).toEqual(["dynamic"]);

    order.length = 0;
    await chain.runBeforeModel(makeState(), { ...testConfig, modelName: "other" });
    expect(order).toEqual([]);
  });

  it("should run afterModel and allow response modification", async () => {
    const mw: Middleware = {
      name: "modifier",
      enabled: true,
      afterModel: async (_state, response) => {
        return {
          stateUpdates: { title: "Auto Title" },
        };
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    const response = new AIMessage("test response");
    const result = await chain.runAfterModel(makeState(), response, testConfig);

    expect(result.stateUpdates.title).toBe("Auto Title");
    expect(result.response.content).toBe("test response");
  });

  it("should pass modified messages through beforeModel chain", async () => {
    const mw: Middleware = {
      name: "injector",
      enabled: true,
      beforeModel: async (state) => {
        return {
          messages: [...state.messages, new HumanMessage("injected")],
        };
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    const result = await chain.runBeforeModel(makeState(), testConfig);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].content).toBe("injected");
  });
});
