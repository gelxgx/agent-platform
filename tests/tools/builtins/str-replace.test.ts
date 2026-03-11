import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

vi.mock("../../../src/config/loader.js", () => ({
  loadConfig: () => ({ sandbox: { enabled: false } }),
}));

import { strReplaceTool } from "../../../src/tools/builtins/str-replace.js";

describe("strReplaceTool", () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "str-replace-test-"));
    testFile = path.join(tmpDir, "test.txt");
    fs.writeFileSync(testFile, "Hello World\nThis is a test\nGoodbye World\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should have the correct tool name", () => {
    expect(strReplaceTool.name).toBe("str_replace");
  });

  it("should replace a unique string", async () => {
    const result = await strReplaceTool.invoke({
      filePath: testFile,
      oldStr: "Hello World",
      newStr: "Hi Universe",
    });

    expect(result).toContain("Replaced 1 occurrence");
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("Hi Universe");
    expect(content).not.toContain("Hello World");
  });

  it("should report not found when string doesn't exist", async () => {
    const result = await strReplaceTool.invoke({
      filePath: testFile,
      oldStr: "nonexistent string",
      newStr: "replacement",
    });

    expect(result).toContain("String not found");
  });

  it("should reject multiple occurrences", async () => {
    const result = await strReplaceTool.invoke({
      filePath: testFile,
      oldStr: "World",
      newStr: "Earth",
    });

    expect(result).toContain("Found 2 occurrences");
    expect(result).toContain("more context");
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("Hello World");
  });

  it("should report file not found", async () => {
    const result = await strReplaceTool.invoke({
      filePath: path.join(tmpDir, "nonexistent.txt"),
      oldStr: "foo",
      newStr: "bar",
    });

    expect(result).toContain("File not found");
  });

  it("should preserve the rest of the file unchanged", async () => {
    await strReplaceTool.invoke({
      filePath: testFile,
      oldStr: "This is a test",
      newStr: "This was changed",
    });

    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toBe("Hello World\nThis was changed\nGoodbye World\n");
  });
});
