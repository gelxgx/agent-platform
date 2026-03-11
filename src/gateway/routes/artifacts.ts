import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { getAgent } from "../agent-cache.js";

const THREADS_ROOT = path.resolve("data/threads");

const artifacts = new Hono();

artifacts.get("/:id/artifacts", async (c) => {
  const id = c.req.param("id");
  try {
    const agent = await getAgent();
    const state = await agent.getState({ configurable: { thread_id: id } });
    const artifactList = state?.values?.artifacts ?? [];
    return c.json({ artifacts: artifactList });
  } catch {
    return c.json({ artifacts: [] });
  }
});

artifacts.get("/:id/artifacts/*", (c) => {
  const id = c.req.param("id");
  const artifactPath = c.req.path.replace(
    `/api/threads/${id}/artifacts/`,
    ""
  );
  const physical = path.join(THREADS_ROOT, id, "workspace", artifactPath);

  if (!fs.existsSync(physical)) {
    return c.json({ error: "Artifact not found" }, 404);
  }

  const download = c.req.query("download") === "true";
  if (download) {
    const content = fs.readFileSync(physical);
    c.header(
      "Content-Disposition",
      `attachment; filename="${path.basename(artifactPath)}"`
    );
    return c.body(content);
  }

  const content = fs.readFileSync(physical, "utf-8");
  return c.text(content);
});

export { artifacts };
