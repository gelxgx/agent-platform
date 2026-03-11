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

export const lsTool = tool(
  async ({ path: dirPath, recursive }, runManager) => {
    try {
      const threadId = getThreadId(runManager);
      const config = loadConfig();

      let physicalPath: string;
      if (config.sandbox?.enabled) {
        physicalPath = toPhysicalPath(dirPath ?? "/workspace", threadId);
        if (!isPathSafe(physicalPath, threadId)) {
          throw new Error("Path is outside the thread sandbox.");
        }
      } else {
        physicalPath = path.resolve(dirPath ?? ".");
      }

      if (!fs.existsSync(physicalPath)) {
        return `Directory not found: ${dirPath ?? "."}`;
      }

      const entries = fs.readdirSync(physicalPath, { withFileTypes: true });
      const lines: string[] = [];

      for (const entry of entries) {
        const prefix = entry.isDirectory() ? "📁 " : "📄 ";
        lines.push(`${prefix}${entry.name}`);

        if (recursive && entry.isDirectory()) {
          try {
            const subEntries = fs.readdirSync(
              path.join(physicalPath, entry.name),
              { withFileTypes: true }
            );
            for (const sub of subEntries.slice(0, 20)) {
              const subPrefix = sub.isDirectory() ? "📁 " : "📄 ";
              lines.push(`  ${subPrefix}${sub.name}`);
            }
            if (subEntries.length > 20) {
              lines.push(`  ... and ${subEntries.length - 20} more`);
            }
          } catch {
            lines.push(`  (permission denied)`);
          }
        }
      }

      return lines.join("\n") || "(empty directory)";
    } catch (error) {
      return `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "ls",
    description: "List files and directories. Defaults to /workspace in sandbox mode.",
    schema: z.object({
      path: z
        .string()
        .optional()
        .describe("Directory path to list (default: /workspace)"),
      recursive: z
        .boolean()
        .optional()
        .describe("List subdirectories recursively (1 level deep)"),
    }),
  }
);
