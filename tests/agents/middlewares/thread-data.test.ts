import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { threadDataMiddleware } from "../../../src/agents/middlewares/thread-data.js";
import { HumanMessage } from "@langchain/core/messages";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const TEST_THREAD_ID = "test-thread-data-mw";
const THREAD_DIR = path.resolve(`data/threads/${TEST_THREAD_ID}`);

function makeState(): AgentStateType {
  return {
    messages: [new HumanMessage("test")],
    threadId: TEST_THREAD_ID,
    title: undefined,
    artifacts: [],
    threadData: undefined,
  } as AgentStateType;
}

const config: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: TEST_THREAD_ID,
};

afterEach(() => {
  if (fs.existsSync(THREAD_DIR)) {
    fs.rmSync(THREAD_DIR, { recursive: true, force: true });
  }
});

describe("ThreadDataMiddleware", () => {
  it("should create thread directories on first run", async () => {
    const result = await threadDataMiddleware.beforeModel!(makeState(), config);

    expect(result?.stateUpdates?.threadData).toBeDefined();
    expect(fs.existsSync(path.join(THREAD_DIR, "workspace"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "uploads"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "outputs"))).toBe(true);
  });

  it("should skip if threadData already exists", async () => {
    const state = makeState();
    (state as any).threadData = {
      workspacePath: "/already/set",
      uploadsPath: "/already/set",
      outputsPath: "/already/set",
    };

    const result = await threadDataMiddleware.beforeModel!(state, config);
    expect(result).toBeUndefined();
  });
});
