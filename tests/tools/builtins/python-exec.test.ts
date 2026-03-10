import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { pythonExecTool } from "../../../src/tools/builtins/python-exec.js";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import fs from "node:fs";
import path from "node:path";

const TEST_THREAD = "python-exec-test-thread";

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

describe("python_exec tool", () => {
  it("should have correct metadata", () => {
    expect(pythonExecTool.name).toBe("python_exec");
    expect(pythonExecTool.description).toContain("Python");
  });

  it("should execute simple Python code", async () => {
    const result = await pythonExecTool.invoke(
      { code: "print(1 + 1)" },
      { configurable: { threadId: TEST_THREAD } }
    );
    expect(result).toContain("Exit code: 0");
    expect(result).toContain("2");
  });

  it("should handle Python errors", async () => {
    const result = await pythonExecTool.invoke(
      { code: "raise ValueError('test error')" },
      { configurable: { threadId: TEST_THREAD } }
    );
    expect(result).toContain("Exit code: 1");
    expect(result).toContain("ValueError");
  });

  it("should clean up temp files after execution", async () => {
    await pythonExecTool.invoke(
      { code: "print('hello')" },
      { configurable: { threadId: TEST_THREAD } }
    );

    const workspace = path.resolve(`data/threads/${TEST_THREAD}/workspace`);
    if (fs.existsSync(workspace)) {
      const files = fs.readdirSync(workspace);
      const tmpFiles = files.filter((f) => f.startsWith("_tmp_") && f.endsWith(".py"));
      expect(tmpFiles).toHaveLength(0);
    }
  });
});
