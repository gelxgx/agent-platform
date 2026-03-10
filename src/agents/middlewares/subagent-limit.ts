import { AIMessage } from "@langchain/core/messages";
import type { Middleware } from "./types.js";

const MAX_CONCURRENT_SUBAGENTS = 3;

export const subagentLimitMiddleware: Middleware = {
  name: "SubagentLimit",
  enabled: (config) => config.subagentEnabled === true,

  async afterModel(_state, response, _config) {
    if (!response.tool_calls?.length) return;

    const taskCalls = response.tool_calls.filter((tc) => tc.name === "task");
    if (taskCalls.length <= MAX_CONCURRENT_SUBAGENTS) return;

    const nonTaskCalls = response.tool_calls.filter((tc) => tc.name !== "task");
    const limitedTaskCalls = taskCalls.slice(0, MAX_CONCURRENT_SUBAGENTS);
    const limitedCalls = [...nonTaskCalls, ...limitedTaskCalls];

    const limitedResponse = new AIMessage({
      content: response.content,
      tool_calls: limitedCalls,
    });

    return { response: limitedResponse };
  },
};
