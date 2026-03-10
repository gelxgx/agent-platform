import fs from "node:fs";
import path from "node:path";
import type { Middleware } from "./types.js";

const DATA_ROOT = path.resolve("data/threads");

export const threadDataMiddleware: Middleware = {
  name: "ThreadData",
  enabled: true,

  async beforeModel(state) {
    if (state.threadData) return;

    const threadDir = path.join(DATA_ROOT, state.threadId);
    const workspacePath = path.join(threadDir, "workspace");
    const uploadsPath = path.join(threadDir, "uploads");
    const outputsPath = path.join(threadDir, "outputs");

    for (const dir of [workspacePath, uploadsPath, outputsPath]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return {
      stateUpdates: {
        threadData: { workspacePath, uploadsPath, outputsPath },
      },
    };
  },
};
