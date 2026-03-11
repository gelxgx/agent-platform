import fs from "node:fs";
import path from "node:path";
import type { Middleware } from "./types.js";

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".ts", ".js", ".py"];
const MAX_FILE_SIZE = 50_000; // 50KB
const MAX_INJECTED_FILES = 5;

export interface UploadedFilesContext {
  fileNames: string[];
  fileContents: { name: string; content: string }[];
}

export const uploadsMiddleware: Middleware = {
  name: "Uploads",
  enabled: true,

  async beforeModel(state) {
    const uploadsPath = state.threadData?.uploadsPath;
    if (!uploadsPath || !fs.existsSync(uploadsPath)) return;

    const files = fs.readdirSync(uploadsPath);
    if (files.length === 0) return;

    const fileContents: { name: string; content: string }[] = [];
    for (const file of files) {
      const filePath = path.join(uploadsPath, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > MAX_FILE_SIZE) continue;

      const ext = path.extname(file).toLowerCase();
      if (TEXT_EXTENSIONS.includes(ext)) {
        fileContents.push({
          name: file,
          content: fs.readFileSync(filePath, "utf-8"),
        });
      }
    }

    return {
      stateUpdates: {
        _uploadedFiles: {
          fileNames: files,
          fileContents: fileContents.slice(0, MAX_INJECTED_FILES),
        },
      } as any,
    };
  },
};
