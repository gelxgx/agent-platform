import { describe, it, expect, beforeEach } from "vitest";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import path from "node:path";

describe("Lead Agent", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should create agent with tools bound", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
    expect(typeof agent.stream).toBe("function");
  });
});
