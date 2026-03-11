import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockLoad = vi.fn();
const mockSave = vi.fn();

vi.mock("../../../src/memory/store.js", () => {
  return {
    MemoryStore: class {
      load = mockLoad;
      save = mockSave;
    },
  };
});

vi.mock("../../../src/config/loader.js", () => ({
  loadConfig: vi.fn(() => ({
    memory: { storagePath: "data/memory.json" },
  })),
}));

const { memory } = await import("../../../src/gateway/routes/memory.js");

describe("Memory API", () => {
  const app = new Hono();
  app.route("/api/memory", memory);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/memory should return memory data", async () => {
    const memoryData = {
      userContext: { workContext: "", personalContext: "", topOfMind: "" },
      facts: [{ id: "1", content: "test fact", category: "knowledge", confidence: 0.9, createdAt: "2026-01-01" }],
      lastUpdated: "2026-01-01",
    };
    mockLoad.mockReturnValue(memoryData);

    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.facts).toHaveLength(1);
    expect(body.facts[0].content).toBe("test fact");
  });

  it("DELETE /api/memory/facts should clear facts", async () => {
    mockLoad.mockReturnValue({
      userContext: { workContext: "", personalContext: "", topOfMind: "" },
      facts: [{ id: "1", content: "old fact" }],
      lastUpdated: "2026-01-01",
    });

    const res = await app.request("/api/memory/facts", { method: "DELETE" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Facts cleared");

    expect(mockSave).toHaveBeenCalledOnce();
    const savedData = mockSave.mock.calls[0][0];
    expect(savedData.facts).toHaveLength(0);
  });
});
