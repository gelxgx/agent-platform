import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const writeTodosTool = tool(
  async ({ todos }) => {
    return JSON.stringify({ _todos: todos });
  },
  {
    name: "write_todos",
    description:
      "Create or update a task list for the current conversation. " +
      "Use this to plan multi-step work: list all steps, then work through them. " +
      "Mark items as completed as you finish them.",
    schema: z.object({
      todos: z.array(
        z.object({
          id: z.string().describe("Unique ID for the todo item"),
          title: z.string().describe("Short description of the task"),
          status: z
            .enum(["pending", "in_progress", "completed", "cancelled"])
            .describe("Current status"),
        })
      ),
    }),
  }
);
