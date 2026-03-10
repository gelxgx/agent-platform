import type { SubAgentDefinition } from "./types.js";

const registry = new Map<string, SubAgentDefinition>();

export function registerSubAgent(definition: SubAgentDefinition): void {
  registry.set(definition.name, definition);
}

export function getSubAgent(name: string): SubAgentDefinition | undefined {
  return registry.get(name);
}

export function listSubAgents(): SubAgentDefinition[] {
  return Array.from(registry.values());
}

registerSubAgent({
  name: "general-purpose",
  description: "A versatile agent that can use all available tools to complete tasks. Good for research, analysis, and general problem-solving.",
  systemPrompt: `You are a focused sub-agent tasked with completing a specific assignment.
Execute the task thoroughly and return a clear, structured result.
Do NOT ask for clarification — work with what you have.
Do NOT delegate to other agents — complete the task yourself.`,
});

registerSubAgent({
  name: "bash",
  description: "A command-line specialist for executing shell commands, file manipulation, and system tasks.",
  systemPrompt: `You are a command-line specialist sub-agent.
Your primary tool is bash command execution.
Execute commands carefully, check results, and return structured output.
Do NOT ask for clarification — work with what you have.`,
  allowedTools: ["read_file", "write_file"],
});
