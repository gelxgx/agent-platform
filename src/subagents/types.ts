import type { StructuredToolInterface } from "@langchain/core/tools";

export interface SubAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  /** Tool names this subagent can use. Empty = all tools except "task" */
  allowedTools?: string[];
  maxTurns?: number;
}

export interface SubAgentTask {
  id: string;
  description: string;
  prompt: string;
  subagentType: string;
  maxTurns?: number;
}

export type SubAgentStatus = "pending" | "running" | "completed" | "failed" | "timed_out";

export interface SubAgentResult {
  taskId: string;
  status: SubAgentStatus;
  result?: string;
  error?: string;
  durationMs?: number;
}
