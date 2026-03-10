export type FactCategory =
  | "preference"
  | "knowledge"
  | "context"
  | "behavior"
  | "goal";

export interface Fact {
  id: string;
  content: string;
  category: FactCategory;
  confidence: number; // 0-1
  createdAt: string;
  source?: string;
}

export interface UserContext {
  workContext: string;
  personalContext: string;
  topOfMind: string;
}

export interface MemoryData {
  userContext: UserContext;
  facts: Fact[];
  lastUpdated: string;
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

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  injectionEnabled: true,
  storagePath: "data/memory.json",
  debounceSeconds: 30,
  maxFacts: 100,
  factConfidenceThreshold: 0.7,
  maxInjectionFacts: 15,
};

export const EMPTY_MEMORY: MemoryData = {
  userContext: {
    workContext: "",
    personalContext: "",
    topOfMind: "",
  },
  facts: [],
  lastUpdated: new Date().toISOString(),
};
