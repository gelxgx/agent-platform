import type { StructuredToolInterface } from "@langchain/core/tools";
import { loadConfig } from "../config/loader.js";
import { webSearchTool } from "./builtins/web-search.js";
import { webFetchTool } from "./builtins/web-fetch.js";
import { readFileTool, writeFileTool } from "./builtins/file-ops.js";
import { bashExecTool } from "./builtins/bash-exec.js";
import { pythonExecTool } from "./builtins/python-exec.js";
import { askClarificationTool } from "./builtins/ask-clarification.js";
import { getMcpTools } from "../mcp/client.js";

const BUILTIN_TOOLS: Record<string, StructuredToolInterface> = {
  web_search: webSearchTool,
  web_fetch: webFetchTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  bash_exec: bashExecTool,
  python_exec: pythonExecTool,
  ask_clarification: askClarificationTool,
};

export function registerBuiltinTool(
  name: string,
  tool: StructuredToolInterface
): void {
  BUILTIN_TOOLS[name] = tool;
}

export function getAvailableTools(): StructuredToolInterface[] {
  const config = loadConfig();
  const enabledToolNames = config.tools
    .filter((t) => t.enabled)
    .map((t) => t.name);

  return enabledToolNames
    .map((name) => BUILTIN_TOOLS[name])
    .filter((t): t is StructuredToolInterface => t !== undefined);
}

/**
 * Get all available tools: built-in + MCP.
 * MCP tools depend on initializeMcpClient() having been called first.
 */
export function getAllTools(): StructuredToolInterface[] {
  const builtins = getAvailableTools();
  const mcpTools = getMcpTools();
  return [...builtins, ...mcpTools];
}

export function getToolByName(name: string): StructuredToolInterface | undefined {
  return BUILTIN_TOOLS[name];
}
