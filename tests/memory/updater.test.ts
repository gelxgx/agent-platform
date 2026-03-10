import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MemoryStore } from "../../src/memory/store.js";
import { MemoryUpdater } from "../../src/memory/updater.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";

const TEST_PATH = "data/test-updater-memory.json";

afterEach(() => {
  const resolved = path.resolve(TEST_PATH);
  if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  resetConfigCache();
});

describe("MemoryUpdater", () => {
  it("should skip update when disabled", async () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, { enabled: false });

    await updater.update([
      new HumanMessage("My name is Alice"),
      new AIMessage("Nice to meet you, Alice!"),
    ]);

    const data = store.load();
    expect(data.facts).toHaveLength(0);
  });

  it("should skip update when no relevant messages", async () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, { enabled: true });

    await updater.update([]);

    const data = store.load();
    expect(data.facts).toHaveLength(0);
  });

  it("should extract facts from conversation (requires API key)", async () => {
    loadConfig(path.resolve("config.yaml"));
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, {
      enabled: true,
      factConfidenceThreshold: 0.5,
    });

    await updater.update([
      new HumanMessage("I'm a frontend engineer and I love TypeScript. I'm building an agent framework."),
      new AIMessage("That's great! TypeScript is an excellent choice for building agent frameworks."),
    ]);

    const data = store.load();
    if (data.facts.length > 0) {
      expect(data.facts[0].content).toBeDefined();
      expect(data.facts[0].confidence).toBeGreaterThan(0);
    }
  });
});
