import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HumanMessage, type ContentBlock } from "@langchain/core/messages";
import { getAgent } from "../agent-cache.js";

const THREADS_ROOT = path.resolve("data/threads");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function buildHumanMessage(
  text: string,
  threadId: string,
  files?: string[]
): HumanMessage {
  if (!files || files.length === 0) {
    return new HumanMessage(text);
  }

  const uploadsDir = path.join(THREADS_ROOT, threadId, "uploads");
  const imageBlocks: (ContentBlock | ContentBlock.Text)[] = [];

  for (const filename of files) {
    const ext = path.extname(filename).toLowerCase();
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) continue;

    if (IMAGE_EXTENSIONS.has(ext)) {
      const data = fs.readFileSync(filePath);
      const base64 = data.toString("base64");
      const mime = MIME_MAP[ext] ?? "image/png";
      imageBlocks.push({
        type: "image",
        mimeType: mime,
        data: base64,
      } as ContentBlock.Multimodal.Image);
    }
  }

  if (imageBlocks.length === 0) {
    return new HumanMessage(text);
  }

  const content: (ContentBlock | ContentBlock.Text)[] = [
    { type: "text", text } as ContentBlock.Text,
    ...imageBlocks,
  ];
  return new HumanMessage({ content });
}

const chat = new Hono();

chat.post("/", async (c) => {
  const body = await c.req.json<{
    message: string;
    threadId?: string;
    model?: string;
    files?: string[];
    planMode?: boolean;
  }>();

  const threadId = body.threadId ?? randomUUID();
  const agent = await getAgent(body.model);
  const humanMessage = buildHumanMessage(body.message, threadId, body.files);

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "thread",
      data: JSON.stringify({ threadId }),
    });

    const result = await agent.stream(
      {
        messages: [humanMessage],
        threadId,
      },
      {
        streamMode: "messages",
        configurable: { thread_id: threadId, isPlanMode: body.planMode },
      },
    );

    let fullOutput = "";

    for await (const [message, _metadata] of result) {
      if (!message.content) continue;
      const text =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .map((b: any) =>
                  typeof b === "string" ? b : "text" in b ? b.text : "",
                )
                .join("")
            : "";

      if (text) {
        fullOutput += text;
        const displayText = text.replace("[CLARIFICATION_NEEDED] ", "");
        await stream.writeSSE({
          event: "token",
          data: JSON.stringify({ content: displayText }),
        });
      }
    }

    if (fullOutput.includes("[CLARIFICATION_NEEDED]")) {
      const question = fullOutput.replace("[CLARIFICATION_NEEDED] ", "").trim();
      await stream.writeSSE({
        event: "clarification",
        data: JSON.stringify({ question, threadId }),
      });
    }

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ threadId }),
    });
  });
});

chat.post("/invoke", async (c) => {
  const body = await c.req.json<{
    message: string;
    threadId?: string;
    model?: string;
    files?: string[];
    planMode?: boolean;
  }>();

  const threadId = body.threadId ?? randomUUID();
  const agent = await getAgent(body.model);
  const humanMessage = buildHumanMessage(body.message, threadId, body.files);

  const result = await agent.invoke(
    {
      messages: [humanMessage],
      threadId,
    },
    { configurable: { thread_id: threadId, isPlanMode: body.planMode } },
  );

  const lastMessage = result.messages.at(-1);
  const content =
    lastMessage && typeof lastMessage.content === "string"
      ? lastMessage.content
      : "";

  return c.json({ threadId, content });
});

export { chat };
