import type { MemoryData } from "../../memory/types.js";
import type { SkillMeta } from "../../skills/types.js";

export interface SandboxContext {
  workspace: string;
  files: string[];
}

export interface PromptOptions {
  memory?: MemoryData;
  skills?: SkillMeta[];
  subagentEnabled?: boolean;
  mcpToolNames?: string[];
  sandboxContext?: SandboxContext;
  maxInjectionFacts?: number;
}

export function buildSystemPrompt(options?: PromptOptions): string {
  const now = new Date().toISOString();
  let prompt = `You are a helpful AI assistant powered by agent-platform.

Current time: ${now}

## Capabilities

You have access to tools that allow you to:
- Search the web for real-time information
- Fetch web page content
- Read and write files on the local filesystem`;

  if (options?.subagentEnabled) {
    prompt += `\n- Delegate complex sub-tasks to specialized agents via the "task" tool`;
  }

  prompt += `

## Guidelines

1. Use tools when the task requires external information or actions.
2. Be concise and direct in your responses.
3. When using web search, synthesize the results into a coherent answer.
4. When writing files, always confirm what was written.
5. If you're unsure about something, say so rather than guessing.
6. Think step by step for complex tasks.
7. When the user's request is ambiguous or missing critical information, use the ask_clarification tool to ask for more details before proceeding. Do NOT guess.`;

  if (options?.subagentEnabled) {
    prompt += buildSubagentSection();
  }

  if (options?.skills?.length) {
    prompt += buildSkillsSection(options.skills);
  }

  if (options?.mcpToolNames?.length) {
    prompt += buildMcpSection(options.mcpToolNames);
  }

  if (options?.sandboxContext) {
    prompt += buildSandboxSection(options.sandboxContext);
  }

  if (options?.memory) {
    prompt += buildMemorySection(options.memory, options.maxInjectionFacts);
  }

  return prompt;
}

function buildSubagentSection(): string {
  return `

## Task Delegation

You can delegate sub-tasks to specialized agents using the "task" tool.
Use delegation when:
- A task has clearly separable sub-parts that can be worked on independently
- A sub-task requires focused, deep work (e.g. researching one specific topic)
- Multiple sub-tasks can be executed in parallel

Do NOT delegate when:
- The task is simple enough to handle directly
- The task requires back-and-forth with the user
- Sub-tasks are tightly dependent on each other`;
}

function buildSkillsSection(skills: SkillMeta[]): string {
  const parts: string[] = ["\n\n## Available Skills"];
  parts.push("The following skills are available. Reference them when the task matches their domain:\n");
  for (const skill of skills) {
    parts.push(`- **${skill.name}**: ${skill.description}`);
  }
  return parts.join("\n");
}

function buildMemorySection(memory: MemoryData, maxFacts?: number): string {
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
    const limit = maxFacts ?? 15;
    const topFacts = memory.facts
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
    for (const fact of topFacts) {
      parts.push(`- ${fact.content}`);
    }
  }

  parts.push("</memory>");
  return parts.join("\n");
}

function buildMcpSection(toolNames: string[]): string {
  return `\n\n## External Tools (MCP)\n\nThe following tools are provided by external MCP servers:\n${toolNames.map((n) => `- ${n}`).join("\n")}\n\nThese tools work the same as built-in tools. Use them when relevant to the task.`;
}

function buildSandboxSection(ctx: SandboxContext): string {
  let section = `\n\n## Sandbox Environment

You have access to a sandboxed workspace for code execution.
- Working directory: \`${ctx.workspace}\`
- Use \`bash_exec\` to run shell commands
- Use \`python_exec\` to run Python code
- All file paths are relative to the workspace`;

  if (ctx.files.length > 0) {
    section += `\n\nCurrent workspace contents:\n${ctx.files.map((f) => `- ${f}`).join("\n")}`;
  }

  return section;
}
