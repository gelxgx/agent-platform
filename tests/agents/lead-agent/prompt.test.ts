import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../../src/agents/lead-agent/prompt.js";
import type { MemoryData } from "../../../src/memory/types.js";
import type { SandboxContext } from "../../../src/agents/lead-agent/prompt.js";

describe("buildSystemPrompt", () => {
  it("should return base prompt without memory", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("agent-platform");
    expect(prompt).not.toContain("<memory>");
  });

  it("should inject memory section when provided", () => {
    const memory: MemoryData = {
      userContext: {
        workContext: "Frontend engineer at Acme",
        personalContext: "Prefers concise answers",
        topOfMind: "Building an agent framework",
      },
      facts: [
        { id: "1", content: "Uses TypeScript", category: "preference", confidence: 0.9, createdAt: "" },
        { id: "2", content: "Familiar with Koa", category: "knowledge", confidence: 0.8, createdAt: "" },
      ],
      lastUpdated: "",
    };

    const prompt = buildSystemPrompt({ memory });
    expect(prompt).toContain("<memory>");
    expect(prompt).toContain("Frontend engineer at Acme");
    expect(prompt).toContain("Uses TypeScript");
    expect(prompt).toContain("Familiar with Koa");
    expect(prompt).toContain("</memory>");
  });

  it("should limit facts to top 15 by confidence (default)", () => {
    const facts = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      content: `Fact ${i}`,
      category: "knowledge" as const,
      confidence: i / 20,
      createdAt: "",
    }));

    const memory: MemoryData = {
      userContext: { workContext: "", personalContext: "", topOfMind: "" },
      facts,
      lastUpdated: "",
    };

    const prompt = buildSystemPrompt({ memory });
    const factLines = prompt.split("\n").filter((l) => l.startsWith("- Fact"));
    expect(factLines.length).toBe(15);
  });

  it("should respect custom maxInjectionFacts", () => {
    const facts = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      content: `Fact ${i}`,
      category: "knowledge" as const,
      confidence: i / 20,
      createdAt: "",
    }));

    const memory: MemoryData = {
      userContext: { workContext: "", personalContext: "", topOfMind: "" },
      facts,
      lastUpdated: "",
    };

    const prompt5 = buildSystemPrompt({ memory, maxInjectionFacts: 5 });
    const factLines5 = prompt5.split("\n").filter((l) => l.startsWith("- Fact"));
    expect(factLines5.length).toBe(5);

    const prompt30 = buildSystemPrompt({ memory, maxInjectionFacts: 30 });
    const factLines30 = prompt30.split("\n").filter((l) => l.startsWith("- Fact"));
    expect(factLines30.length).toBe(20);
  });

  it("should include MCP tool names when provided", () => {
    const prompt = buildSystemPrompt({
      mcpToolNames: ["mcp_filesystem_read", "mcp_github_search"],
    });
    expect(prompt).toContain("External Tools (MCP)");
    expect(prompt).toContain("mcp_filesystem_read");
    expect(prompt).toContain("mcp_github_search");
  });

  it("should not include MCP section when no tools provided", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toContain("External Tools (MCP)");
  });

  it("should include sandbox section when context provided", () => {
    const sandboxContext: SandboxContext = {
      workspace: "/workspace",
      files: ["main.py", "README.md"],
    };
    const prompt = buildSystemPrompt({ sandboxContext });
    expect(prompt).toContain("Sandbox Environment");
    expect(prompt).toContain("`/workspace`");
    expect(prompt).toContain("bash_exec");
    expect(prompt).toContain("python_exec");
    expect(prompt).toContain("main.py");
    expect(prompt).toContain("README.md");
  });

  it("should not include workspace contents when files list is empty", () => {
    const sandboxContext: SandboxContext = {
      workspace: "/workspace",
      files: [],
    };
    const prompt = buildSystemPrompt({ sandboxContext });
    expect(prompt).toContain("Sandbox Environment");
    expect(prompt).not.toContain("Current workspace contents");
  });
});
