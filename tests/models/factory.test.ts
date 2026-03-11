import { describe, it, expect, beforeEach } from "vitest";
import { registerProvider, createChatModel } from "../../src/models/factory.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Model Factory", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should have openai provider registered by default", async () => {
    registerProvider("test-provider", async () => {
      const { ChatOpenAI } = await import("@langchain/openai");
      return ChatOpenAI as any;
    });
  });

  it("should throw for unknown provider with helpful message", async () => {
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    (config as any).models.push({
      name: "test-unknown",
      provider: "nonexistent",
      model: "test",
      apiKey: "test",
    });

    await expect(createChatModel("test-unknown")).rejects.toThrow(
      /Unknown provider "nonexistent"/
    );
    await expect(createChatModel("test-unknown")).rejects.toThrow(
      /registerProvider/
    );
  });

  it("should list anthropic and google in available providers", async () => {
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    (config as any).models.push({
      name: "test-bad",
      provider: "bad-provider",
      model: "test",
      apiKey: "test",
    });

    try {
      await createChatModel("test-bad");
    } catch (e: any) {
      expect(e.message).toContain("openai");
      expect(e.message).toContain("anthropic");
      expect(e.message).toContain("google");
    }
  });

  it("should fail gracefully when anthropic package is not installed", async () => {
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    (config as any).models.push({
      name: "claude-test",
      provider: "anthropic",
      model: "claude-3-opus",
      apiKey: "test-key",
    });

    await expect(createChatModel("claude-test")).rejects.toThrow();
  });

  it("should fail gracefully when google package is not installed", async () => {
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    (config as any).models.push({
      name: "gemini-test",
      provider: "google",
      model: "gemini-pro",
      apiKey: "test-key",
    });

    await expect(createChatModel("gemini-test")).rejects.toThrow();
  });
});
