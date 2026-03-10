import { describe, it, expect } from "vitest";
import {
  getSubAgent,
  listSubAgents,
  registerSubAgent,
} from "../../src/subagents/registry.js";

describe("SubAgent Registry", () => {
  it("should have built-in general-purpose agent", () => {
    const agent = getSubAgent("general-purpose");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("general-purpose");
  });

  it("should have built-in bash agent", () => {
    const agent = getSubAgent("bash");
    expect(agent).toBeDefined();
    expect(agent!.allowedTools).toContain("read_file");
  });

  it("should list all registered agents", () => {
    const agents = listSubAgents();
    expect(agents.length).toBeGreaterThanOrEqual(2);
    const names = agents.map((a) => a.name);
    expect(names).toContain("general-purpose");
    expect(names).toContain("bash");
  });

  it("should allow registering custom agents", () => {
    registerSubAgent({
      name: "test-agent",
      description: "Test",
      systemPrompt: "Test prompt",
    });
    expect(getSubAgent("test-agent")).toBeDefined();
  });

  it("should return undefined for unknown agent", () => {
    expect(getSubAgent("nonexistent")).toBeUndefined();
  });
});
