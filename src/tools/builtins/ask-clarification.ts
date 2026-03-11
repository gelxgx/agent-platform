import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const askClarificationTool = tool(
  async ({ question }) => {
    return `[CLARIFICATION_NEEDED] ${question}`;
  },
  {
    name: "ask_clarification",
    description:
      "Ask the user a clarifying question when you need more information to proceed. " +
      "Use this when the user's request is ambiguous, incomplete, or you need to confirm " +
      "an important assumption before taking action.",
    schema: z.object({
      question: z
        .string()
        .describe("The clarifying question to ask the user"),
    }),
  }
);
