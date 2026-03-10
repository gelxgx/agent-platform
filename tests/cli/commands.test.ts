import { describe, it, expect, beforeEach } from "vitest";
import { handleCommand } from "../../src/cli/commands.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("CLI Commands", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should not handle non-command input", () => {
    const result = handleCommand("hello world");
    expect(result.handled).toBe(false);
  });

  it("should handle /quit", () => {
    const result = handleCommand("/quit");
    expect(result.handled).toBe(true);
    expect(result.shouldQuit).toBe(true);
  });

  it("should handle /new", () => {
    const result = handleCommand("/new");
    expect(result.handled).toBe(true);
    expect(result.output).toBe("NEW_THREAD");
  });

  it("should handle /models", () => {
    const result = handleCommand("/models");
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Available models");
  });

  it("should handle /model with argument", () => {
    const result = handleCommand("/model gpt-5.2");
    expect(result.handled).toBe(true);
    expect(result.output).toBe("MODEL_SWITCH:gpt-5.2");
  });

  it("should handle /memory", () => {
    const result = handleCommand("/memory");
    expect(result.handled).toBe(true);
    expect(result.output).toBe("SHOW_MEMORY");
  });

  it("should handle /skills", () => {
    const result = handleCommand("/skills");
    expect(result.handled).toBe(true);
    expect(result.output).toBe("SHOW_SKILLS");
  });

  it("should handle /mcp", () => {
    const result = handleCommand("/mcp");
    expect(result.handled).toBe(true);
    expect(result.output).toBe("SHOW_MCP");
  });

  it("should handle /help and include /mcp", () => {
    const result = handleCommand("/help");
    expect(result.handled).toBe(true);
    expect(result.output).toContain("/mcp");
    expect(result.output).toContain("MCP server");
  });

  it("should handle unknown commands", () => {
    const result = handleCommand("/unknown");
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Unknown command");
  });
});
