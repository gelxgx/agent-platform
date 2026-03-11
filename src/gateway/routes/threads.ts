import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getAgent } from "../agent-cache.js";

const THREADS_ROOT = path.resolve("data/threads");

const threads = new Hono();

threads.get("/", (c) => {
  if (!fs.existsSync(THREADS_ROOT)) {
    return c.json({ threads: [] });
  }
  const dirs = fs
    .readdirSync(THREADS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      id: d.name,
      createdAt: fs
        .statSync(path.join(THREADS_ROOT, d.name))
        .birthtime.toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ threads: dirs });
});

threads.get("/:id/messages", async (c) => {
  const id = c.req.param("id");
  try {
    const agent = await getAgent();
    const state = await agent.getState({ configurable: { thread_id: id } });

    if (!state?.values?.messages) {
      return c.json({ messages: [] });
    }

    const messages = state.values.messages
      .filter(
        (m: any) =>
          m instanceof HumanMessage || m instanceof AIMessage ||
          m._getType?.() === "human" || m._getType?.() === "ai",
      )
      .map((m: any) => {
        const type = m instanceof HumanMessage || m._getType?.() === "human"
          ? "human"
          : "ai";
        const content =
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .map((b: any) =>
                    typeof b === "string" ? b : "text" in b ? b.text : "",
                  )
                  .join("")
              : "";
        return {
          role: type === "human" ? "user" : "assistant",
          content,
        };
      })
      .filter((m: any) => m.content);

    return c.json({ messages });
  } catch {
    return c.json({ messages: [] });
  }
});

threads.get("/:id/todos", async (c) => {
  const id = c.req.param("id");
  try {
    const agent = await getAgent();
    const state = await agent.getState({ configurable: { thread_id: id } });
    return c.json({ todos: state?.values?.todos ?? [] });
  } catch {
    return c.json({ todos: [] });
  }
});

threads.get("/:id/files", (c) => {
  const id = c.req.param("id");
  const workspace = path.join(THREADS_ROOT, id, "workspace");
  if (!fs.existsSync(workspace)) {
    return c.json({ files: [] });
  }

  function listRecursive(dir: string, prefix = ""): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...listRecursive(path.join(dir, entry.name), relPath));
      } else {
        files.push(relPath);
      }
    }
    return files;
  }

  return c.json({ files: listRecursive(workspace) });
});

threads.get("/:id/files/*", (c) => {
  const id = c.req.param("id");
  const filePath = c.req.path.replace(`/api/threads/${id}/files/`, "");
  const physical = path.join(THREADS_ROOT, id, "workspace", filePath);

  if (!fs.existsSync(physical)) {
    return c.json({ error: "File not found" }, 404);
  }

  const content = fs.readFileSync(physical, "utf-8");
  return c.text(content);
});

threads.delete("/:id", (c) => {
  const id = c.req.param("id");
  const threadDir = path.join(THREADS_ROOT, id);
  if (fs.existsSync(threadDir)) {
    fs.rmSync(threadDir, { recursive: true });
  }
  return c.json({ message: `Thread ${id} deleted` });
});

export { threads };
