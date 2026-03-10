import { describe, it, expect, beforeEach } from "vitest";
import { getAvailableTools, getToolByName } from "../../src/tools/registry.js";
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

  it("should find tool by name", () => {
    const tool = getToolByName("web_search");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("web_search");
  });

  it("should return undefined for unknown tool", () => {
    const tool = getToolByName("nonexistent");
    expect(tool).toBeUndefined();
  });
});
