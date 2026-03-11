import { Hono } from "hono";
import { MemoryStore } from "../../memory/store.js";
import { loadConfig } from "../../config/loader.js";

const memory = new Hono();

memory.get("/", (c) => {
  const config = loadConfig();
  const store = new MemoryStore(config.memory);
  const data = store.load();
  return c.json(data);
});

memory.delete("/facts", (c) => {
  const config = loadConfig();
  const store = new MemoryStore(config.memory);
  const data = store.load();
  data.facts = [];
  data.lastUpdated = new Date().toISOString();
  store.save(data);
  return c.json({ message: "Facts cleared" });
});

export { memory };
