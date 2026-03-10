import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { bashExecTool } from "../../../src/tools/builtins/bash-exec.js";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import fs from "node:fs";
import path from "node:path";

const TEST_THREAD = "bash-exec-test-thread";

beforeEach(() => {
  resetConfigCache();
  loadConfig(path.resolve("config.yaml"));
});

afterAll(() => {
  fs.rmSync(path.resolve(`data/threads/${TEST_THREAD}`), {
    recursive: true,
    force: true,
  });
});

describe("bash_exec tool", () => {
  it("should have correct metadata", () => {
    expect(bashExecTool.name).toBe("bash_exec");
    expect(bashExecTool.description).toContain("bash command");
  });

  it("should execute a simple command", async () => {
    const mockRunManager = {
      config: { configurable: { threadId: TEST_THREAD } },
    };
    const result = await bashExecTool.invoke(
      { command: 'echo "test output"' },
      { configurable: { threadId: TEST_THREAD } }
    );
    expect(result).toContain("Exit code: 0");
    expect(result).toContain("test output");
  });

  it("should handle command errors", async () => {
    const result = await bashExecTool.invoke(
      { command: "exit 1" },
      { configurable: { threadId: TEST_THREAD } }
    );
    expect(result).toContain("Exit code: 1");
  });

  it("should report blocked commands", async () => {
    const result = await bashExecTool.invoke(
      { command: "rm -rf /" },
      { configurable: { threadId: TEST_THREAD } }
    );
    expect(result).toContain("Error:");
    expect(result).toContain("blocked");
  });
});
