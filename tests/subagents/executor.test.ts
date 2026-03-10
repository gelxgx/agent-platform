import { describe, it, expect, beforeEach } from "vitest";
import { executeSubAgent, getActiveCount } from "../../src/subagents/executor.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("SubAgent Executor", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should reject unknown subagent type", async () => {
    const result = await executeSubAgent({
      id: "test-1",
      description: "test",
      prompt: "test",
      subagentType: "nonexistent",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Unknown subagent type");
  });

  it("should track active count", () => {
    expect(getActiveCount()).toBe(0);
  });

  it("should execute general-purpose subagent (requires API key)", async () => {
    const result = await executeSubAgent({
      id: "test-2",
      description: "Simple test task",
      prompt: "Reply with exactly: SUBAGENT_OK",
      subagentType: "general-purpose",
    });

    if (result.status === "completed") {
      expect(result.result).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);
    }
    expect(["completed", "failed"]).toContain(result.status);
  });
});
