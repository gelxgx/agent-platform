import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const webSearchTool = tool(
  async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Error: TAVILY_API_KEY not set. Please add it to your .env file.";
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: true,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        results?: { title: string; url: string; content: string }[];
      };
      if (data.answer) {
        const sources = (data.results ?? [])
          .map((r) => `- ${r.title}: ${r.url}`)
          .join("\n");
        return `${data.answer}\n\nSources:\n${sources}`;
      }
      return (data.results ?? [])
        .map((r) => `**${r.title}**\n${r.url}\n${r.content}`)
        .join("\n\n");
    } catch (error) {
      return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for real-time information. Use this when you need current data, facts, or information that may not be in your training data.",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().default(5).describe("Maximum number of results"),
    }),
  }
);
