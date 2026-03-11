import { describe, it, expect } from "vitest";
import { todoListMiddleware } from "../../../src/agents/middlewares/todo-list.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";

function makeState(overrides: Partial<AgentStateType> = {}): AgentStateType {
  return {
    messages: [],
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
    todos: [],
    threadData: undefined,
    ...overrides,
  } as AgentStateType;
}

describe("todoListMiddleware", () => {
  it("should have the correct name", () => {
    expect(todoListMiddleware.name).toBe("TodoList");
  });

  it("should be enabled only in plan mode", () => {
    const enabledFn = todoListMiddleware.enabled as (config: RuntimeConfig) => boolean;

    expect(enabledFn({ modelName: "test", threadId: "t1", isPlanMode: true })).toBe(true);
    expect(enabledFn({ modelName: "test", threadId: "t1", isPlanMode: false })).toBe(false);
    expect(enabledFn({ modelName: "test", threadId: "t1" })).toBe(false);
  });

  it("should inject _todosContext when todos exist", async () => {
    const state = makeState({
      todos: [
        { id: "1", title: "Research", status: "completed" },
        { id: "2", title: "Implement", status: "in_progress" },
      ],
    });
    const config: RuntimeConfig = { modelName: "test", threadId: "t1", isPlanMode: true };

    const result = await todoListMiddleware.beforeModel!(state, config);

    expect(result).toBeDefined();
    expect((result!.stateUpdates as any)._todosContext).toEqual(state.todos);
  });

  it("should return undefined when todos are empty", async () => {
    const state = makeState({ todos: [] });
    const config: RuntimeConfig = { modelName: "test", threadId: "t1", isPlanMode: true };

    const result = await todoListMiddleware.beforeModel!(state, config);

    expect(result).toBeUndefined();
  });

  it("should return undefined when todos are not set", async () => {
    const state = makeState();
    const config: RuntimeConfig = { modelName: "test", threadId: "t1", isPlanMode: true };

    const result = await todoListMiddleware.beforeModel!(state, config);

    expect(result).toBeUndefined();
  });
});
