# Agent Platform — 架构设计文档

> 日期：2026-03-08
> 状态：已确认，待实施

## 1. 项目概览

**项目名称**：agent-platform

**定位**：基于 LangGraph.js 的全 TypeScript Agent 框架，参考 DeerFlow 2.0 架构设计，采用渐进式分层方案从零构建。

**目标**：
- 从学习和实践出发，理解 Agent 架构核心原理
- 逐步演进为通用型超级 Agent / 垂直领域 Agent / 可嵌入 SDK
- 全 TypeScript 技术栈，对前端工程师友好

**技术选型**：
| 领域 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 全栈统一，用户熟悉 |
| Agent 编排 | LangGraph.js | 和 DeerFlow 思路一致，API 与 Python 版近似 |
| LLM 抽象 | LangChain.js | 模型提供商统一抽象 |
| MCP 集成 | @langchain/mcp-adapters | 官方 JS 版，功能对等 |
| CLI 交互 | @inquirer/prompts 或 readline | 轻量，快速出成果 |
| Gateway API | Hono（Phase 6） | 现代、类型安全、高性能 |
| Web UI | Next.js（Phase 6） | 和 DeerFlow 一致 |
| 模型提供商 | 多 Provider 抽象，先实现 OpenAI | 映射表 + dynamic import |

## 2. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  CLI / Web UI                    │  交互层（Phase 1 CLI / Phase 6 Web）
├─────────────────────────────────────────────────┤
│                 Gateway API                      │  接入层（Phase 6）
├─────────────────────────────────────────────────┤
│               Lead Agent                         │  编排层
│  ┌───────────────────────────────────────────┐  │
│  │          Middleware Chain                  │  │  Phase 2
│  │  (context → uploads → sandbox → memory    │  │
│  │   → title → summarization → subagent)     │  │
│  └───────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  Tools   │ │SubAgents │ │   Skills     │    │  Phase 1/4
│  └──────────┘ └──────────┘ └──────────────┘    │
├─────────────────────────────────────────────────┤
│              Core Services                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  Memory  │ │ Sandbox  │ │     MCP      │    │  Phase 3/5
│  └──────────┘ └──────────┘ └──────────────┘    │
├─────────────────────────────────────────────────┤
│           Model Provider Layer                   │  Phase 1
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  OpenAI  │ │ Claude   │ │  DeepSeek..  │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────┘
```

## 3. 项目目录结构

```
agent-platform/
├── package.json
├── tsconfig.json
├── config.yaml                    # 主配置文件
├── .env                           # API keys
├── src/
│   ├── index.ts                   # 入口
│   ├── cli/                       # CLI 交互
│   │   └── index.ts
│   ├── agents/                    # Agent 系统
│   │   ├── lead-agent/            # 主 Agent
│   │   │   ├── agent.ts           # LangGraph 图定义
│   │   │   └── prompt.ts          # 系统提示词
│   │   ├── middlewares/           # 中间件
│   │   │   ├── types.ts           # 中间件接口
│   │   │   ├── chain.ts           # 中间件链
│   │   │   └── ...                # 各中间件实现
│   │   └── thread-state.ts        # 线程状态定义
│   ├── models/                    # 模型抽象层
│   │   ├── factory.ts             # 模型工厂
│   │   └── types.ts               # 模型接口
│   ├── tools/                     # 工具系统
│   │   ├── registry.ts            # 工具注册表
│   │   ├── builtins/              # 内置工具
│   │   └── types.ts
│   ├── memory/                    # 记忆系统（Phase 3）
│   ├── subagents/                 # 子 Agent（Phase 4）
│   ├── skills/                    # 技能系统（Phase 4）
│   ├── sandbox/                   # 沙盒系统（Phase 5）
│   ├── mcp/                       # MCP 集成（Phase 5）
│   ├── gateway/                   # Gateway API（Phase 6）
│   ├── config/                    # 配置系统
│   │   ├── loader.ts
│   │   └── types.ts
│   └── utils/                     # 通用工具
├── skills/                        # 技能文件目录
│   ├── public/
│   └── custom/
├── data/                          # 运行时数据
│   ├── threads/                   # 线程数据
│   └── memory.json                # 记忆存储
├── docs/                          # 文档
│   └── plans/
└── tests/                         # 测试
```

## 4. Phase 1 详细设计 — Agent 循环 + 工具调用 + CLI

### 4.1 模型抽象层

配置驱动的模型工厂，支持多 Provider：

```yaml
# config.yaml
models:
  - name: "gpt-4o"
    display_name: "GPT-4o"
    provider: "openai"
    model: "gpt-4o"
    api_key: "$OPENAI_API_KEY"
    max_tokens: 4096
    temperature: 0.7
    supports_thinking: false
    supports_vision: true
```

Provider 映射表 + dynamic import（替代 DeerFlow 的 Python 反射）：

```typescript
const PROVIDER_MAP: Record<string, () => Promise<any>> = {
  openai: () => import("@langchain/openai").then(m => m.ChatOpenAI),
  anthropic: () => import("@langchain/anthropic").then(m => m.ChatAnthropic),
};

async function createChatModel(name: string): Promise<BaseChatModel> {
  const modelConfig = getModelConfig(name);
  const ModelClass = await PROVIDER_MAP[modelConfig.provider]();
  return new ModelClass({
    modelName: modelConfig.model,
    apiKey: resolveEnvVar(modelConfig.api_key),
    maxTokens: modelConfig.max_tokens,
    temperature: modelConfig.temperature,
  });
}
```

### 4.2 线程状态

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

const ThreadState = Annotation.Root({
  ...MessagesAnnotation.spec,
  threadId: Annotation<string>(),
  title: Annotation<string | undefined>(),
  artifacts: Annotation<Artifact[]>({
    reducer: mergeArtifacts,
    default: () => [],
  }),
});
```

### 4.3 Lead Agent 图定义

经典 ReAct 循环：

```
START → callModel → shouldContinue? ─(有工具调用)→ callTools → callModel
                         │
                    (无工具调用)
                         ▼
                        END
```

使用 LangGraph.js 的 StateGraph 实现，callModel 节点调用 LLM 并绑定工具，shouldContinue 检查 AIMessage 是否包含 tool_calls，callTools 节点并行执行工具调用并返回 ToolMessage。

### 4.4 内置工具（Phase 1）

| 工具名 | 功能 | 实现 |
|--------|------|------|
| web_search | 网页搜索 | Tavily API |
| web_fetch | 抓取网页内容 | fetch + readability 提取 |
| read_file | 读取本地文件 | fs.readFile |
| write_file | 写入本地文件 | fs.writeFile |

工具使用 LangChain.js 的 `tool()` 函数 + Zod schema 定义。

### 4.5 配置系统

- 主配置：`config.yaml`，使用 `js-yaml` 解析
- 环境变量：`.env`，使用 `dotenv` 加载
- `$VAR` 语法：配置值以 `$` 开头时自动解析为环境变量
- 配置查找优先级：`AGENT_PLATFORM_CONFIG_PATH` 环境变量 → 当前目录 `config.yaml` → 项目根目录

### 4.6 CLI 交互

- 多轮对话：基于 readline 或 @inquirer/prompts
- 流式输出：LangGraph stream 模式，token 逐字打印
- 命令系统：`/new`（新对话）、`/models`（列出模型）、`/quit`（退出）
- 线程管理：每个对话一个线程，分配唯一 threadId

## 5. Phase 2-6 演进路线

### Phase 2：中间件系统

可插拔中间件管道，分 beforeModel / afterModel 两个阶段：

```typescript
interface Middleware {
  name: string;
  enabled: boolean | ((config: RuntimeConfig) => boolean);
  beforeModel?: (state: ThreadState, config: RuntimeConfig) => Promise<ThreadState>;
  afterModel?: (state: ThreadState, response: AIMessage, config: RuntimeConfig) => Promise<AIMessage>;
}
```

Phase 2 实现：ThreadDataMiddleware、TitleMiddleware、DanglingToolCallMiddleware。

### Phase 3：记忆系统

三层架构：MemoryMiddleware（注入/收集） → MemoryUpdater（LLM 事实提取） → MemoryStore（JSON 持久化）。

数据结构：userContext（workContext / personalContext / topOfMind）+ facts 数组（带 category、confidence 评分）。

工作流程：对话结束 → 30s 防抖 → LLM 提取 → 原子写入 memory.json → 下次对话注入。

### Phase 4：子 Agent + 技能系统

子 Agent：Lead Agent 通过 `task` 工具委派，内置 general-purpose 和 bash 两种子 Agent，最大并发 3，15 分钟超时。

技能系统：Markdown SKILL.md + YAML frontmatter，渐进加载到系统提示词，支持 public/custom 两个目录。

### Phase 5：MCP + 沙盒

MCP：使用 @langchain/mcp-adapters 的 MultiServerMCPClient，支持 stdio/HTTP/SSE，配置在 extensions_config.json。

沙盒：先实现 LocalSandboxProvider（本地文件系统执行），后期用 dockerode 自研 Docker 隔离（JS 生态无等价的 agent-sandbox 库）。

虚拟路径系统：Agent 看到 /mnt/user-data/... 虚拟路径，底层映射到 data/threads/{threadId}/... 物理路径。

### Phase 6：Gateway API + Web UI

Gateway API：使用 Hono 框架，路由设计与 DeerFlow FastAPI 对齐（/api/models、/api/skills、/api/memory、/api/mcp/config 等）。

Web UI：Next.js，对话界面 + 文件管理 + 技能配置 + 记忆查看。

## 6. JS 生态差异汇总

| 领域 | DeerFlow Python | agent-platform TypeScript | 差异级别 |
|------|----------------|--------------------------|---------|
| Agent 编排 | LangGraph Python | LangGraph.js | ⭐ 低 |
| MCP 协议 | langchain-mcp-adapters | @langchain/mcp-adapters | ⭐ 低 |
| 模型动态加载 | resolve_variable() 反射 | Provider 映射表 + dynamic import | ⭐ 低 |
| 检查点持久化 | langgraph-checkpoint-sqlite | @langchain/langgraph-checkpoint | ⭐ 低 |
| Docker 沙盒 | agent-sandbox 库 | dockerode 自研 | ⭐⭐⭐ 高 |
| 文档转换 | markitdown | mammoth + pdf-parse 组合 | ⭐⭐ 中 |
| Gateway API | FastAPI | Hono | ⭐ 低 |
| Nginx 代理 | 必需 | 不需要 | ⭐ 低（更简单） |
| IM 渠道集成 | 内置 Telegram/Slack/飞书 | 需自研 | ⭐⭐ 中 |

## 7. 与 DeerFlow 架构对应关系

| DeerFlow 组件 | agent-platform 对应 | 所属 Phase |
|--------------|--------------------|-----------| 
| lead_agent/ | src/agents/lead-agent/ | Phase 1 |
| middlewares/ (11个) | src/agents/middlewares/ | Phase 2+ |
| thread_state.py | src/agents/thread-state.ts | Phase 1 |
| models/factory.py | src/models/factory.ts | Phase 1 |
| tools/builtins/ | src/tools/builtins/ | Phase 1 |
| community/ (tavily等) | src/tools/builtins/ | Phase 1 |
| memory/ | src/memory/ | Phase 3 |
| subagents/ | src/subagents/ | Phase 4 |
| skills/ | src/skills/ | Phase 4 |
| sandbox/ | src/sandbox/ | Phase 5 |
| mcp/ | src/mcp/ | Phase 5 |
| gateway/ | src/gateway/ | Phase 6 |
| config/ | src/config/ | Phase 1 |
| client.py | src/client.ts（嵌入式客户端） | Phase 6 |
