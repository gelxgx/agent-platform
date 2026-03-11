import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { threads } from "../../../src/gateway/routes/threads.js";

const TEST_ROOT = path.resolve("data/threads");

describe("Threads API", () => {
  const app = new Hono();
  app.route("/api/threads", threads);

  const testThreadId = "test-thread-for-api";

  beforeEach(() => {
    const threadDir = path.join(TEST_ROOT, testThreadId, "workspace");
    fs.mkdirSync(threadDir, { recursive: true });
    fs.writeFileSync(
      path.join(threadDir, "hello.txt"),
      "Hello from test",
      "utf-8",
    );
  });

  afterEach(() => {
    const threadDir = path.join(TEST_ROOT, testThreadId);
    if (fs.existsSync(threadDir)) {
      fs.rmSync(threadDir, { recursive: true });
    }
  });

  it("GET /api/threads should return thread list", async () => {
    const res = await app.request("/api/threads");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.threads).toBeDefined();
    expect(Array.isArray(body.threads)).toBe(true);

    const found = body.threads.find(
      (t: any) => t.id === testThreadId,
    );
    expect(found).toBeDefined();
  });

  it("GET /api/threads/:id/files should list workspace files", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}/files`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.files).toContain("hello.txt");
  });

  it("GET /api/threads/:id/files/* should return file content", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}/files/hello.txt`,
    );
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toBe("Hello from test");
  });

  it("GET /api/threads/:id/files/* should 404 for missing file", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}/files/nonexistent.txt`,
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/threads/:id should remove thread", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toContain(testThreadId);
    expect(
      fs.existsSync(path.join(TEST_ROOT, testThreadId)),
    ).toBe(false);
  });
});
