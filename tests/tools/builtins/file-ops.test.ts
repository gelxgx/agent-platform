import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileTool, writeFileTool } from "../../../src/tools/builtins/file-ops.js";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import fs from "node:fs";
import path from "node:path";

const TEST_THREAD = "file-ops-test-thread";
const THREAD_WORKSPACE = path.resolve(`data/threads/${TEST_THREAD}/workspace`);

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

describe("read_file tool", () => {
  it("should have correct metadata", () => {
    expect(readFileTool.name).toBe("read_file");
    expect(readFileTool.description).toContain("Read");
  });

  it("should resolve paths through sandbox when enabled", async () => {
    const testDir = path.join(THREAD_WORKSPACE, "test-read");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "hello.txt"), "sandbox content", "utf-8");

    const result = await readFileTool.invoke(
      { filePath: "/workspace/test-read/hello.txt" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toBe("sandbox content");
  });

  it("should support line range in sandbox mode", async () => {
    const testDir = path.join(THREAD_WORKSPACE, "test-lines");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, "lines.txt"),
      "line1\nline2\nline3\nline4\nline5",
      "utf-8"
    );

    const result = await readFileTool.invoke(
      { filePath: "/workspace/test-lines/lines.txt", startLine: 2, endLine: 4 },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toBe("line2\nline3\nline4");
  });

  it("should map absolute paths into sandbox (no escape)", async () => {
    // /etc/passwd → path.join maps to data/threads/{id}/workspace/etc/passwd (safe, just ENOENT)
    const result = await readFileTool.invoke(
      { filePath: "/etc/passwd" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("Failed to read file");
    // The real /etc/passwd is NOT accessed; path is remapped into sandbox
    expect(result).toContain(`data/threads/${TEST_THREAD}/workspace/etc/passwd`);
  });

  it("should block relative path escape (../../)", async () => {
    const result = await readFileTool.invoke(
      { filePath: "/workspace/../../etc/passwd" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("Failed to read file");
    expect(result).toContain("outside the thread sandbox");
  });
});

describe("write_file tool", () => {
  it("should have correct metadata", () => {
    expect(writeFileTool.name).toBe("write_file");
    expect(writeFileTool.description).toContain("Write");
  });

  it("should write files inside sandbox", async () => {
    const result = await writeFileTool.invoke(
      { filePath: "/workspace/test-write/output.txt", content: "hello sandbox" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("File written");

    const physical = path.join(THREAD_WORKSPACE, "test-write", "output.txt");
    const content = fs.readFileSync(physical, "utf-8");
    expect(content).toBe("hello sandbox");
  });

  it("should append content in sandbox mode", async () => {
    await writeFileTool.invoke(
      { filePath: "/workspace/test-append/log.txt", content: "first\n" },
      { configurable: { threadId: TEST_THREAD } }
    );

    const result = await writeFileTool.invoke(
      { filePath: "/workspace/test-append/log.txt", content: "second\n", append: true },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("Content appended");

    const physical = path.join(THREAD_WORKSPACE, "test-append", "log.txt");
    const content = fs.readFileSync(physical, "utf-8");
    expect(content).toBe("first\nsecond\n");
  });

  it("should map absolute paths into sandbox on write (no escape)", async () => {
    // /tmp/escape-test.txt → mapped inside sandbox as workspace/tmp/escape-test.txt
    const result = await writeFileTool.invoke(
      { filePath: "/tmp/escape-test.txt", content: "bad" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("File written");
    // Verify the file is physically inside the sandbox, not at /tmp/
    const physical = path.join(THREAD_WORKSPACE, "tmp", "escape-test.txt");
    expect(fs.existsSync(physical)).toBe(true);
    expect(fs.existsSync("/tmp/escape-test.txt")).toBe(false);
  });

  it("should block relative path escape on write", async () => {
    const result = await writeFileTool.invoke(
      { filePath: "/workspace/../../outside.txt", content: "bad" },
      { configurable: { threadId: TEST_THREAD } }
    );

    expect(result).toContain("Failed to write file");
    expect(result).toContain("outside the thread sandbox");
  });
});

describe("sandbox disabled", () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it("should use path.resolve when sandbox is disabled", async () => {
    const tmpFile = path.resolve("data/test-no-sandbox.txt");
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, "no sandbox", "utf-8");

    const configContent = fs.readFileSync(path.resolve("config.yaml"), "utf-8");
    const disabledConfig = configContent.replace(
      /sandbox:\n\s+enabled: true/,
      "sandbox:\n  enabled: false"
    );
    const tmpConfig = path.resolve("data/test-config-disabled.yaml");
    fs.writeFileSync(tmpConfig, disabledConfig, "utf-8");
    resetConfigCache();
    loadConfig(tmpConfig);

    try {
      const result = await readFileTool.invoke(
        { filePath: tmpFile },
        { configurable: { threadId: "any" } }
      );
      expect(result).toBe("no sandbox");
    } finally {
      fs.rmSync(tmpFile, { force: true });
      fs.rmSync(tmpConfig, { force: true });
      resetConfigCache();
      loadConfig(path.resolve("config.yaml"));
    }
  });
});
