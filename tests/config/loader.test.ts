import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, getModelConfig, resetConfigCache } from "../../src/config/loader.js";
import path from "node:path";

describe("Config Loader", () => {
  beforeEach(() => resetConfigCache());

  it("should load config.yaml from project root", () => {
    const config = loadConfig(path.resolve("config.yaml"));
    expect(config.models).toBeDefined();
    expect(config.models.length).toBeGreaterThan(0);
  });

  it("should resolve $ENV_VAR references", () => {
    process.env.TEST_API_KEY = "test-key-123";
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    const model = config.models[0];
    expect(model.apiKey).not.toContain("$");
  });

  it("should throw for unknown model name", () => {
    loadConfig(path.resolve("config.yaml"));
    expect(() => getModelConfig("nonexistent")).toThrow('Model "nonexistent" not found');
  });
});
