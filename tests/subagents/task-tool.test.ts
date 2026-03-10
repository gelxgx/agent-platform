import { describe, it, expect, beforeEach } from "vitest";
import { createTaskTool } from "../../src/subagents/task-tool.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Task Tool", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should create task tool with correct name and schema", () => {
    const tool = createTaskTool();
    expect(tool.name).toBe("task");
    expect(tool.description).toContain("Delegate");
    expect(tool.description).toContain("general-purpose");
    expect(tool.description).toContain("bash");
  });
});
