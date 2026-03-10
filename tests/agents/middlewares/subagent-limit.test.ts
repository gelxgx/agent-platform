import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { subagentLimitMiddleware } from "../../../src/agents/middlewares/subagent-limit.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const enabledConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test",
  subagentEnabled: true,
};

const disabledConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test",
  subagentEnabled: false,
};

const state = {
  messages: [new HumanMessage("test")],
  threadId: "test",
  title: undefined,
  artifacts: [],
  threadData: undefined,
} as AgentStateType;

describe("SubagentLimitMiddleware", () => {
  it("should be disabled when subagentEnabled is false", () => {
    const enabled = typeof subagentLimitMiddleware.enabled === "function"
      ? subagentLimitMiddleware.enabled(disabledConfig)
      : subagentLimitMiddleware.enabled;
    expect(enabled).toBe(false);
  });

  it("should not modify response with <= 3 task calls", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        { id: "1", name: "task", args: { description: "a", prompt: "a", subagentType: "general-purpose" } },
        { id: "2", name: "task", args: { description: "b", prompt: "b", subagentType: "general-purpose" } },
      ],
    });

    const result = await subagentLimitMiddleware.afterModel!(state, response, enabledConfig);
    expect(result).toBeUndefined();
  });

  it("should truncate task calls exceeding limit", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        { id: "1", name: "task", args: {} },
        { id: "2", name: "task", args: {} },
        { id: "3", name: "task", args: {} },
        { id: "4", name: "task", args: {} },
        { id: "5", name: "web_search", args: {} },
      ],
    });

    const result = await subagentLimitMiddleware.afterModel!(state, response, enabledConfig);
    expect(result).toBeDefined();
    const calls = result!.response!.tool_calls!;
    const taskCount = calls.filter((c) => c.name === "task").length;
    const searchCount = calls.filter((c) => c.name === "web_search").length;
    expect(taskCount).toBe(3);
    expect(searchCount).toBe(1);
  });
});
