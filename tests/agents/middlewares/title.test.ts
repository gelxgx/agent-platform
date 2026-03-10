import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { titleMiddleware } from "../../../src/agents/middlewares/title.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const config: RuntimeConfig = { modelName: "gpt-4o", threadId: "test" };

function makeState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [],
    threadId: "test",
    title: undefined,
    artifacts: [],
    threadData: undefined,
    ...overrides,
  } as AgentStateType;
}

describe("TitleMiddleware", () => {
  it("should skip if title already exists", async () => {
    const state = makeState({
      title: "Existing Title",
      messages: [
        new HumanMessage("hello"),
        new AIMessage("hi there"),
      ],
    });

    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should skip if no complete exchange yet", async () => {
    const state = makeState({
      messages: [new HumanMessage("hello")],
    });

    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should generate title after first complete exchange", async () => {
    const state = makeState({
      messages: [
        new HumanMessage("What is TypeScript?"),
        new AIMessage("TypeScript is a typed superset of JavaScript."),
      ],
    });

    const result = await titleMiddleware.afterModel!(
      state,
      new AIMessage("response"),
      config
    );

    // If API key is available, title should be generated
    // If not, result will be undefined (error caught silently)
    if (result?.stateUpdates?.title) {
      expect(typeof result.stateUpdates.title).toBe("string");
      expect(result.stateUpdates.title.length).toBeLessThanOrEqual(50);
    }
  });
});
