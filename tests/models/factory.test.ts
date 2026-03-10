import { describe, it, expect, beforeEach } from "vitest";
import { registerProvider } from "../../src/models/factory.js";
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

  it("should throw for unknown provider", async () => {
    const { createChatModel } = await import("../../src/models/factory.js");
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
    registerProvider("__test__", undefined as any);
  });
});
