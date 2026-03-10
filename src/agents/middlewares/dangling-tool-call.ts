import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { Middleware } from "./types.js";

export const danglingToolCallMiddleware: Middleware = {
  name: "DanglingToolCall",
  enabled: true,

  async beforeModel(state) {
    const messages = [...state.messages];
    const patchedMessages = [];
    let patched = false;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      patchedMessages.push(msg);

      if (!AIMessage.isInstance(msg) || !msg.tool_calls?.length) continue;

      const toolCallIds = new Set(msg.tool_calls.map((tc) => tc.id));
      const respondedIds = new Set<string>();

      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        if (ToolMessage.isInstance(next) && next.tool_call_id) {
          respondedIds.add(next.tool_call_id);
        }
        if (AIMessage.isInstance(next)) break;
      }

      for (const tcId of toolCallIds) {
        if (tcId && !respondedIds.has(tcId)) {
          patchedMessages.push(
            new ToolMessage({
              tool_call_id: tcId,
              content: "[Tool call was interrupted and did not complete]",
            })
          );
          patched = true;
        }
      }
    }

    if (patched) {
      return { messages: patchedMessages };
    }
  },
};
