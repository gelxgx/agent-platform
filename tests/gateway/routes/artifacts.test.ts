import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { artifacts } from "../../../src/gateway/routes/artifacts.js";

const TEST_ROOT = path.resolve("data/threads");
const testThreadId = "test-artifacts-api";
const THREAD_DIR = path.join(TEST_ROOT, testThreadId);
const WORKSPACE_DIR = path.join(THREAD_DIR, "workspace");

describe("Artifacts API", () => {
  const app = new Hono();
  app.route("/api/threads", artifacts);

  beforeEach(() => {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(THREAD_DIR)) {
      fs.rmSync(THREAD_DIR, { recursive: true, force: true });
    }
  });

  it("GET /api/threads/:id/artifacts/* should return file content", async () => {
    fs.writeFileSync(
      path.join(WORKSPACE_DIR, "report.md"),
      "# Report\n\nSome content"
    );

    const res = await app.request(
      `/api/threads/${testThreadId}/artifacts/report.md`
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Report");
  });

  it("GET /api/threads/:id/artifacts/* should 404 for missing file", async () => {
    const res = await app.request(
      `/api/threads/${testThreadId}/artifacts/nonexistent.md`
    );

    expect(res.status).toBe(404);
  });

  it("GET /api/threads/:id/artifacts/* with download=true should set Content-Disposition", async () => {
    fs.writeFileSync(path.join(WORKSPACE_DIR, "data.csv"), "a,b\n1,2");

    const res = await app.request(
      `/api/threads/${testThreadId}/artifacts/data.csv?download=true`
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("data.csv");
  });

  it("GET /api/threads/:id/artifacts/* should serve nested files", async () => {
    const subdir = path.join(WORKSPACE_DIR, "sub");
    fs.mkdirSync(subdir, { recursive: true });
    fs.writeFileSync(path.join(subdir, "nested.txt"), "nested content");

    const res = await app.request(
      `/api/threads/${testThreadId}/artifacts/sub/nested.txt`
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("nested content");
  });
});
