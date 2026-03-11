import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

const mockInvoke = vi.fn();
const mockStream = vi.fn();

vi.mock("../../../src/agents/lead-agent/agent.js", () => ({
  createLeadAgent: vi.fn(async () => ({
    invoke: mockInvoke,
    stream: mockStream,
  })),
}));

const { chat } = await import("../../../src/gateway/routes/chat.js");

describe("Chat API", () => {
  const app = new Hono();
  app.route("/api/chat", chat);

  describe("POST /api/chat/invoke", () => {
    it("should return complete response", async () => {
      mockInvoke.mockResolvedValue({
        messages: [{ content: "Hello! How can I help you?" }],
      });

      const res = await app.request("/api/chat/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hi" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.threadId).toBeDefined();
      expect(body.content).toBe("Hello! How can I help you?");
    });

    it("should use provided threadId", async () => {
      mockInvoke.mockResolvedValue({
        messages: [{ content: "Response" }],
      });

      const res = await app.request("/api/chat/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hi", threadId: "test-thread-123" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.threadId).toBe("test-thread-123");
    });
  });

  describe("POST /api/chat (SSE)", () => {
    it("should stream SSE events", async () => {
      async function* mockGenerator() {
        yield [{ content: "Hello" }, {}];
        yield [{ content: " world" }, {}];
      }
      mockStream.mockResolvedValue(mockGenerator());

      const res = await app.request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hi" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const text = await res.text();
      expect(text).toContain("event: thread");
      expect(text).toContain("event: token");
      expect(text).toContain("event: done");
    });
  });
});
