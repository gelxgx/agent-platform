import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

vi.mock("../../../src/config/loader.js", () => ({
  loadConfig: () => ({ sandbox: { enabled: false } }),
}));

import { lsTool } from "../../../src/tools/builtins/ls.js";

describe("lsTool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-test-"));
    fs.writeFileSync(path.join(tmpDir, "file1.txt"), "hello");
    fs.writeFileSync(path.join(tmpDir, "file2.ts"), "code");
    fs.mkdirSync(path.join(tmpDir, "subdir"));
    fs.writeFileSync(path.join(tmpDir, "subdir", "nested.md"), "# doc");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should have the correct tool name", () => {
    expect(lsTool.name).toBe("ls");
  });

  it("should list files and directories", async () => {
    const result = await lsTool.invoke({ path: tmpDir });
    expect(result).toContain("file1.txt");
    expect(result).toContain("file2.ts");
    expect(result).toContain("subdir");
  });

  it("should show directory icons", async () => {
    const result = await lsTool.invoke({ path: tmpDir });
    expect(result).toContain("📁");
    expect(result).toContain("📄");
  });

  it("should list subdirectory contents when recursive", async () => {
    const result = await lsTool.invoke({ path: tmpDir, recursive: true });
    expect(result).toContain("nested.md");
  });

  it("should return error for non-existent directory", async () => {
    const result = await lsTool.invoke({ path: "/nonexistent/path/xyz" });
    expect(result).toContain("not found");
  });

  it("should handle empty directory", async () => {
    const emptyDir = path.join(tmpDir, "empty");
    fs.mkdirSync(emptyDir);
    const result = await lsTool.invoke({ path: emptyDir });
    expect(result).toBe("(empty directory)");
  });
});
