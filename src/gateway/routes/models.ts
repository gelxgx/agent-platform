import { Hono } from "hono";
import { loadConfig } from "../../config/loader.js";

const models = new Hono();

models.get("/", (c) => {
  const config = loadConfig();
  return c.json({
    models: config.models.map((m) => ({
      name: m.name,
      displayName: m.displayName,
      provider: m.provider,
      supportsVision: m.supportsVision,
      supportsThinking: m.supportsThinking,
    })),
    defaultModel: config.defaultModel,
  });
});

export { models };
