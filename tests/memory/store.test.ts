import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MemoryStore } from "../../src/memory/store.js";
import { EMPTY_MEMORY, type MemoryData } from "../../src/memory/types.js";

const TEST_PATH = "data/test-memory.json";

afterEach(() => {
  if (fs.existsSync(path.resolve(TEST_PATH))) {
    fs.unlinkSync(path.resolve(TEST_PATH));
  }
});

describe("MemoryStore", () => {
  it("should return empty memory when file does not exist", () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const data = store.load();
    expect(data.facts).toEqual([]);
    expect(data.userContext.workContext).toBe("");
  });

  it("should save and load memory data", () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const testData: MemoryData = {
      userContext: {
        workContext: "Frontend engineer",
        personalContext: "Loves TypeScript",
        topOfMind: "Building an agent framework",
      },
      facts: [
        {
          id: "f1",
          content: "User prefers TypeScript",
          category: "preference",
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    store.save(testData);
    const loaded = store.load();
    expect(loaded.userContext.workContext).toBe("Frontend engineer");
    expect(loaded.facts).toHaveLength(1);
    expect(loaded.facts[0].content).toBe("User prefers TypeScript");
  });

  it("should use mtime cache on repeated loads", () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const testData: MemoryData = {
      ...EMPTY_MEMORY,
      userContext: { ...EMPTY_MEMORY.userContext, workContext: "Test" },
      lastUpdated: new Date().toISOString(),
    };

    store.save(testData);
    const load1 = store.load();
    const load2 = store.load();
    // Same reference from cache
    expect(load1).toBe(load2);
  });

  it("should detect external file changes via mtime", () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const testData: MemoryData = {
      ...EMPTY_MEMORY,
      lastUpdated: new Date().toISOString(),
    };
    store.save(testData);
    store.load(); // populate cache

    // Simulate external modification
    const modified: MemoryData = {
      ...EMPTY_MEMORY,
      userContext: { ...EMPTY_MEMORY.userContext, workContext: "External change" },
      lastUpdated: new Date().toISOString(),
    };
    const filePath = path.resolve(TEST_PATH);
    fs.writeFileSync(filePath, JSON.stringify(modified, null, 2));

    store.invalidateCache();
    const reloaded = store.load();
    expect(reloaded.userContext.workContext).toBe("External change");
  });
});
