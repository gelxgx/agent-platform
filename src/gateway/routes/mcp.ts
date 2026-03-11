import { Hono } from "hono";
import { listMcpServers, getMcpTools } from "../../mcp/client.js";

const mcp = new Hono();

mcp.get("/servers", (c) => {
  return c.json({ servers: listMcpServers() });
});

mcp.get("/tools", (c) => {
  return c.json({
    tools: getMcpTools().map((t) => ({
      name: t.name,
      description: t.description,
    })),
  });
});

export { mcp };
