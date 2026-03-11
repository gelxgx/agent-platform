import { describe, it, expect, vi, afterEach } from "vitest";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { estimateTokens, getModelMaxTokens } from "../../src/utils/token-estimator.js";

describe("estimateTokens", () => {
  it("should estimate tokens from string content messages", () => {
    const messages = [
      new HumanMessage("hello world"),
      new AIMessage("hi there!"),
    ];
    // "hello world" = 11 chars, "hi there!" = 9 chars → total 20 chars → ceil(20/4) = 5
    expect(estimateTokens(messages)).toBe(5);
  });

  it("should return 0 for empty message list", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("should handle long messages", () => {
    const longText = "a".repeat(1000);
    const messages = [new HumanMessage(longText)];
    // 1000 chars → ceil(1000/4) = 250
    expect(estimateTokens(messages)).toBe(250);
  });

  it("should handle multiple message types", () => {
    const messages = [
      new SystemMessage("You are a helpful assistant"),
      new HumanMessage("What is 2+2?"),
      new AIMessage("2+2 equals 4"),
    ];
    // 27 + 12 + 12 = 51 chars → ceil(51/4) = 13
    expect(estimateTokens(messages)).toBe(13);
  });
});

describe("getModelMaxTokens", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return default 128000 when config is not available", () => {
    expect(getModelMaxTokens("nonexistent-model")).toBe(128_000);
  });
});
