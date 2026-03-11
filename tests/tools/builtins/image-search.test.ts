import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { imageSearchTool } from "../../../src/tools/builtins/image-search.js";

describe("imageSearchTool", () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    process.env.TAVILY_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey !== undefined) {
      process.env.TAVILY_API_KEY = originalApiKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  it("should have the correct tool name", () => {
    expect(imageSearchTool.name).toBe("image_search");
  });

  it("should return image URLs on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [
          "https://example.com/img1.jpg",
          "https://example.com/img2.jpg",
        ],
      }),
    }) as any;

    const result = await imageSearchTool.invoke({ query: "cats" });
    expect(result).toContain("1. https://example.com/img1.jpg");
    expect(result).toContain("2. https://example.com/img2.jpg");
  });

  it("should report when no images found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [] }),
    }) as any;

    const result = await imageSearchTool.invoke({ query: "nonexistent" });
    expect(result).toContain("No images found");
  });

  it("should handle missing API key", async () => {
    delete process.env.TAVILY_API_KEY;

    const result = await imageSearchTool.invoke({ query: "cats" });
    expect(result).toContain("not available");
    expect(result).toContain("TAVILY_API_KEY");
  });

  it("should respect maxResults", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
        ],
      }),
    }) as any;

    const result = await imageSearchTool.invoke({ query: "dogs", maxResults: 2 });
    expect(result).toContain("1.");
    expect(result).toContain("2.");
    expect(result).not.toContain("3.");
  });

  it("should handle API errors gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any;

    const result = await imageSearchTool.invoke({ query: "cats" });
    expect(result).toContain("failed");
    expect(result).toContain("500");
  });
});
