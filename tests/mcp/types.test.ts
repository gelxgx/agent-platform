import { describe, it, expect, beforeEach } from "vitest";
import type { McpServerConfig, McpConfig, McpTransport } from "../../src/mcp/types.js";
import type { SandboxConfig, McpConfig as ConfigMcpConfig } from "../../src/config/types.js";
import { loadConfig, resetConfigCache } from "../../src/config/loader.js";
import path from "node:path";

describe("MCP Types", () => {
  it("should allow stdio transport config", () => {
    const config: McpServerConfig = {
      name: "test-server",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      enabled: true,
    };
    expect(config.transport).toBe("stdio");
    expect(config.command).toBe("npx");
  });

  it("should allow http transport config", () => {
    const config: McpServerConfig = {
      name: "remote-server",
      transport: "http",
      url: "http://localhost:8000/mcp",
      headers: { Authorization: "Bearer token" },
      enabled: true,
    };
    expect(config.transport).toBe("http");
    expect(config.url).toBe("http://localhost:8000/mcp");
  });

  it("should have optional fields default to undefined", () => {
    const config: McpServerConfig = {
      name: "minimal",
      transport: "stdio",
    };
    expect(config.command).toBeUndefined();
    expect(config.args).toBeUndefined();
    expect(config.env).toBeUndefined();
    expect(config.url).toBeUndefined();
    expect(config.headers).toBeUndefined();
    expect(config.enabled).toBeUndefined();
  });

  it("should define McpConfig with enabled and configPath", () => {
    const config: McpConfig = {
      enabled: true,
      configPath: "mcp_servers.json",
    };
    expect(config.enabled).toBe(true);
    expect(config.configPath).toBe("mcp_servers.json");
  });

  it("should allow McpTransport as union type", () => {
    const stdio: McpTransport = "stdio";
    const http: McpTransport = "http";
    expect(stdio).toBe("stdio");
    expect(http).toBe("http");
  });
});

describe("Config types extension", () => {
  beforeEach(() => resetConfigCache());

  it("should load mcp config from config.yaml", () => {
    const config = loadConfig(path.resolve("config.yaml"));
    expect(config.mcp).toBeDefined();
    expect(config.mcp!.enabled).toBe(true);
    expect(config.mcp!.configPath).toBe("mcp_servers.json");
  });

  it("should load sandbox config from config.yaml", () => {
    const config = loadConfig(path.resolve("config.yaml"));
    expect(config.sandbox).toBeDefined();
    expect(config.sandbox!.enabled).toBe(true);
    expect(config.sandbox!.provider).toBe("local");
    expect(config.sandbox!.timeoutMs).toBe(30000);
    expect(config.sandbox!.maxOutputSize).toBe(65536);
    expect(config.sandbox!.allowedCommands).toEqual([]);
    expect(config.sandbox!.blockedCommands).toContain("rm -rf /");
  });

  it("SandboxConfig should have correct shape", () => {
    const sandbox: SandboxConfig = {
      enabled: true,
      provider: "local",
      timeoutMs: 30000,
      maxOutputSize: 65536,
      allowedCommands: [],
      blockedCommands: ["rm -rf /"],
    };
    expect(sandbox.provider).toBe("local");
    expect(sandbox.blockedCommands).toHaveLength(1);
  });
});
