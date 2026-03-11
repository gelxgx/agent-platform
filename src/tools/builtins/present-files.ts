import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "node:path";
import { randomUUID } from "node:crypto";

function inferArtifactType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap: Record<string, string> = {
    ".md": "markdown",
    ".html": "webpage",
    ".py": "code",
    ".ts": "code",
    ".js": "code",
    ".json": "data",
    ".csv": "data",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".pdf": "document",
    ".txt": "text",
  };
  return typeMap[ext] ?? "file";
}

export const presentFilesTool = tool(
  async ({ files }) => {
    const artifacts = files.map((f) => ({
      id: randomUUID(),
      type: inferArtifactType(f.path),
      path: f.path,
      title: f.title ?? path.basename(f.path),
      createdAt: new Date().toISOString(),
    }));

    return JSON.stringify({
      _artifacts: artifacts,
      message: `Presented ${files.length} file(s) to the user.`,
    });
  },
  {
    name: "present_files",
    description:
      "Present files to the user as downloadable artifacts. Use this after creating or generating files that the user should see or download.",
    schema: z.object({
      files: z.array(
        z.object({
          path: z
            .string()
            .describe("Path to the file (relative to /workspace)"),
          title: z
            .string()
            .optional()
            .describe("Display title for the file"),
        })
      ),
    }),
  }
);
