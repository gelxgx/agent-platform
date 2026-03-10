import type { Middleware } from "../agents/middlewares/types.js";
import { loadConfig } from "../config/loader.js";
import { getThreadWorkspace } from "./path-mapper.js";
import fs from "node:fs";

export const sandboxMiddleware: Middleware = {
  name: "Sandbox",
  enabled: () => {
    const config = loadConfig();
    return config.sandbox?.enabled ?? false;
  },

  async beforeModel(state, _config) {
    if (!state.threadId) return;

    const workspace = getThreadWorkspace(state.threadId);
    fs.mkdirSync(workspace, { recursive: true });

    let fileList: string[] = [];
    try {
      fileList = fs.readdirSync(workspace);
    } catch {}

    return {
      stateUpdates: {
        _sandboxContext: {
          workspace: "/workspace",
          files: fileList,
        },
      } as any,
    };
  },
};
