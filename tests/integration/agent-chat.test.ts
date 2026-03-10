import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Agent Chat Integration", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should respond to a simple greeting", async () => {
    const { createLeadAgent } = await import(
      "../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    const result = await agent.invoke(
      {
        messages: [new HumanMessage("Hello! Just say 'Hi' back in one word.")],
        threadId: "test-thread",
      },
      { configurable: { thread_id: "test-thread" } }
    );
    expect(result.messages.length).toBeGreaterThan(1);
    const lastMessage = result.messages.at(-1);
    expect(lastMessage?.content).toBeDefined();
  });
});
