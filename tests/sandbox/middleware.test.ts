import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sandboxMiddleware } from "../../src/sandbox/middleware.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import type { RuntimeConfig } from "../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../src/agents/thread-state.js";
import fs from "node:fs";
import path from "node:path";

const TEST_THREAD = "middleware-test-thread";
const WORKSPACE = path.resolve(`data/threads/${TEST_THREAD}/workspace`);

afterAll(() => {
  fs.rmSync(path.resolve(`data/threads/${TEST_THREAD}`), {
    recursive: true,
    force: true,
  });
});

describe("Sandbox Middleware", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should have name 'Sandbox'", () => {
    expect(sandboxMiddleware.name).toBe("Sandbox");
  });

  it("should be enabled when sandbox config is enabled", () => {
    const enabled =
      typeof sandboxMiddleware.enabled === "function"
        ? sandboxMiddleware.enabled({} as RuntimeConfig)
        : sandboxMiddleware.enabled;
    expect(enabled).toBe(true);
  });

  it("should create workspace directory on beforeModel", async () => {
    if (fs.existsSync(WORKSPACE)) {
      fs.rmSync(WORKSPACE, { recursive: true, force: true });
    }

    const state = {
      threadId: TEST_THREAD,
      messages: [],
    } as unknown as AgentStateType;

    const result = await sandboxMiddleware.beforeModel!(state, {} as RuntimeConfig);
    expect(fs.existsSync(WORKSPACE)).toBe(true);
    expect((result?.stateUpdates as any)?._sandboxContext).toBeDefined();
    expect((result?.stateUpdates as any)?._sandboxContext.workspace).toBe("/workspace");
  });

  it("should list files in workspace", async () => {
    fs.mkdirSync(WORKSPACE, { recursive: true });
    fs.writeFileSync(path.join(WORKSPACE, "hello.txt"), "hello");

    const state = {
      threadId: TEST_THREAD,
      messages: [],
    } as unknown as AgentStateType;

    const result = await sandboxMiddleware.beforeModel!(state, {} as RuntimeConfig);
    const ctx = (result?.stateUpdates as any)?._sandboxContext;
    expect(ctx.files).toContain("hello.txt");
  });

  it("should not run if threadId is empty", async () => {
    const state = {
      threadId: "",
      messages: [],
    } as unknown as AgentStateType;

    const result = await sandboxMiddleware.beforeModel!(state, {} as RuntimeConfig);
    expect(result).toBeUndefined();
  });
});
