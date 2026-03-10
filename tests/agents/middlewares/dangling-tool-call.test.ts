import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { danglingToolCallMiddleware } from "../../../src/agents/middlewares/dangling-tool-call.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const config: RuntimeConfig = { modelName: "gpt-4o", threadId: "test" };

function makeState(messages: any[]): AgentStateType {
  return {
    messages,
    threadId: "test",
    title: undefined,
    artifacts: [],
    threadData: undefined,
  } as AgentStateType;
}

describe("DanglingToolCallMiddleware", () => {
  it("should not modify messages when all tool calls have responses", async () => {
    const messages = [
      new HumanMessage("search for cats"),
      new AIMessage({
        content: "",
        tool_calls: [{ id: "tc1", name: "web_search", args: { query: "cats" } }],
      }),
      new ToolMessage({ tool_call_id: "tc1", content: "Found cats info" }),
      new AIMessage("Here are the results about cats."),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should inject placeholder for dangling tool calls", async () => {
    const messages = [
      new HumanMessage("search for cats"),
      new AIMessage({
        content: "",
        tool_calls: [{ id: "tc1", name: "web_search", args: { query: "cats" } }],
      }),
      new HumanMessage("never mind, tell me about dogs"),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );

    expect(result).toBeDefined();
    expect(result!.messages).toBeDefined();
    const patched = result!.messages!;
    expect(patched).toHaveLength(4);
    expect(ToolMessage.isInstance(patched[2])).toBe(true);
    expect((patched[2] as ToolMessage).content).toContain("interrupted");
  });

  it("should handle multiple dangling tool calls in one AIMessage", async () => {
    const messages = [
      new HumanMessage("do two things"),
      new AIMessage({
        content: "",
        tool_calls: [
          { id: "tc1", name: "web_search", args: { query: "a" } },
          { id: "tc2", name: "read_file", args: { filePath: "b" } },
        ],
      }),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );

    expect(result!.messages).toHaveLength(4);
    const toolMsgs = result!.messages!.filter((m) => ToolMessage.isInstance(m));
    expect(toolMsgs).toHaveLength(2);
  });
});
