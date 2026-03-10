export interface ModelConfig {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
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

export interface AppConfig {
  models: ModelConfig[];
  tools: ToolConfig[];
  defaultModel: string;
  memory?: MemoryConfig;
}
