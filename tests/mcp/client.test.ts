import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadMcpServerConfigs,
  listMcpServers,
  getMcpTools,
  resetMcpClient,
} from "../../src/mcp/client.js";
import fs from "node:fs";
import path from "node:path";

describe("MCP Client", () => {
  beforeEach(() => {
    resetMcpClient();
  });

  describe("loadMcpServerConfigs", () => {
    it("should return empty array if config file does not exist", () => {
      const servers = loadMcpServerConfigs("/nonexistent/path.json");
      expect(servers).toEqual([]);
    });

    it("should load enabled servers from config file", () => {
      const servers = loadMcpServerConfigs(path.resolve("mcp_servers.json"));
      // All servers in the default config are disabled
      expect(servers).toEqual([]);
    });

    it("should load from custom config with enabled servers", () => {
      const tmpPath = path.resolve("data/_test_mcp_config.json");
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      fs.writeFileSync(
        tmpPath,
        JSON.stringify({
          servers: [
            { name: "test-server", transport: "stdio", command: "echo", args: ["hello"], enabled: true },
            { name: "disabled-server", transport: "http", url: "http://localhost", enabled: false },
          ],
        })
      );

      try {
        const servers = loadMcpServerConfigs(tmpPath);
        expect(servers).toHaveLength(1);
        expect(servers[0].name).toBe("test-server");
        expect(servers[0].transport).toBe("stdio");
        expect(servers[0].command).toBe("echo");
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });

    it("should handle empty servers array", () => {
      const tmpPath = path.resolve("data/_test_mcp_empty.json");
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      fs.writeFileSync(tmpPath, JSON.stringify({ servers: [] }));

      try {
        const servers = loadMcpServerConfigs(tmpPath);
        expect(servers).toEqual([]);
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });
  });

  describe("listMcpServers", () => {
    it("should list all servers including disabled", () => {
      const servers = listMcpServers(path.resolve("mcp_servers.json"));
      expect(servers.length).toBeGreaterThanOrEqual(2);
      expect(servers.some((s) => s.name === "filesystem")).toBe(true);
      expect(servers.some((s) => s.name === "custom-api")).toBe(true);
    });

    it("should return empty for missing file", () => {
      const servers = listMcpServers("/nonexistent/path.json");
      expect(servers).toEqual([]);
    });
  });

  describe("getMcpTools", () => {
    it("should return empty array before initialization", () => {
      const tools = getMcpTools();
      expect(tools).toEqual([]);
    });
  });
});
