import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { getAgent } from "../agent-cache.js";

const chat = new Hono();

chat.post("/", async (c) => {
  const body = await c.req.json<{
    message: string;
    threadId?: string;
    model?: string;
  }>();

  const threadId = body.threadId ?? randomUUID();
  const agent = await getAgent(body.model);

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "thread",
      data: JSON.stringify({ threadId }),
    });

    const result = await agent.stream(
      {
        messages: [new HumanMessage(body.message)],
        threadId,
      },
      {
        streamMode: "messages",
        configurable: { thread_id: threadId },
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
        await stream.writeSSE({
          event: "token",
          data: JSON.stringify({ content: text }),
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
  }>();

  const threadId = body.threadId ?? randomUUID();
  const agent = await getAgent(body.model);

  const result = await agent.invoke(
    {
      messages: [new HumanMessage(body.message)],
      threadId,
    },
    { configurable: { thread_id: threadId } },
  );

  const lastMessage = result.messages.at(-1);
  const content =
    lastMessage && typeof lastMessage.content === "string"
      ? lastMessage.content
      : "";

  return c.json({ threadId, content });
});

export { chat };
