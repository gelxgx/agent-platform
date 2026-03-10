import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createChatModel } from "../../models/factory.js";
import type { Middleware } from "./types.js";

const TITLE_PROMPT = `Based on the conversation below, generate a concise title (max 8 words, no quotes). Just output the title, nothing else.`;

export const titleMiddleware: Middleware = {
  name: "Title",
  enabled: true,

  async afterModel(state, response, config) {
    if (state.title) return;

    const humanMessages = state.messages.filter((m) => HumanMessage.isInstance(m));
    const aiMessages = state.messages.filter((m) => AIMessage.isInstance(m));

    if (humanMessages.length < 1 || aiMessages.length < 1) return;

    try {
      const model = await createChatModel(config.modelName);
      const conversation = state.messages
        .filter((m) => HumanMessage.isInstance(m) || AIMessage.isInstance(m))
        .slice(0, 4)
        .map((m) => {
          const role = HumanMessage.isInstance(m) ? "User" : "Assistant";
          return `${role}: ${typeof m.content === "string" ? m.content.slice(0, 200) : ""}`;
        })
        .join("\n");

      const titleResponse = await model.invoke([
        new HumanMessage(`${TITLE_PROMPT}\n\n${conversation}`),
      ]);

      const title =
        typeof titleResponse.content === "string"
          ? titleResponse.content.trim().slice(0, 50)
          : undefined;

      if (title) {
        return { stateUpdates: { title } };
      }
    } catch {
      // Title generation is non-critical; silently ignore failures
    }
  },
};
