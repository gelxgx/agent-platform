import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMemoryMiddleware, resetMemoryInstances } from "../../src/memory/middleware.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { RuntimeConfig } from "../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../src/agents/thread-state.js";
import type { MemoryData } from "../../src/memory/types.js";

const TEST_PATH = "data/test-mw-memory.json";
const config: RuntimeConfig = { modelName: "gpt-4o", threadId: "test-thread" };

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [new HumanMessage("hello"), new AIMessage("hi")],
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
    threadData: undefined,
    ...overrides,
  } as AgentStateType;
}

afterEach(() => {
  resetMemoryInstances();
  const resolved = path.resolve(TEST_PATH);
  if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
});

describe("MemoryMiddleware", () => {
  it("should skip injection when no memory exists", async () => {
    const mw = createMemoryMiddleware({ storagePath: TEST_PATH });
    const result = await mw.beforeModel!(makeState(), config);
    expect(result).toBeUndefined();
  });

  it("should inject memory context when facts exist", async () => {
    const memData: MemoryData = {
      userContext: {
        workContext: "Frontend engineer",
        personalContext: "",
        topOfMind: "",
      },
      facts: [
        {
          id: "f1",
          content: "User likes TypeScript",
          category: "preference",
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
    const dir = path.dirname(path.resolve(TEST_PATH));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.resolve(TEST_PATH), JSON.stringify(memData));

    const mw = createMemoryMiddleware({ storagePath: TEST_PATH });
    const result = await mw.beforeModel!(makeState(), config);

    expect(result?.stateUpdates).toBeDefined();
    expect((result!.stateUpdates as any)._memoryContext).toBeDefined();
  });

  it("should enqueue messages for memory extraction on afterModel", async () => {
    const mw = createMemoryMiddleware({
      storagePath: TEST_PATH,
      enabled: true,
      debounceSeconds: 60,
    });

    const response = new AIMessage("I'll remember that");
    await mw.afterModel!(makeState(), response, config);

    await mw.flushQueue();
  });

  it("should be disabled when enabled=false", async () => {
    const mw = createMemoryMiddleware({
      storagePath: TEST_PATH,
      enabled: false,
    });
    expect(mw.enabled).toBe(false);
  });
});
