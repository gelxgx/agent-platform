import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { McpServerConfig } from "./types.js";
import fs from "node:fs";
import path from "node:path";

let clientInstance: MultiServerMCPClient | null = null;
let cachedTools: StructuredToolInterface[] = [];

function resolveEnvValue(value: string): string {
  if (value.startsWith("$")) {
    return process.env[value.slice(1)] ?? "";
  }
  return value;
}

function resolveEnvInRecord(
  record?: Record<string, string>
): Record<string, string> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, resolveEnvValue(v)])
  );
}

/**
 * Load MCP server configs from the JSON config file.
 * Returns only enabled servers.
 */
export function loadMcpServerConfigs(configPath?: string): McpServerConfig[] {
  const filePath = path.resolve(configPath ?? "mcp_servers.json");
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { servers?: McpServerConfig[] };
  if (!parsed.servers || !Array.isArray(parsed.servers)) return [];

  return parsed.servers
    .filter((s) => s.enabled !== false)
    .map((s) => ({
      ...s,
      env: resolveEnvInRecord(s.env),
      headers: resolveEnvInRecord(s.headers),
    }));
}

/**
 * Convert our McpServerConfig[] into the format accepted by MultiServerMCPClient.
 */
function buildClientConfig(servers: McpServerConfig[]) {
  const config: Record<
    string,
    | { transport: "stdio"; command: string; args: string[]; env?: Record<string, string> }
    | { transport: "http"; url: string; headers?: Record<string, string> }
  > = {};
  for (const server of servers) {
    if (server.transport === "stdio") {
      config[server.name] = {
        transport: "stdio",
        command: server.command!,
        args: server.args ?? [],
        env: server.env,
      };
    } else if (server.transport === "http") {
      config[server.name] = {
        transport: "http",
        url: server.url!,
        headers: server.headers,
      };
    }
  }
  return config;
}

/**
 * Initialize the MCP client, connect to all configured servers,
 * and return the tools they expose.
 */
export async function initializeMcpClient(
  configPath?: string
): Promise<StructuredToolInterface[]> {
  if (clientInstance) return cachedTools;

  const servers = loadMcpServerConfigs(configPath);
  if (servers.length === 0) return [];

  const mcpServers = buildClientConfig(servers);
  clientInstance = new MultiServerMCPClient({ mcpServers });

  cachedTools = await clientInstance.getTools();
  console.log(
    `[MCP] Connected to ${servers.length} server(s), loaded ${cachedTools.length} tool(s)`
  );
  return cachedTools;
}

/**
 * Get previously loaded MCP tools (does not re-initialize).
 */
export function getMcpTools(): StructuredToolInterface[] {
  return cachedTools;
}

/**
 * Close all MCP connections and clear cached state.
 */
export async function closeMcpClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    cachedTools = [];
    console.log("[MCP] All connections closed");
  }
}

/**
 * List all configured MCP servers (including disabled ones).
 */
export function listMcpServers(configPath?: string): McpServerConfig[] {
  const filePath = path.resolve(configPath ?? "mcp_servers.json");
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { servers?: McpServerConfig[] };
  return parsed.servers ?? [];
}

/**
 * Reset internal state (for testing).
 */
export function resetMcpClient(): void {
  clientInstance = null;
  cachedTools = [];
}
