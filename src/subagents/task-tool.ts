import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { executeSubAgent } from "./executor.js";
import { listSubAgents } from "./registry.js";

export function createTaskTool(modelName?: string) {
  const agentDescriptions = listSubAgents()
    .map((a) => `- "${a.name}": ${a.description}`)
    .join("\n");

  return tool(
    async ({ description, prompt, subagentType, maxTurns }) => {
      const result = await executeSubAgent(
        {
          id: "",
          description,
          prompt,
          subagentType,
          maxTurns,
        },
        modelName
      );

      if (result.status === "completed") {
        return result.result ?? "Task completed with no output.";
      }
      if (result.status === "timed_out") {
        return `Task timed out after ${Math.round((result.durationMs ?? 0) / 1000)}s.`;
      }
      return `Task failed: ${result.error}`;
    },
    {
      name: "task",
      description: `Delegate a sub-task to a specialized agent for independent execution.
Each sub-agent runs in its own isolated context with its own tools.
Use this when a task is complex enough to benefit from focused, independent work.

Available agent types:
${agentDescriptions}

Guidelines:
- Provide clear, specific descriptions and prompts
- Prefer "general-purpose" for most tasks
- Use "bash" for command-line focused work
- Sub-agents cannot delegate further (no recursive delegation)`,
      schema: z.object({
        description: z.string().describe("Brief description of what the sub-agent should accomplish"),
        prompt: z.string().describe("Detailed instructions for the sub-agent"),
        subagentType: z.enum(["general-purpose", "bash"]).describe("Type of sub-agent to use"),
        maxTurns: z.number().optional().default(20).describe("Maximum conversation turns for the sub-agent"),
      }),
    }
  );
}
