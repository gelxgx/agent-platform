import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { loadConfig } from "../config/loader.js";
import { models } from "./routes/models.js";
import { skills } from "./routes/skills.js";
import { memory } from "./routes/memory.js";
import { mcp } from "./routes/mcp.js";
import { chat } from "./routes/chat.js";
import { threads } from "./routes/threads.js";
import { uploads } from "./routes/uploads.js";
import { artifacts } from "./routes/artifacts.js";

export function createGateway(corsOrigins?: string[]) {
  const app = new Hono();

  const origins = corsOrigins ?? ["*"];
  app.use("*", cors({ origin: origins }));
  app.use("*", logger());

  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      version: "0.1.0",
      uptime: process.uptime(),
    });
  });

  app.route("/api/models", models);
  app.route("/api/skills", skills);
  app.route("/api/memory", memory);
  app.route("/api/mcp", mcp);
  app.route("/api/chat", chat);
  app.route("/api/threads", threads);
  app.route("/api/threads", uploads);
  app.route("/api/threads", artifacts);

  app.onError((err, c) => {
    console.error("[Gateway Error]", err);
    return c.json(
      { error: err.message ?? "Internal server error" },
      500,
    );
  });

  app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
  });

  return app;
}

export async function startGateway(port?: number) {
  const config = loadConfig();
  const gatewayPort = port ?? config.gateway?.port ?? 3000;
  const corsOrigins = config.gateway?.corsOrigins;

  if (config.mcp?.enabled) {
    const { initializeMcpClient } = await import("../mcp/client.js");
    await initializeMcpClient(config.mcp.configPath);
  }

  const app = createGateway(corsOrigins);

  serve({ fetch: app.fetch, port: gatewayPort }, () => {
    console.log(`Gateway API running at http://localhost:${gatewayPort}`);
  });
}
