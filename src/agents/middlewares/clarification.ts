import type { Middleware } from "./types.js";

export const clarificationMiddleware: Middleware = {
  name: "Clarification",
  enabled: true,

  async afterModel(_state, response, _config) {
    const clarificationCall = response.tool_calls?.find(
      (tc) => tc.name === "ask_clarification"
    );

    if (!clarificationCall) return;

    const question =
      clarificationCall.args?.question ?? "Could you provide more details?";

    return {
      stateUpdates: {
        _clarificationNeeded: {
          question,
          toolCallId: clarificationCall.id,
        },
      } as any,
    };
  },
};
