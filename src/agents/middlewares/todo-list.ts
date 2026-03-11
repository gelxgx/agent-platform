import type { Middleware } from "./types.js";

export const todoListMiddleware: Middleware = {
  name: "TodoList",
  enabled: (config) => config.isPlanMode === true,

  async beforeModel(state) {
    const todos = state.todos;
    if (!todos || todos.length === 0) return;

    return {
      stateUpdates: {
        _todosContext: todos,
      } as any,
    };
  },
};
