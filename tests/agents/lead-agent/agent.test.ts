import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

describe("Lead Agent", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    // Override checkpointer path to use temp directory for tests
    (config as any).checkpointer = {
      provider: "sqlite",
      path: path.join(tmpDir, "test-checkpoints.db"),
    };
  });

  afterEach(() => {
    resetConfigCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
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

  it("should create sqlite checkpoint database file", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    await createLeadAgent();
    const dbPath = path.join(tmpDir, "test-checkpoints.db");
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("should use MemorySaver when provider is memory", async () => {
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    (config as any).checkpointer = { provider: "memory" };

    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
  });
});
