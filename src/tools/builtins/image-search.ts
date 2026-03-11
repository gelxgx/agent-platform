import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const imageSearchTool = tool(
  async ({ query, maxResults }) => {
    const limit = maxResults ?? 5;
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return "image_search is not available: TAVILY_API_KEY is not configured.";
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${query} images`,
          search_depth: "basic",
          include_images: true,
          max_results: limit,
        }),
      });

      if (!response.ok) {
        return `Image search failed with status ${response.status}.`;
      }

      const data = await response.json();
      const images = ((data as any).images ?? []).slice(0, limit) as string[];

      if (images.length === 0) {
        return `No images found for "${query}".`;
      }

      return images
        .map((img: string, i: number) => `${i + 1}. ${img}`)
        .join("\n");
    } catch (error) {
      return `Image search failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "image_search",
    description: "Search for images on the web. Returns image URLs.",
    schema: z.object({
      query: z.string().describe("Search query for images"),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of image results (default: 5)"),
    }),
  }
);
