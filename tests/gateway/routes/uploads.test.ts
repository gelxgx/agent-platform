import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { uploads } from "../../../src/gateway/routes/uploads.js";

const TEST_ROOT = path.resolve("data/threads");
const testThreadId = "test-uploads-api";
const THREAD_DIR = path.join(TEST_ROOT, testThreadId);
const UPLOADS_DIR = path.join(THREAD_DIR, "uploads");

describe("Uploads API", () => {
  const app = new Hono();
  app.route("/api/threads", uploads);

  beforeEach(() => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(THREAD_DIR)) {
      fs.rmSync(THREAD_DIR, { recursive: true, force: true });
    }
  });

  it("POST /api/threads/:id/uploads should accept file upload", async () => {
    const file = new File(["hello world"], "test.txt", {
      type: "text/plain",
    });
    const form = new FormData();
    form.append("file", file);

    const res = await app.request(
      `/api/threads/${testThreadId}/uploads`,
      { method: "POST", body: form }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("test.txt");
    expect(body.size).toBe(11);
    expect(fs.existsSync(path.join(UPLOADS_DIR, "test.txt"))).toBe(true);
  });

  it("POST /api/threads/:id/uploads should return 400 without file", async () => {
    const form = new FormData();

    const res = await app.request(
      `/api/threads/${testThreadId}/uploads`,
      { method: "POST", body: form }
    );

    expect(res.status).toBe(400);
  });

  it("GET /api/threads/:id/uploads should list uploaded files", async () => {
    fs.writeFileSync(path.join(UPLOADS_DIR, "a.txt"), "content-a");
    fs.writeFileSync(path.join(UPLOADS_DIR, "b.txt"), "content-b");

    const res = await app.request(
      `/api/threads/${testThreadId}/uploads`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files.length).toBe(2);
    const names = body.files.map((f: any) => f.name);
    expect(names).toContain("a.txt");
    expect(names).toContain("b.txt");
  });

  it("GET /api/threads/:id/uploads should return empty for missing dir", async () => {
    fs.rmSync(THREAD_DIR, { recursive: true, force: true });

    const res = await app.request(
      `/api/threads/nonexistent-thread/uploads`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toEqual([]);
  });

  it("DELETE /api/threads/:id/uploads/:filename should remove file", async () => {
    fs.writeFileSync(path.join(UPLOADS_DIR, "to-delete.txt"), "bye");

    const res = await app.request(
      `/api/threads/${testThreadId}/uploads/to-delete.txt`,
      { method: "DELETE" }
    );

    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(UPLOADS_DIR, "to-delete.txt"))).toBe(false);
  });

  it("DELETE /api/threads/:id/uploads/:filename should also remove .txt conversion", async () => {
    fs.writeFileSync(path.join(UPLOADS_DIR, "doc.pdf"), "fake");
    fs.writeFileSync(path.join(UPLOADS_DIR, "doc.pdf.txt"), "converted");

    const res = await app.request(
      `/api/threads/${testThreadId}/uploads/doc.pdf`,
      { method: "DELETE" }
    );

    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(UPLOADS_DIR, "doc.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(UPLOADS_DIR, "doc.pdf.txt"))).toBe(false);
  });

  it("DELETE /api/threads/:id/uploads/:filename should 404 for missing file", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}/uploads/nonexistent.txt`,
      { method: "DELETE" }
    );

    expect(res.status).toBe(404);
  });
});
