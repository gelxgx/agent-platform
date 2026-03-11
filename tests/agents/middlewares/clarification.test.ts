import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { clarificationMiddleware } from "../../../src/agents/middlewares/clarification.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

function makeState(): AgentStateType {
  return {
    messages: [new HumanMessage("hello")],
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
  } as AgentStateType;
}

const runtimeConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test-thread",
};

describe("ClarificationMiddleware", () => {
  it("should not intervene when response has no ask_clarification call", async () => {
    const response = new AIMessage("Here is the answer");
    const result = await clarificationMiddleware.afterModel!(
      makeState(),
      response,
      runtimeConfig
    );
    expect(result).toBeUndefined();
  });

  it("should set _clarificationNeeded when ask_clarification is called", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_123",
          name: "ask_clarification",
          args: { question: "Which file do you mean?" },
          type: "tool_call" as const,
        },
      ],
    });

    const result = await clarificationMiddleware.afterModel!(
      makeState(),
      response,
      runtimeConfig
    );

    expect(result).toBeDefined();
    expect((result!.stateUpdates as any)._clarificationNeeded).toEqual({
      question: "Which file do you mean?",
      toolCallId: "call_123",
    });
  });

  it("should extract question text correctly", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_456",
          name: "ask_clarification",
          args: { question: "Do you want TypeScript or JavaScript?" },
          type: "tool_call" as const,
        },
      ],
    });

    const result = await clarificationMiddleware.afterModel!(
      makeState(),
      response,
      runtimeConfig
    );

    expect((result!.stateUpdates as any)._clarificationNeeded.question).toBe(
      "Do you want TypeScript or JavaScript?"
    );
  });

  it("should use default question when args.question is missing", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_789",
          name: "ask_clarification",
          args: {},
          type: "tool_call" as const,
        },
      ],
    });

    const result = await clarificationMiddleware.afterModel!(
      makeState(),
      response,
      runtimeConfig
    );

    expect((result!.stateUpdates as any)._clarificationNeeded.question).toBe(
      "Could you provide more details?"
    );
  });

  it("should ignore other tool calls", async () => {
    const response = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_other",
          name: "web_search",
          args: { query: "test" },
          type: "tool_call" as const,
        },
      ],
    });

    const result = await clarificationMiddleware.afterModel!(
      makeState(),
      response,
      runtimeConfig
    );

    expect(result).toBeUndefined();
  });
});
