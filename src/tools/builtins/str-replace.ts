import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../config/loader.js";
import { toPhysicalPath, isPathSafe } from "../../sandbox/path-mapper.js";

function getThreadId(runManager: unknown): string {
  return (
    (runManager as any)?.config?.configurable?.threadId ??
    (runManager as any)?.config?.configurable?.thread_id ??
    (runManager as any)?.configurable?.threadId ??
    (runManager as any)?.configurable?.thread_id ??
    "default"
  );
}

function resolveFilePath(filePath: string, threadId: string): string {
  const config = loadConfig();
  if (config.sandbox?.enabled) {
    const physical = toPhysicalPath(filePath, threadId);
    if (!isPathSafe(physical, threadId)) {
      throw new Error("Path is outside the thread sandbox.");
    }
    return physical;
  }
  return path.resolve(filePath);
}

export const strReplaceTool = tool(
  async ({ filePath, oldStr, newStr }, runManager) => {
    try {
      const threadId = getThreadId(runManager);
      const physical = resolveFilePath(filePath, threadId);

      if (!fs.existsSync(physical)) {
        return `File not found: ${filePath}`;
      }

      const content = fs.readFileSync(physical, "utf-8");
      const occurrences = content.split(oldStr).length - 1;

      if (occurrences === 0) {
        return `String not found in ${filePath}. No changes made.`;
      }

      if (occurrences > 1) {
        return `Found ${occurrences} occurrences of the string. Please provide more context to make the match unique.`;
      }

      const newContent = content.replace(oldStr, newStr);
      fs.writeFileSync(physical, newContent, "utf-8");

      return `Replaced 1 occurrence in ${filePath}.`;
    } catch (error) {
      return `Failed to replace: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "str_replace",
    description:
      "Replace a unique string in a file. The old_str must appear exactly once. " +
      "Use this for precise, surgical edits instead of rewriting entire files.",
    schema: z.object({
      filePath: z.string().describe("Path to the file"),
      oldStr: z.string().describe("The exact string to find (must be unique in the file)"),
      newStr: z.string().describe("The replacement string"),
    }),
  }
);
