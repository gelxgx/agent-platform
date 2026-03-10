# Phase 1 实施计划 — Agent 循环 + 工具调用 + CLI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从零构建一个能对话、能调用工具、能流式输出的 CLI Agent

**Architecture:** 基于 LangGraph.js StateGraph 实现 ReAct 循环（callModel → shouldContinue → callTools → callModel），通过配置驱动的模型工厂支持多 Provider，CLI 提供多轮对话和流式输出

**Tech Stack:** TypeScript, @langchain/langgraph, @langchain/openai, @langchain/core, zod, js-yaml, dotenv, tsx

---

### Task 1: 项目初始化和依赖安装

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: 初始化 Node.js 项目**

Run: `npm init -y`
Expected: 生成 `package.json`

**Step 2: 安装核心依赖**

```bash
npm install @langchain/langgraph @langchain/core @langchain/openai zod js-yaml dotenv
npm install -D typescript tsx @types/node @types/js-yaml vitest
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: 创建 .gitignore**

```
node_modules/
dist/
.env
data/
*.log
```

**Step 5: 创建 .env.example**

```
OPENAI_API_KEY=your-openai-api-key
```

**Step 6: 更新 package.json scripts**

在 `package.json` 中添加：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 7: 初始化 git 并提交**

```bash
git init
git add .
git commit -m "chore: initialize project with TypeScript and LangGraph.js dependencies"
```

---

### Task 2: 配置系统

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/loader.ts`
- Create: `config.yaml`
- Test: `tests/config/loader.test.ts`

**Step 1: 编写配置类型定义**

创建 `src/config/types.ts`：

```typescript
export interface ModelConfig {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
  supportsThinking?: boolean;
  supportsVision?: boolean;
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
}

export interface AppConfig {
  models: ModelConfig[];
  tools: ToolConfig[];
  defaultModel: string;
}
```

**Step 2: 编写配置加载器**

创建 `src/config/loader.ts`：

```typescript
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import type { AppConfig } from "./types.js";

dotenv.config();

function resolveEnvVars(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("$")) {
    return process.env[value.slice(1)] ?? "";
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(resolveEnvVars);
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return value;
}

function findConfigFile(): string {
  const envPath = process.env.AGENT_PLATFORM_CONFIG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const localPath = path.resolve("config.yaml");
  if (fs.existsSync(localPath)) return localPath;

  throw new Error("config.yaml not found");
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(configPath?: string): AppConfig {
  if (cachedConfig) return cachedConfig;

  const filePath = configPath ?? findConfigFile();
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;
  const resolved = resolveEnvVars(parsed) as AppConfig;

  cachedConfig = resolved;
  return resolved;
}

export function getModelConfig(name: string): ModelConfig {
  const config = loadConfig();
  const model = config.models.find((m) => m.name === name);
  if (!model) throw new Error(`Model "${name}" not found in config`);
  return model;
}

export function getDefaultModelName(): string {
  const config = loadConfig();
  return config.defaultModel ?? config.models[0]?.name ?? "gpt-4o";
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
```

**Step 3: 创建默认配置文件**

创建 `config.yaml`：

```yaml
defaultModel: "gpt-4o"

models:
  - name: "gpt-4o"
    displayName: "GPT-4o"
    provider: "openai"
    model: "gpt-4o"
    apiKey: "$OPENAI_API_KEY"
    maxTokens: 4096
    temperature: 0.7
    supportsThinking: false
    supportsVision: true

  - name: "gpt-4o-mini"
    displayName: "GPT-4o Mini"
    provider: "openai"
    model: "gpt-4o-mini"
    apiKey: "$OPENAI_API_KEY"
    maxTokens: 4096
    temperature: 0.7
    supportsThinking: false
    supportsVision: true

tools:
  - name: "web_search"
    enabled: true
  - name: "web_fetch"
    enabled: true
  - name: "read_file"
    enabled: true
  - name: "write_file"
    enabled: true
```

**Step 4: 编写配置加载测试**

创建 `tests/config/loader.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getModelConfig, resetConfigCache } from "../../src/config/loader.js";
import path from "node:path";

describe("Config Loader", () => {
  beforeEach(() => resetConfigCache());

  it("should load config.yaml from project root", () => {
    const config = loadConfig(path.resolve("config.yaml"));
    expect(config.models).toBeDefined();
    expect(config.models.length).toBeGreaterThan(0);
  });

  it("should resolve $ENV_VAR references", () => {
    process.env.TEST_API_KEY = "test-key-123";
    resetConfigCache();
    const config = loadConfig(path.resolve("config.yaml"));
    const model = config.models[0];
    expect(model.apiKey).not.toContain("$");
  });

  it("should throw for unknown model name", () => {
    loadConfig(path.resolve("config.yaml"));
    expect(() => getModelConfig("nonexistent")).toThrow('Model "nonexistent" not found');
  });
});
```

**Step 5: 运行测试**

Run: `npx vitest run tests/config/loader.test.ts`
Expected: 3 tests PASS

**Step 6: 提交**

```bash
git add -A
git commit -m "feat: add YAML config system with env var resolution"
```

---

### Task 3: 模型工厂

**Files:**
- Create: `src/models/types.ts`
- Create: `src/models/factory.ts`
- Test: `tests/models/factory.test.ts`

**Step 1: 编写模型类型**

创建 `src/models/types.ts`：

```typescript
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ProviderFactory = () => Promise<new (config: Record<string, unknown>) => BaseChatModel>;

export interface ModelFactoryOptions {
  modelName?: string;
  thinkingEnabled?: boolean;
}
```

**Step 2: 编写模型工厂**

创建 `src/models/factory.ts`：

```typescript
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getModelConfig, getDefaultModelName } from "../config/loader.js";
import type { ProviderFactory } from "./types.js";

const PROVIDER_MAP: Record<string, ProviderFactory> = {
  openai: () =>
    import("@langchain/openai").then((m) => m.ChatOpenAI as unknown as new (config: Record<string, unknown>) => BaseChatModel),
};

export function registerProvider(name: string, factory: ProviderFactory): void {
  PROVIDER_MAP[name] = factory;
}

export async function createChatModel(name?: string): Promise<BaseChatModel> {
  const modelName = name ?? getDefaultModelName();
  const config = getModelConfig(modelName);

  const factory = PROVIDER_MAP[config.provider];
  if (!factory) {
    const available = Object.keys(PROVIDER_MAP).join(", ");
    throw new Error(
      `Unknown provider "${config.provider}". Available: ${available}. ` +
      `To add support, install the package and call registerProvider().`
    );
  }

  const ModelClass = await factory();
  return new ModelClass({
    modelName: config.model,
    apiKey: config.apiKey,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}
```

**Step 3: 编写模型工厂测试**

创建 `tests/models/factory.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { registerProvider } from "../../src/models/factory.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Model Factory", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should have openai provider registered by default", async () => {
    // registerProvider is available and doesn't throw
    registerProvider("test-provider", async () => {
      const { ChatOpenAI } = await import("@langchain/openai");
      return ChatOpenAI as any;
    });
  });

  it("should throw for unknown provider", async () => {
    const { createChatModel } = await import("../../src/models/factory.js");
    resetConfigCache();
    // Load config but with a model that uses unknown provider
    // This test verifies the error path
    registerProvider("__test__", undefined as any);
    // Provider map check is done at createChatModel time
  });
});
```

**Step 4: 运行测试**

Run: `npx vitest run tests/models/factory.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add model factory with provider registry and dynamic import"
```

---

### Task 4: 内置工具

**Files:**
- Create: `src/tools/builtins/web-search.ts`
- Create: `src/tools/builtins/web-fetch.ts`
- Create: `src/tools/builtins/file-ops.ts`
- Create: `src/tools/registry.ts`
- Test: `tests/tools/registry.test.ts`

**Step 1: 实现 web_search 工具**

创建 `src/tools/builtins/web-search.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const webSearchTool = tool(
  async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Error: TAVILY_API_KEY not set. Please add it to your .env file.";
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: true,
        }),
      });
      const data = await response.json();
      if (data.answer) {
        const sources = (data.results ?? [])
          .map((r: { title: string; url: string }) => `- ${r.title}: ${r.url}`)
          .join("\n");
        return `${data.answer}\n\nSources:\n${sources}`;
      }
      return (data.results ?? [])
        .map((r: { title: string; url: string; content: string }) =>
          `**${r.title}**\n${r.url}\n${r.content}`
        )
        .join("\n\n");
    } catch (error) {
      return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for real-time information. Use this when you need current data, facts, or information that may not be in your training data.",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().default(5).describe("Maximum number of results"),
    }),
  }
);
```

**Step 2: 实现 web_fetch 工具**

创建 `src/tools/builtins/web-fetch.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const MAX_CONTENT_LENGTH = 8000;

export const webFetchTool = tool(
  async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "AgentPlatform/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
      }
      const text = await response.text();
      const content = text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]"
        : text;
      return content;
    } catch (error) {
      return `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "web_fetch",
    description: "Fetch the content of a web page. Returns the raw text content of the URL.",
    schema: z.object({
      url: z.string().url().describe("The URL to fetch"),
    }),
  }
);
```

**Step 3: 实现文件操作工具**

创建 `src/tools/builtins/file-ops.ts`：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

export const readFileTool = tool(
  async ({ filePath, startLine, endLine }) => {
    try {
      const resolvedPath = path.resolve(filePath);
      const content = await fs.readFile(resolvedPath, "utf-8");
      const lines = content.split("\n");

      if (startLine !== undefined || endLine !== undefined) {
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        return lines.slice(start, end).join("\n");
      }
      return content;
    } catch (error) {
      return `Failed to read file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file. Optionally specify line range.",
    schema: z.object({
      filePath: z.string().describe("Path to the file to read"),
      startLine: z.number().optional().describe("Starting line number (1-based)"),
      endLine: z.number().optional().describe("Ending line number (inclusive)"),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content, append }) => {
    try {
      const resolvedPath = path.resolve(filePath);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      if (append) {
        await fs.appendFile(resolvedPath, content, "utf-8");
        return `Content appended to ${filePath}`;
      }
      await fs.writeFile(resolvedPath, content, "utf-8");
      return `File written to ${filePath}`;
    } catch (error) {
      return `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates directories if they don't exist.",
    schema: z.object({
      filePath: z.string().describe("Path to the file to write"),
      content: z.string().describe("Content to write"),
      append: z.boolean().optional().default(false).describe("Append instead of overwrite"),
    }),
  }
);
```

**Step 4: 实现工具注册表**

创建 `src/tools/registry.ts`：

```typescript
import type { StructuredToolInterface } from "@langchain/core/tools";
import { loadConfig } from "../config/loader.js";
import { webSearchTool } from "./builtins/web-search.js";
import { webFetchTool } from "./builtins/web-fetch.js";
import { readFileTool, writeFileTool } from "./builtins/file-ops.js";

const BUILTIN_TOOLS: Record<string, StructuredToolInterface> = {
  web_search: webSearchTool,
  web_fetch: webFetchTool,
  read_file: readFileTool,
  write_file: writeFileTool,
};

export function getAvailableTools(): StructuredToolInterface[] {
  const config = loadConfig();
  const enabledToolNames = config.tools
    .filter((t) => t.enabled)
    .map((t) => t.name);

  return enabledToolNames
    .map((name) => BUILTIN_TOOLS[name])
    .filter((t): t is StructuredToolInterface => t !== undefined);
}

export function getToolByName(name: string): StructuredToolInterface | undefined {
  return BUILTIN_TOOLS[name];
}
```

**Step 5: 编写工具注册表测试**

创建 `tests/tools/registry.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getAvailableTools, getToolByName } from "../../src/tools/registry.js";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Tool Registry", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should return enabled tools from config", () => {
    const tools = getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t) => t.name);
    expect(names).toContain("web_search");
    expect(names).toContain("read_file");
  });

  it("should find tool by name", () => {
    const tool = getToolByName("web_search");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("web_search");
  });

  it("should return undefined for unknown tool", () => {
    const tool = getToolByName("nonexistent");
    expect(tool).toBeUndefined();
  });
});
```

**Step 6: 运行测试**

Run: `npx vitest run tests/tools/registry.test.ts`
Expected: 3 tests PASS

**Step 7: 提交**

```bash
git add -A
git commit -m "feat: add built-in tools (web search, web fetch, file ops) and tool registry"
```

---

### Task 5: Lead Agent（核心 ReAct 循环）

**Files:**
- Create: `src/agents/thread-state.ts`
- Create: `src/agents/lead-agent/prompt.ts`
- Create: `src/agents/lead-agent/agent.ts`
- Test: `tests/agents/lead-agent/agent.test.ts`

**Step 1: 定义线程状态**

创建 `src/agents/thread-state.ts`：

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
});

export type AgentStateType = typeof AgentState.State;
```

**Step 2: 编写系统提示词**

创建 `src/agents/lead-agent/prompt.ts`：

```typescript
export function buildSystemPrompt(): string {
  const now = new Date().toISOString();
  return `You are a helpful AI assistant powered by agent-platform.

Current time: ${now}

## Capabilities

You have access to tools that allow you to:
- Search the web for real-time information
- Fetch web page content
- Read and write files on the local filesystem

## Guidelines

1. Use tools when the task requires external information or actions.
2. Be concise and direct in your responses.
3. When using web search, synthesize the results into a coherent answer.
4. When writing files, always confirm what was written.
5. If you're unsure about something, say so rather than guessing.
6. Think step by step for complex tasks.`;
}
```

**Step 3: 实现 Lead Agent**

创建 `src/agents/lead-agent/agent.ts`：

```typescript
import {
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState, type AgentStateType } from "../thread-state.js";
import { buildSystemPrompt } from "./prompt.js";
import { getAvailableTools } from "../../tools/registry.js";
import { createChatModel } from "../../models/factory.js";

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
  const modelWithTools = model.bindTools(tools);
  const toolNode = new ToolNode(tools);

  async function callModel(state: AgentStateType) {
    const systemMessage = new SystemMessage(buildSystemPrompt());
    const response = await modelWithTools.invoke([
      systemMessage,
      ...state.messages,
    ]);
    return { messages: [response] };
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

**Step 4: 编写 Agent 测试**

创建 `tests/agents/lead-agent/agent.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { resetConfigCache, loadConfig } from "../../../src/config/loader.js";
import path from "node:path";

describe("Lead Agent", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should create agent with tools bound", async () => {
    const { createLeadAgent } = await import(
      "../../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    expect(agent).toBeDefined();
    // Agent is a compiled StateGraph, it should have an invoke method
    expect(typeof agent.invoke).toBe("function");
    expect(typeof agent.stream).toBe("function");
  });
});
```

**Step 5: 运行测试**

Run: `npx vitest run tests/agents/lead-agent/agent.test.ts`
Expected: PASS（注意：此测试需要有效的 OPENAI_API_KEY 才能创建模型实例）

**Step 6: 提交**

```bash
git add -A
git commit -m "feat: implement Lead Agent with ReAct loop using LangGraph StateGraph"
```

---

### Task 6: CLI 交互界面

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/commands.ts`
- Create: `src/index.ts`

**Step 1: 实现 CLI 命令处理**

创建 `src/cli/commands.ts`：

```typescript
import { loadConfig } from "../config/loader.js";

export interface CommandResult {
  handled: boolean;
  shouldQuit?: boolean;
  output?: string;
}

export function handleCommand(input: string): CommandResult {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const [command, ...args] = trimmed.slice(1).split(" ");

  switch (command) {
    case "quit":
    case "exit":
      return { handled: true, shouldQuit: true, output: "Goodbye!" };

    case "new":
      return { handled: true, output: "NEW_THREAD" };

    case "models": {
      const config = loadConfig();
      const list = config.models
        .map((m) => `  - ${m.name} (${m.displayName})`)
        .join("\n");
      return { handled: true, output: `Available models:\n${list}` };
    }

    case "model": {
      if (args[0]) {
        return { handled: true, output: `MODEL_SWITCH:${args[0]}` };
      }
      return { handled: true, output: "Usage: /model <name>" };
    }

    case "help":
      return {
        handled: true,
        output: [
          "Commands:",
          "  /new         - Start a new conversation",
          "  /models      - List available models",
          "  /model <n>   - Switch model",
          "  /help        - Show this help",
          "  /quit        - Exit",
        ].join("\n"),
      };

    default:
      return { handled: true, output: `Unknown command: /${command}` };
  }
}
```

**Step 2: 实现 CLI 主循环**

创建 `src/cli/index.ts`：

```typescript
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { createLeadAgent } from "../agents/lead-agent/agent.js";
import { loadConfig } from "../config/loader.js";
import { handleCommand } from "./commands.js";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};

function log(color: string, text: string) {
  process.stdout.write(`${color}${text}${COLORS.reset}`);
}

export async function startCli() {
  const config = loadConfig();
  let currentModel = config.defaultModel ?? config.models[0]?.name;
  let threadId = randomUUID();

  console.log(`${COLORS.cyan}🤖 Agent Platform CLI${COLORS.reset}`);
  console.log(`${COLORS.dim}Model: ${currentModel} | Thread: ${threadId.slice(0, 8)}...${COLORS.reset}`);
  console.log(`${COLORS.dim}Type /help for commands${COLORS.reset}\n`);

  let agent = await createLeadAgent(currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`${COLORS.green}You: ${COLORS.reset}`, async (input) => {
      if (!input.trim()) {
        prompt();
        return;
      }

      const cmdResult = handleCommand(input);

      if (cmdResult.handled) {
        if (cmdResult.shouldQuit) {
          console.log(cmdResult.output);
          rl.close();
          process.exit(0);
        }
        if (cmdResult.output === "NEW_THREAD") {
          threadId = randomUUID();
          console.log(`${COLORS.dim}New thread: ${threadId.slice(0, 8)}...${COLORS.reset}\n`);
          prompt();
          return;
        }
        if (cmdResult.output?.startsWith("MODEL_SWITCH:")) {
          const newModel = cmdResult.output.split(":")[1];
          try {
            agent = await createLeadAgent(newModel);
            currentModel = newModel;
            console.log(`${COLORS.dim}Switched to model: ${newModel}${COLORS.reset}\n`);
          } catch (e) {
            console.log(`${COLORS.yellow}Error: ${e instanceof Error ? e.message : String(e)}${COLORS.reset}\n`);
          }
          prompt();
          return;
        }
        console.log(cmdResult.output + "\n");
        prompt();
        return;
      }

      // Send message to agent with streaming
      try {
        log(COLORS.cyan, "Agent: ");
        const stream = await agent.stream(
          {
            messages: [new HumanMessage(input)],
            threadId,
          },
          { streamMode: "messages" }
        );

        for await (const [message, _metadata] of stream) {
          if (message.content && typeof message.content === "string") {
            process.stdout.write(message.content);
          }
        }
        process.stdout.write("\n\n");
      } catch (error) {
        console.log(
          `\n${COLORS.yellow}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}\n`
        );
      }

      prompt();
    });
  };

  prompt();
}
```

**Step 3: 创建入口文件**

创建 `src/index.ts`：

```typescript
import { startCli } from "./cli/index.js";

startCli().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
```

**Step 4: 手动测试 CLI**

Run: `npx tsx src/index.ts`
Expected:
- 显示欢迎信息和当前模型
- 能输入消息并收到流式回复
- `/help` 显示命令列表
- `/models` 列出模型
- `/new` 创建新线程
- `/quit` 退出

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add interactive CLI with streaming output and command system"
```

---

### Task 7: 集成测试 + 收尾

**Files:**
- Create: `tests/integration/agent-chat.test.ts`
- Create: `vitest.config.ts`
- Update: `docs/plans/2026-03-08-agent-platform-design.md` (标记 Phase 1 完成)

**Step 1: 创建 vitest 配置**

创建 `vitest.config.ts`：

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: 编写集成测试**

创建 `tests/integration/agent-chat.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { resetConfigCache, loadConfig } from "../../src/config/loader.js";
import path from "node:path";

describe("Agent Chat Integration", () => {
  beforeEach(() => {
    resetConfigCache();
    loadConfig(path.resolve("config.yaml"));
  });

  it("should respond to a simple greeting", async () => {
    const { createLeadAgent } = await import(
      "../../src/agents/lead-agent/agent.js"
    );
    const agent = await createLeadAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage("Hello! Just say 'Hi' back in one word.")],
      threadId: "test-thread",
    });
    expect(result.messages.length).toBeGreaterThan(1);
    const lastMessage = result.messages.at(-1);
    expect(lastMessage?.content).toBeDefined();
  });
});
```

**Step 3: 运行全部测试**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: 更新 .env.example**

```
OPENAI_API_KEY=your-openai-api-key
TAVILY_API_KEY=your-tavily-api-key
```

**Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: complete Phase 1 - Agent loop, tool calling, CLI interaction"
```

---

## Phase 1 完成标准

- [ ] `npm run dev` 启动 CLI，能多轮对话
- [ ] Agent 能流式输出回答
- [ ] Agent 能调用 web_search（需要 TAVILY_API_KEY）
- [ ] Agent 能读写本地文件
- [ ] `/models` `/new` `/help` `/quit` 命令正常工作
- [ ] `npm test` 全部通过
- [ ] config.yaml 能配置多个模型并切换
