import { createLeadAgent } from "../agents/lead-agent/agent.js";

type AgentGraph = Awaited<ReturnType<typeof createLeadAgent>>;

const cache = new Map<string, AgentGraph>();

export async function getAgent(modelName?: string): Promise<AgentGraph> {
  const key = modelName ?? "default";
  if (!cache.has(key)) {
    cache.set(key, await createLeadAgent(modelName));
  }
  return cache.get(key)!;
}
