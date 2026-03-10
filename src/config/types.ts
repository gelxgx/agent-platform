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
