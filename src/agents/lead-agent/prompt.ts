import type { MemoryData } from "../../memory/types.js";

export interface PromptOptions {
  memory?: MemoryData;
}

export function buildSystemPrompt(options?: PromptOptions): string {
  const now = new Date().toISOString();
  let prompt = `You are a helpful AI assistant powered by agent-platform.

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

  if (options?.memory) {
    prompt += buildMemorySection(options.memory);
  }

  return prompt;
}

function buildMemorySection(memory: MemoryData): string {
  const parts: string[] = ["\n\n## Memory\n\n<memory>"];

  const ctx = memory.userContext;
  if (ctx.workContext || ctx.personalContext || ctx.topOfMind) {
    parts.push("### User Context");
    if (ctx.workContext) parts.push(`- Work: ${ctx.workContext}`);
    if (ctx.personalContext) parts.push(`- Personal: ${ctx.personalContext}`);
    if (ctx.topOfMind) parts.push(`- Current focus: ${ctx.topOfMind}`);
    parts.push("");
  }

  if (memory.facts.length > 0) {
    parts.push("### Known Facts");
    const topFacts = memory.facts
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 15);
    for (const fact of topFacts) {
      parts.push(`- ${fact.content}`);
    }
  }

  parts.push("</memory>");
  return parts.join("\n");
}
