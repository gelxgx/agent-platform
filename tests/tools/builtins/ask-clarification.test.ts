import { describe, it, expect } from "vitest";
import { askClarificationTool } from "../../../src/tools/builtins/ask-clarification.js";

describe("askClarificationTool", () => {
  it("should return text with CLARIFICATION_NEEDED prefix", async () => {
    const result = await askClarificationTool.invoke({
      question: "Which file do you want me to edit?",
    });
    expect(result).toBe("[CLARIFICATION_NEEDED] Which file do you want me to edit?");
  });

  it("should include the question in the output", async () => {
    const question = "Do you want TypeScript or JavaScript?";
    const result = await askClarificationTool.invoke({ question });
    expect(result).toContain(question);
    expect(result).toMatch(/^\[CLARIFICATION_NEEDED\]/);
  });

  it("should have the correct tool name", () => {
    expect(askClarificationTool.name).toBe("ask_clarification");
  });
});
