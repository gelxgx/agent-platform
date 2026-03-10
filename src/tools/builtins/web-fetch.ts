import { tool } from "@langchain/core/tools";
import { z } from "zod";

const MAX_CONTENT_LENGTH = 8000;

export const webFetchTool = tool(
  async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "AgentPlatform/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
      }
      const text = await response.text();
      const content = text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]"
        : text;
      return content;
    } catch (error) {
      return `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "web_fetch",
    description: "Fetch the content of a web page. Returns the raw text content of the URL.",
    schema: z.object({
      url: z.string().url().describe("The URL to fetch"),
    }),
  }
);
