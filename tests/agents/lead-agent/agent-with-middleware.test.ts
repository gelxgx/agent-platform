import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";

const TEST_THREAD_ID = "test-middleware-integration";
const THREAD_DIR = path.resolve(`data/threads/${TEST_THREAD_ID}`);

describe("Lead Agent with Middleware", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  afterEach(() => {
    if (fs.existsSync(THREAD_DIR)) {
      fs.rmSync(THREAD_DIR, { recursive: true, force: true });
    }
  });

  it("should create agent with middleware chain", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
  });

  it("should create thread directories via ThreadDataMiddleware", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();

    const result = await agent.invoke({
      messages: [new HumanMessage("Just say hi in one word.")],
      threadId: TEST_THREAD_ID,
    });

    expect(result.messages.length).toBeGreaterThan(1);
    expect(fs.existsSync(path.join(THREAD_DIR, "workspace"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "uploads"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "outputs"))).toBe(true);
  });
});
