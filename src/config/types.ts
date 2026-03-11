export interface ModelConfig {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  /** Model context window size (defaults to 128000 if not set) */
  contextWindow?: number;
  supportsThinking?: boolean;
  supportsVision?: boolean;
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
}

export interface MemoryConfig {
  enabled: boolean;
  injectionEnabled: boolean;
  storagePath: string;
  debounceSeconds: number;
  modelName?: string;
  maxFacts: number;
  factConfidenceThreshold: number;
  maxInjectionFacts: number;
}

export interface SubagentsConfig {
  enabled: boolean;
}

export interface SkillsConfig {
  enabled: boolean;
  path?: string;
}

export interface McpConfig {
  enabled: boolean;
  configPath?: string;
}

export interface SandboxConfig {
  enabled: boolean;
  provider: "local" | "docker";
  timeoutMs: number;
  maxOutputSize: number;
  allowedCommands: string[];
  blockedCommands: string[];
}

export interface CheckpointerConfig {
  provider: "memory" | "sqlite";
  path?: string;
}

export interface SummarizationConfig {
  enabled: boolean;
  /** Trigger compression when estimated tokens exceed this fraction of model maxTokens (0-1) */
  maxTokenFraction: number;
  /** Keep the most recent N original messages after compression */
  keepRecentMessages: number;
  /** Model used for generating summaries (null uses the default model) */
  modelName?: string;
}

export interface GatewayConfig {
  enabled: boolean;
  port: number;
  corsOrigins?: string[];
}

export interface AppConfig {
  models: ModelConfig[];
  tools: ToolConfig[];
  defaultModel: string;
  memory?: MemoryConfig;
  subagents?: SubagentsConfig;
  skills?: SkillsConfig;
  mcp?: McpConfig;
  sandbox?: SandboxConfig;
  checkpointer?: CheckpointerConfig;
  gateway?: GatewayConfig;
  summarization?: SummarizationConfig;
}
