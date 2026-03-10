import type { StructuredToolInterface } from "@langchain/core/tools";
import { loadConfig } from "../config/loader.js";
import { webSearchTool } from "./builtins/web-search.js";
import { webFetchTool } from "./builtins/web-fetch.js";
import { readFileTool, writeFileTool } from "./builtins/file-ops.js";

const BUILTIN_TOOLS: Record<string, StructuredToolInterface> = {
  web_search: webSearchTool,
  web_fetch: webFetchTool,
  read_file: readFileTool,
  write_file: writeFileTool,
};

export function getAvailableTools(): StructuredToolInterface[] {
  const config = loadConfig();
  const enabledToolNames = config.tools
    .filter((t) => t.enabled)
    .map((t) => t.name);

  return enabledToolNames
    .map((name) => BUILTIN_TOOLS[name])
    .filter((t): t is StructuredToolInterface => t !== undefined);
}

export function getToolByName(name: string): StructuredToolInterface | undefined {
  return BUILTIN_TOOLS[name];
}
