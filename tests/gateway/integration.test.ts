import { describe, it, expect, vi, beforeAll } from "vitest";
import { createGateway } from "../../src/gateway/server.js";

vi.mock("../../src/agents/lead-agent/agent.js", () => ({
  createLeadAgent: vi.fn(async () => ({
    invoke: vi.fn(async () => ({
      messages: [{ content: "Integration test response" }],
    })),
    stream: vi.fn(async () => {
      async function* gen() {
        yield [{ content: "Streamed " }, {}];
        yield [{ content: "response" }, {}];
      }
      return gen();
    }),
  })),
}));

describe("Gateway Integration", () => {
  const app = createGateway();

  it("GET /api/health → 200 ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /api/models → model list", async () => {
    const res = await app.request("/api/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.defaultModel).toBeDefined();
  });

  it("GET /api/skills → skills list", async () => {
    const res = await app.request("/api/skills");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toBeDefined();
    expect(Array.isArray(body.skills)).toBe(true);
  });

  it("GET /api/memory → memory data", async () => {
    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("facts");
  });

  it("GET /api/mcp/servers → server list", async () => {
    const res = await app.request("/api/mcp/servers");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("servers");
  });

  it("GET /api/mcp/tools → tool list", async () => {
    const res = await app.request("/api/mcp/tools");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("tools");
  });

  it("GET /api/threads → thread list", async () => {
    const res = await app.request("/api/threads");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("threads");
    expect(Array.isArray(body.threads)).toBe(true);
  });

  it("POST /api/chat/invoke → complete response", async () => {
    const res = await app.request("/api/chat/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threadId).toBeDefined();
    expect(body.content).toBe("Integration test response");
  });

  it("POST /api/chat → SSE stream", async () => {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: thread");
    expect(text).toContain("event: token");
    expect(text).toContain("event: done");
  });

  it("unknown route → 404", async () => {
    const res = await app.request("/api/nonexistent");
    expect(res.status).toBe(404);
  });
});
