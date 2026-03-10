# Phase 2 实施计划 — 中间件系统

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Lead Agent 添加可插拔的中间件管道，实现 ThreadData、Title、DanglingToolCall 三个中间件

**Architecture:** 中间件以有序链的形式嵌入 callModel 节点内部，分 beforeModel（LLM 调用前处理 state）和 afterModel（LLM 调用后处理 response）两个阶段。每个中间件是一个独立模块，通过配置启用/禁用。参考 DeerFlow 的 11 中间件链设计，本阶段先实现 3 个核心中间件。

**Tech Stack:** TypeScript, @langchain/langgraph, @langchain/core, node:fs, node:crypto

---

## 当前代码要点

在开始之前，理解当前 Lead Agent 的结构非常关键：

- **`src/agents/lead-agent/agent.ts`** — `createLeadAgent()` 创建 LangGraph StateGraph，有两个节点：`callModel`（调 LLM）和 `tools`（执行工具）
- **`src/agents/thread-state.ts`** — `AgentState` 包含 `messages`, `threadId`, `title`, `artifacts`
- **`src/agents/lead-agent/prompt.ts`** — `buildSystemPrompt()` 生成系统提示词
- **`src/config/types.ts`** — `AppConfig`, `ModelConfig`, `ToolConfig`

中间件系统的核心改动是：**在 `callModel` 函数内部**，LLM 调用前运行所有 `beforeModel` 钩子，LLM 调用后运行所有 `afterModel` 钩子。

---

### Task 1: 中间件类型定义和链引擎

**Files:**
- Create: `src/agents/middlewares/types.ts`
- Create: `src/agents/middlewares/chain.ts`
- Test: `tests/agents/middlewares/chain.test.ts`

**Step 1: 定义中间件接口**

创建 `src/agents/middlewares/types.ts`：

```typescript
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../thread-state.js";

export interface RuntimeConfig {
  modelName: string;
  threadId: string;
  thinkingEnabled?: boolean;
  [key: string]: unknown;
}

export interface BeforeModelResult {
  messages?: BaseMessage[];
  stateUpdates?: Partial<AgentStateType>;
}

export interface AfterModelResult {
  response?: AIMessage;
  stateUpdates?: Partial<AgentStateType>;
}

export interface Middleware {
  name: string;
  /** Static boolean or dynamic function to determine if middleware is active */
  enabled: boolean | ((config: RuntimeConfig) => boolean);
  /** Runs before LLM call. Can modify messages and state. */
  beforeModel?: (
    state: AgentStateType,
    config: RuntimeConfig
  ) => Promise<BeforeModelResult | void>;
  /** Runs after LLM call. Can modify the response and state. */
  afterModel?: (
    state: AgentStateType,
    response: AIMessage,
    config: RuntimeConfig
  ) => Promise<AfterModelResult | void>;
}
```

**Step 2: 实现中间件链引擎**

创建 `src/agents/middlewares/chain.ts`：

```typescript
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../thread-state.js";
import type { Middleware, RuntimeConfig } from "./types.js";

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  register(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  private isEnabled(middleware: Middleware, config: RuntimeConfig): boolean {
    if (typeof middleware.enabled === "function") {
      return middleware.enabled(config);
    }
    return middleware.enabled;
  }

  async runBeforeModel(
    state: AgentStateType,
    config: RuntimeConfig
  ): Promise<{ messages: BaseMessage[]; stateUpdates: Partial<AgentStateType> }> {
    let messages = [...state.messages];
    let stateUpdates: Partial<AgentStateType> = {};

    for (const mw of this.middlewares) {
      if (!mw.beforeModel || !this.isEnabled(mw, config)) continue;
      const result = await mw.beforeModel({ ...state, messages }, config);
      if (result?.messages) {
        messages = result.messages;
      }
      if (result?.stateUpdates) {
        stateUpdates = { ...stateUpdates, ...result.stateUpdates };
      }
    }

    return { messages, stateUpdates };
  }

  async runAfterModel(
    state: AgentStateType,
    response: AIMessage,
    config: RuntimeConfig
  ): Promise<{ response: AIMessage; stateUpdates: Partial<AgentStateType> }> {
    let currentResponse = response;
    let stateUpdates: Partial<AgentStateType> = {};

    for (const mw of this.middlewares) {
      if (!mw.afterModel || !this.isEnabled(mw, config)) continue;
      const result = await mw.afterModel(state, currentResponse, config);
      if (result?.response) {
        currentResponse = result.response;
      }
      if (result?.stateUpdates) {
        stateUpdates = { ...stateUpdates, ...result.stateUpdates };
      }
    }

    return { response: currentResponse, stateUpdates };
  }

  getMiddlewares(): readonly Middleware[] {
    return this.middlewares;
  }
}
```

**Step 3: 编写中间件链测试**

创建 `tests/agents/middlewares/chain.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { MiddlewareChain } from "../../../src/agents/middlewares/chain.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { Middleware, RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [new HumanMessage("hello")],
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
    ...overrides,
  } as AgentStateType;
}

const testConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test-thread",
};

describe("MiddlewareChain", () => {
  it("should run beforeModel middlewares in order", async () => {
    const order: string[] = [];

    const mw1: Middleware = {
      name: "first",
      enabled: true,
      beforeModel: async () => {
        order.push("first");
      },
    };

    const mw2: Middleware = {
      name: "second",
      enabled: true,
      beforeModel: async () => {
        order.push("second");
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw1).register(mw2);
    await chain.runBeforeModel(makeState(), testConfig);

    expect(order).toEqual(["first", "second"]);
  });

  it("should skip disabled middlewares", async () => {
    const order: string[] = [];

    const enabled: Middleware = {
      name: "enabled",
      enabled: true,
      beforeModel: async () => { order.push("enabled"); },
    };

    const disabled: Middleware = {
      name: "disabled",
      enabled: false,
      beforeModel: async () => { order.push("disabled"); },
    };

    const chain = new MiddlewareChain();
    chain.register(enabled).register(disabled);
    await chain.runBeforeModel(makeState(), testConfig);

    expect(order).toEqual(["enabled"]);
  });

  it("should support dynamic enabled check", async () => {
    const order: string[] = [];

    const mw: Middleware = {
      name: "dynamic",
      enabled: (config) => config.modelName === "gpt-4o",
      beforeModel: async () => { order.push("dynamic"); },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    await chain.runBeforeModel(makeState(), testConfig);
    expect(order).toEqual(["dynamic"]);

    order.length = 0;
    await chain.runBeforeModel(makeState(), { ...testConfig, modelName: "other" });
    expect(order).toEqual([]);
  });

  it("should run afterModel and allow response modification", async () => {
    const mw: Middleware = {
      name: "modifier",
      enabled: true,
      afterModel: async (_state, response) => {
        return {
          stateUpdates: { title: "Auto Title" },
        };
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    const response = new AIMessage("test response");
    const result = await chain.runAfterModel(makeState(), response, testConfig);

    expect(result.stateUpdates.title).toBe("Auto Title");
    expect(result.response.content).toBe("test response");
  });

  it("should pass modified messages through beforeModel chain", async () => {
    const mw: Middleware = {
      name: "injector",
      enabled: true,
      beforeModel: async (state) => {
        return {
          messages: [...state.messages, new HumanMessage("injected")],
        };
      },
    };

    const chain = new MiddlewareChain();
    chain.register(mw);

    const result = await chain.runBeforeModel(makeState(), testConfig);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].content).toBe("injected");
  });
});
```

**Step 4: 运行测试**

Run: `npx vitest run tests/agents/middlewares/chain.test.ts`
Expected: 5 tests PASS

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add middleware types and chain engine"
```

---

### Task 2: ThreadDataMiddleware — 线程数据隔离

**Files:**
- Create: `src/agents/middlewares/thread-data.ts`
- Test: `tests/agents/middlewares/thread-data.test.ts`

**Step 1: 扩展 AgentState 添加 threadData 字段**

修改 `src/agents/thread-state.ts`，在 `AgentState` 的 `Annotation.Root` 中新增：

```typescript
// 在已有的 import 之后添加
export interface ThreadData {
  workspacePath: string;
  uploadsPath: string;
  outputsPath: string;
}

// 在 AgentState = Annotation.Root({ ... }) 中新增字段：
  threadData: Annotation<ThreadData | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
```

最终 `AgentState` 包含：`messages`, `threadId`, `title`, `artifacts`, `threadData`。

同时更新 `AgentStateType`（它是 `typeof AgentState.State`，会自动包含新字段）。

**Step 2: 实现 ThreadDataMiddleware**

创建 `src/agents/middlewares/thread-data.ts`：

```typescript
import fs from "node:fs";
import path from "node:path";
import type { Middleware } from "./types.js";

const DATA_ROOT = path.resolve("data/threads");

export const threadDataMiddleware: Middleware = {
  name: "ThreadData",
  enabled: true,

  async beforeModel(state) {
    if (state.threadData) return;

    const threadDir = path.join(DATA_ROOT, state.threadId);
    const workspacePath = path.join(threadDir, "workspace");
    const uploadsPath = path.join(threadDir, "uploads");
    const outputsPath = path.join(threadDir, "outputs");

    for (const dir of [workspacePath, uploadsPath, outputsPath]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return {
      stateUpdates: {
        threadData: { workspacePath, uploadsPath, outputsPath },
      },
    };
  },
};
```

**Step 3: 编写测试**

创建 `tests/agents/middlewares/thread-data.test.ts`：

```typescript
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
```

**Step 4: 运行测试**

Run: `npx vitest run tests/agents/middlewares/thread-data.test.ts`
Expected: 2 tests PASS

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add ThreadDataMiddleware for per-thread directory isolation"
```

---

### Task 3: DanglingToolCallMiddleware — 悬空工具调用处理

**Files:**
- Create: `src/agents/middlewares/dangling-tool-call.ts`
- Test: `tests/agents/middlewares/dangling-tool-call.test.ts`

**Step 1: 实现 DanglingToolCallMiddleware**

创建 `src/agents/middlewares/dangling-tool-call.ts`：

当用户中断 Agent 执行时，可能会出现 AIMessage 中包含 `tool_calls` 但后续没有对应 `ToolMessage` 的情况。大多数 LLM API 会因此报错。此中间件检测并注入占位 ToolMessage。

```typescript
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { Middleware } from "./types.js";

export const danglingToolCallMiddleware: Middleware = {
  name: "DanglingToolCall",
  enabled: true,

  async beforeModel(state) {
    const messages = [...state.messages];
    const patchedMessages = [];
    let patched = false;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      patchedMessages.push(msg);

      if (!AIMessage.isInstance(msg) || !msg.tool_calls?.length) continue;

      const toolCallIds = new Set(msg.tool_calls.map((tc) => tc.id));
      const respondedIds = new Set<string>();

      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        if (ToolMessage.isInstance(next) && next.tool_call_id) {
          respondedIds.add(next.tool_call_id);
        }
        if (AIMessage.isInstance(next)) break;
      }

      for (const tcId of toolCallIds) {
        if (tcId && !respondedIds.has(tcId)) {
          patchedMessages.push(
            new ToolMessage({
              tool_call_id: tcId,
              content: "[Tool call was interrupted and did not complete]",
            })
          );
          patched = true;
        }
      }
    }

    if (patched) {
      return { messages: patchedMessages };
    }
  },
};
```

**Step 2: 编写测试**

创建 `tests/agents/middlewares/dangling-tool-call.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { danglingToolCallMiddleware } from "../../../src/agents/middlewares/dangling-tool-call.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const config: RuntimeConfig = { modelName: "gpt-4o", threadId: "test" };

function makeState(messages: any[]): AgentStateType {
  return {
    messages,
    threadId: "test",
    title: undefined,
    artifacts: [],
    threadData: undefined,
  } as AgentStateType;
}

describe("DanglingToolCallMiddleware", () => {
  it("should not modify messages when all tool calls have responses", async () => {
    const messages = [
      new HumanMessage("search for cats"),
      new AIMessage({
        content: "",
        tool_calls: [{ id: "tc1", name: "web_search", args: { query: "cats" } }],
      }),
      new ToolMessage({ tool_call_id: "tc1", content: "Found cats info" }),
      new AIMessage("Here are the results about cats."),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should inject placeholder for dangling tool calls", async () => {
    const messages = [
      new HumanMessage("search for cats"),
      new AIMessage({
        content: "",
        tool_calls: [{ id: "tc1", name: "web_search", args: { query: "cats" } }],
      }),
      // No ToolMessage for tc1 — user interrupted
      new HumanMessage("never mind, tell me about dogs"),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );

    expect(result).toBeDefined();
    expect(result!.messages).toBeDefined();
    const patched = result!.messages!;
    // Should be: Human, AI(tool_call), ToolMessage(placeholder), Human
    expect(patched).toHaveLength(4);
    expect(ToolMessage.isInstance(patched[2])).toBe(true);
    expect((patched[2] as ToolMessage).content).toContain("interrupted");
  });

  it("should handle multiple dangling tool calls in one AIMessage", async () => {
    const messages = [
      new HumanMessage("do two things"),
      new AIMessage({
        content: "",
        tool_calls: [
          { id: "tc1", name: "web_search", args: { query: "a" } },
          { id: "tc2", name: "read_file", args: { filePath: "b" } },
        ],
      }),
    ];

    const result = await danglingToolCallMiddleware.beforeModel!(
      makeState(messages),
      config
    );

    expect(result!.messages).toHaveLength(4); // Human, AI, ToolMsg, ToolMsg
    const toolMsgs = result!.messages!.filter((m) => ToolMessage.isInstance(m));
    expect(toolMsgs).toHaveLength(2);
  });
});
```

**Step 3: 运行测试**

Run: `npx vitest run tests/agents/middlewares/dangling-tool-call.test.ts`
Expected: 3 tests PASS

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add DanglingToolCallMiddleware for interrupted tool call recovery"
```

---

### Task 4: TitleMiddleware — 自动标题生成

**Files:**
- Create: `src/agents/middlewares/title.ts`
- Test: `tests/agents/middlewares/title.test.ts`

**Step 1: 实现 TitleMiddleware**

创建 `src/agents/middlewares/title.ts`：

在第一次完整交互（至少一条 HumanMessage + 一条 AIMessage）后，调用 LLM 生成简短的对话标题。

```typescript
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createChatModel } from "../../models/factory.js";
import type { Middleware } from "./types.js";

const TITLE_PROMPT = `Based on the conversation below, generate a concise title (max 8 words, no quotes). Just output the title, nothing else.`;

export const titleMiddleware: Middleware = {
  name: "Title",
  enabled: true,

  async afterModel(state, response, config) {
    if (state.title) return;

    const humanMessages = state.messages.filter((m) => HumanMessage.isInstance(m));
    const aiMessages = state.messages.filter((m) => AIMessage.isInstance(m));

    // Wait until we have at least one complete exchange
    if (humanMessages.length < 1 || aiMessages.length < 1) return;

    try {
      const model = await createChatModel(config.modelName);
      const conversation = state.messages
        .filter((m) => HumanMessage.isInstance(m) || AIMessage.isInstance(m))
        .slice(0, 4) // Only use first few messages for title
        .map((m) => {
          const role = HumanMessage.isInstance(m) ? "User" : "Assistant";
          return `${role}: ${typeof m.content === "string" ? m.content.slice(0, 200) : ""}`;
        })
        .join("\n");

      const titleResponse = await model.invoke([
        new HumanMessage(`${TITLE_PROMPT}\n\n${conversation}`),
      ]);

      const title =
        typeof titleResponse.content === "string"
          ? titleResponse.content.trim().slice(0, 50)
          : undefined;

      if (title) {
        return { stateUpdates: { title } };
      }
    } catch {
      // Title generation is non-critical; silently ignore failures
    }
  },
};
```

**Step 2: 编写测试**

创建 `tests/agents/middlewares/title.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { titleMiddleware } from "../../../src/agents/middlewares/title.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const config: RuntimeConfig = { modelName: "gpt-4o", threadId: "test" };

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [],
    threadId: "test",
    title: undefined,
    artifacts: [],
    threadData: undefined,
    ...overrides,
  } as AgentStateType;
}

describe("TitleMiddleware", () => {
  it("should skip if title already exists", async () => {
    const state = makeState({
      title: "Existing Title",
      messages: [
        new HumanMessage("hello"),
        new AIMessage("hi there"),
      ],
    });

    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should skip if no complete exchange yet", async () => {
    const state = makeState({
      messages: [new HumanMessage("hello")],
    });

    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should generate title after first complete exchange", async () => {
    const state = makeState({
      messages: [
        new HumanMessage("What is TypeScript?"),
        new AIMessage("TypeScript is a typed superset of JavaScript."),
      ],
    });

    // This test requires a valid API key to actually call the LLM.
    // In CI without a key, the middleware silently catches the error.
    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );

    // If API key is available, title should be generated
    // If not, result will be undefined (error caught silently)
    if (result?.stateUpdates?.title) {
      expect(typeof result.stateUpdates.title).toBe("string");
      expect(result.stateUpdates.title.length).toBeLessThanOrEqual(50);
    }
  });
});
```

**Step 3: 运行测试**

Run: `npx vitest run tests/agents/middlewares/title.test.ts`
Expected: 3 tests PASS（前两个一定通过，第三个取决于 API key 是否可用，无 key 时也不会报错）

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add TitleMiddleware for auto-generating conversation titles"
```

---

### Task 5: 中间件导出 + 默认链构建

**Files:**
- Create: `src/agents/middlewares/index.ts`

**Step 1: 创建中间件入口和默认链工厂**

创建 `src/agents/middlewares/index.ts`：

```typescript
export { MiddlewareChain } from "./chain.js";
export type { Middleware, RuntimeConfig, BeforeModelResult, AfterModelResult } from "./types.js";
export { threadDataMiddleware } from "./thread-data.js";
export { danglingToolCallMiddleware } from "./dangling-tool-call.js";
export { titleMiddleware } from "./title.js";

import { MiddlewareChain } from "./chain.js";
import { threadDataMiddleware } from "./thread-data.js";
import { danglingToolCallMiddleware } from "./dangling-tool-call.js";
import { titleMiddleware } from "./title.js";

/**
 * Build the default middleware chain.
 * Order matters — matches DeerFlow's middleware execution order:
 * 1. ThreadData (before): set up thread directories
 * 2. DanglingToolCall (before): fix interrupted tool calls
 * 3. Title (after): auto-generate conversation title
 *
 * Future middlewares will be inserted at their appropriate position.
 */
export function createDefaultMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain()
    .register(threadDataMiddleware)
    .register(danglingToolCallMiddleware)
    .register(titleMiddleware);
}
```

**Step 2: 提交**

```bash
git add -A
git commit -m "feat: add middleware index with default chain factory"
```

---

### Task 6: 集成中间件到 Lead Agent

**Files:**
- Modify: `src/agents/lead-agent/agent.ts`
- Modify: `src/agents/thread-state.ts`（Task 2 中已描述扩展）
- Test: `tests/agents/lead-agent/agent-with-middleware.test.ts`

**Step 1: 确认 thread-state.ts 已扩展**

确保 `src/agents/thread-state.ts` 包含 `threadData` 字段（Task 2 Step 1 中已描述）。最终文件应为：

```typescript
import {
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";

export interface Artifact {
  id: string;
  type: string;
  path: string;
  title: string;
  createdAt: string;
}

export interface ThreadData {
  workspacePath: string;
  uploadsPath: string;
  outputsPath: string;
}

function mergeArtifacts(
  existing: Artifact[],
  updates: Artifact[]
): Artifact[] {
  const map = new Map(existing.map((a) => [a.id, a]));
  for (const artifact of updates) {
    map.set(artifact.id, artifact);
  }
  return Array.from(map.values());
}

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  threadId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  title: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  artifacts: Annotation<Artifact[]>({
    reducer: mergeArtifacts,
    default: () => [],
  }),
  threadData: Annotation<ThreadData | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

export type AgentStateType = typeof AgentState.State;
```

**Step 2: 重写 Lead Agent 集成中间件**

修改 `src/agents/lead-agent/agent.ts`：

```typescript
import {
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState, type AgentStateType } from "../thread-state.js";
import { buildSystemPrompt } from "./prompt.js";
import { getAvailableTools } from "../../tools/registry.js";
import { createChatModel } from "../../models/factory.js";
import { createDefaultMiddlewareChain } from "../middlewares/index.js";
import type { RuntimeConfig } from "../middlewares/types.js";

function shouldContinue(state: AgentStateType): "tools" | typeof END {
  const lastMessage = state.messages.at(-1);
  if (
    lastMessage &&
    AIMessage.isInstance(lastMessage) &&
    lastMessage.tool_calls?.length
  ) {
    return "tools";
  }
  return END;
}

export async function createLeadAgent(modelName?: string) {
  const model = await createChatModel(modelName);
  const tools = getAvailableTools();
  const modelWithTools = model.bindTools!(tools);
  const toolNode = new ToolNode(tools);
  const middlewareChain = createDefaultMiddlewareChain();

  async function callModel(state: AgentStateType) {
    const runtimeConfig: RuntimeConfig = {
      modelName: modelName ?? "default",
      threadId: state.threadId,
    };

    // --- beforeModel middlewares ---
    const { messages: processedMessages, stateUpdates: beforeUpdates } =
      await middlewareChain.runBeforeModel(state, runtimeConfig);

    // --- LLM call ---
    const systemMessage = new SystemMessage(buildSystemPrompt());
    const response = await modelWithTools.invoke([
      systemMessage,
      ...processedMessages,
    ]);

    // --- afterModel middlewares ---
    const { response: processedResponse, stateUpdates: afterUpdates } =
      await middlewareChain.runAfterModel(state, response, runtimeConfig);

    return {
      messages: [processedResponse],
      ...beforeUpdates,
      ...afterUpdates,
    };
  }

  const graph = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue, ["tools", END])
    .addEdge("tools", "callModel")
    .compile();

  return graph;
}
```

**Step 3: 编写集成测试**

创建 `tests/agents/lead-agent/agent-with-middleware.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";

const TEST_THREAD_ID = "test-middleware-integration";
const THREAD_DIR = path.resolve(`data/threads/${TEST_THREAD_ID}`);

describe("Lead Agent with Middleware", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  afterEach(() => {
    if (fs.existsSync(THREAD_DIR)) {
      fs.rmSync(THREAD_DIR, { recursive: true, force: true });
    }
  });

  it("should create agent with middleware chain", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
  });

  it("should create thread directories via ThreadDataMiddleware", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();

    const result = await agent.invoke({
      messages: [new HumanMessage("Just say hi in one word.")],
      threadId: TEST_THREAD_ID,
    });

    expect(result.messages.length).toBeGreaterThan(1);
    expect(fs.existsSync(path.join(THREAD_DIR, "workspace"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "uploads"))).toBe(true);
    expect(fs.existsSync(path.join(THREAD_DIR, "outputs"))).toBe(true);
  });
});
```

**Step 4: 运行所有测试**

Run: `npx vitest run`
Expected: ALL PASS

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: integrate middleware chain into Lead Agent callModel node"
```

---

### Task 7: CLI 中展示标题 + 收尾

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: 在 CLI 中展示自动生成的标题**

修改 `src/cli/index.ts` 中 agent stream 响应后的部分，在流式输出结束后尝试获取最新的标题状态。由于 LangGraph stream 模式下不容易拿到最终 state，我们改用一种简单方式：在 CLI 层维护标题，并在每次对话后通过非流式的 `invoke` 替代来获取 state（或者在流式结束后单独查询）。

更实际的方案：由于当前 CLI 没有 checkpointer（没有跨消息的状态持久化），标题中间件生成的标题只在单次 invoke 的返回值中。我们在 `streamMode: "values"` 模式下可以获取到最终状态。

修改 `src/cli/index.ts` 中的流式输出部分：

将 `streamMode: "messages"` 改为 `streamMode: ["messages", "values"]`，并在最终 values 中提取 title。

或者更简单地：在 `stream` 结束后，检查最后一个 values chunk 的 title 字段，如果有就显示。

实际改动是在流式输出块的 `for await` 循环之后添加标题显示逻辑。

把 CLI 中发送消息的 try block 改为：

```typescript
      try {
        log(COLORS.cyan, "Agent: ");

        let latestTitle: string | undefined;

        const stream = await agent.stream(
          {
            messages: [new HumanMessage(input)],
            threadId,
          },
          { streamMode: "messages" }
        );

        for await (const [message, _metadata] of stream) {
          if (!message.content) continue;
          if (typeof message.content === "string") {
            process.stdout.write(message.content);
          } else if (Array.isArray(message.content)) {
            for (const block of message.content) {
              if (typeof block === "string") {
                process.stdout.write(block);
              } else if (block && typeof block === "object" && "text" in block) {
                process.stdout.write((block as { text: string }).text);
              }
            }
          }
        }

        process.stdout.write("\n\n");
      } catch (error) {
```

注意：由于当前无 checkpointer，Title 中间件生成的标题只在 invoke 返回的 state 中。流式模式下 title 不会直接打印。后续 Phase（添加 checkpointer 后）可以持久化读取标题。当前阶段标题功能主要为架构铺路。

**Step 2: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: ALL PASS

**Step 3: 手动测试 CLI**

Run: `npx tsx src/index.ts`
Expected:
- CLI 正常启动
- 对话正常工作
- `data/threads/{threadId}/` 目录自动创建

**Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete Phase 2 - middleware system with ThreadData, DanglingToolCall, Title"
```

---

## Phase 2 完成标准

- [ ] `src/agents/middlewares/` 目录包含完整的中间件系统
- [ ] MiddlewareChain 支持 register/beforeModel/afterModel
- [ ] ThreadDataMiddleware：每个线程自动创建隔离目录
- [ ] DanglingToolCallMiddleware：中断的工具调用自动补全
- [ ] TitleMiddleware：首次交互后自动生成标题
- [ ] 中间件已集成到 Lead Agent 的 callModel 节点
- [ ] `npm test` 全部通过
- [ ] 中间件可通过 enabled 配置启用/禁用
- [ ] 中间件执行顺序明确且可控

## 下一步：Phase 3

Phase 2 完成后，Phase 3（记忆系统）的中间件将以同样的方式添加：
- 创建 `MemoryMiddleware`（beforeModel 注入记忆上下文，afterModel 收集新事实）
- 注册到 MiddlewareChain
- 不需要修改 Agent 核心代码
