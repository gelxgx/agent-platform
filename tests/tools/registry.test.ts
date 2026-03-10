import { describe, it, expect, beforeEach } from "vitest";
import { getAvailableTools, getAllTools, getToolByName } from "../../src/tools/registry.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Tool Registry", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should return enabled tools from config", () => {
    const tools = getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t) => t.name);
    expect(names).toContain("web_search");
    expect(names).toContain("read_file");
  });

  it("should include bash_exec and python_exec in available tools", () => {
    const tools = getAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("bash_exec");
    expect(names).toContain("python_exec");
  });

  it("should find tool by name", () => {
    const tool = getToolByName("web_search");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("web_search");
  });

  it("should return undefined for unknown tool", () => {
    const tool = getToolByName("nonexistent");
    expect(tool).toBeUndefined();
  });

  it("getAllTools should include builtins (and MCP tools when loaded)", () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("web_search");
    expect(names).toContain("bash_exec");
  });
});
