import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../../config/loader.js";
import { toPhysicalPath, isPathSafe } from "../../sandbox/path-mapper.js";

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

function getThreadId(runManager: unknown): string {
  return (
    (runManager as any)?.config?.configurable?.threadId ??
    (runManager as any)?.config?.configurable?.thread_id ??
    (runManager as any)?.configurable?.threadId ??
    (runManager as any)?.configurable?.thread_id ??
    "default"
  );
}

export const readFileTool = tool(
  async ({ filePath, startLine, endLine }, runManager) => {
    try {
      const threadId = getThreadId(runManager);
      const resolvedPath = resolveFilePath(filePath, threadId);
      const content = await fs.readFile(resolvedPath, "utf-8");
      const lines = content.split("\n");

      if (startLine !== undefined || endLine !== undefined) {
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        return lines.slice(start, end).join("\n");
      }
      return content;
    } catch (error) {
      return `Failed to read file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file. Optionally specify line range.",
    schema: z.object({
      filePath: z.string().describe("Path to the file to read"),
      startLine: z.number().optional().describe("Starting line number (1-based)"),
      endLine: z.number().optional().describe("Ending line number (inclusive)"),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content, append }, runManager) => {
    try {
      const threadId = getThreadId(runManager);
      const resolvedPath = resolveFilePath(filePath, threadId);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      if (append) {
        await fs.appendFile(resolvedPath, content, "utf-8");
        return `Content appended to ${filePath}`;
      }
      await fs.writeFile(resolvedPath, content, "utf-8");
      return `File written to ${filePath}`;
    } catch (error) {
      return `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates directories if they don't exist.",
    schema: z.object({
      filePath: z.string().describe("Path to the file to write"),
      content: z.string().describe("Content to write"),
      append: z.boolean().optional().default(false).describe("Append instead of overwrite"),
    }),
  }
);
