import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../../src/agents/lead-agent/prompt.js";
import type { MemoryData } from "../../../src/memory/types.js";

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

  it("should limit facts to top 15 by confidence", () => {
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
    expect(factLines.length).toBeLessThanOrEqual(15);
  });
});
