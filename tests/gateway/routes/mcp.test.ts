import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../../../src/mcp/client.js", () => ({
  listMcpServers: vi.fn(() => [
    { name: "test-server", transport: "stdio", enabled: true },
  ]),
  getMcpTools: vi.fn(() => [
    { name: "test_tool", description: "A test tool" },
  ]),
}));

const { mcp } = await import("../../../src/gateway/routes/mcp.js");

describe("MCP API", () => {
  const app = new Hono();
  app.route("/api/mcp", mcp);

  it("GET /api/mcp/servers should return server list", async () => {
    const res = await app.request("/api/mcp/servers");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0].name).toBe("test-server");
  });

  it("GET /api/mcp/tools should return tool list", async () => {
    const res = await app.request("/api/mcp/tools");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("test_tool");
    expect(body.tools[0].description).toBe("A test tool");
  });
});
