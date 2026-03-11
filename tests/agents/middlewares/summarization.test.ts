import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { SummarizationConfig } from "../../../src/config/types.js";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

vi.mock("../../../src/utils/token-estimator.js", () => ({
  estimateTokens: vi.fn(),
  getModelMaxTokens: vi.fn().mockReturnValue(100_000),
}));

vi.mock("../../../src/models/factory.js", () => ({
  createChatModel: vi.fn().mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({ content: "This is a conversation summary." }),
  }),
}));

import { createSummarizationMiddleware } from "../../../src/agents/middlewares/summarization.js";
import { estimateTokens, getModelMaxTokens } from "../../../src/utils/token-estimator.js";

const defaultConfig: SummarizationConfig = {
  enabled: true,
  maxTokenFraction: 0.7,
  keepRecentMessages: 2,
};

const runtimeConfig: RuntimeConfig = {
  modelName: "gpt-4o",
  threadId: "test-thread",
};

function makeState(messageCount: number): AgentStateType {
  const messages = [];
  for (let i = 0; i < messageCount; i++) {
    messages.push(
      i % 2 === 0
        ? new HumanMessage(`User message ${i}`)
        : new AIMessage(`AI response ${i}`)
    );
  }
  return {
    messages,
    threadId: "test-thread",
    title: undefined,
    artifacts: [],
  } as AgentStateType;
}

describe("SummarizationMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getModelMaxTokens).mockReturnValue(100_000);
  });

  it("should not trigger when token count is below threshold", async () => {
    vi.mocked(estimateTokens).mockReturnValue(50_000);

    const mw = createSummarizationMiddleware(defaultConfig);
    const state = makeState(10);
    const result = await mw.beforeModel!(state, runtimeConfig);

    expect(result).toBeUndefined();
  });

  it("should trigger compression when token count exceeds threshold", async () => {
    vi.mocked(estimateTokens).mockReturnValue(80_000);

    const mw = createSummarizationMiddleware(defaultConfig);
    const state = makeState(10);
    const result = await mw.beforeModel!(state, runtimeConfig);

    expect(result).toBeDefined();
    expect(result!.messages).toBeDefined();
    // Summary message + keepRecentMessages(2)
    expect(result!.messages!.length).toBe(3);
    // First message should be the summary (SystemMessage)
    expect(result!.messages![0]).toBeInstanceOf(SystemMessage);
    expect((result!.messages![0].content as string)).toContain("Previous conversation summary:");
  });

  it("should keep the correct number of recent messages", async () => {
    vi.mocked(estimateTokens).mockReturnValue(80_000);

    const config: SummarizationConfig = { ...defaultConfig, keepRecentMessages: 4 };
    const mw = createSummarizationMiddleware(config);
    const state = makeState(10);
    const result = await mw.beforeModel!(state, runtimeConfig);

    expect(result!.messages!.length).toBe(5); // 1 summary + 4 recent
    // Last 4 messages should match original last 4
    const originalLast4 = state.messages.slice(-4);
    expect(result!.messages!.slice(1)).toEqual(originalLast4);
  });

  it("should skip when disabled", async () => {
    const disabledConfig: SummarizationConfig = { ...defaultConfig, enabled: false };
    const mw = createSummarizationMiddleware(disabledConfig);

    expect(mw.enabled).toBe(false);
  });

  it("should not trigger when message count is less than keepRecentMessages", async () => {
    vi.mocked(estimateTokens).mockReturnValue(80_000);

    const mw = createSummarizationMiddleware(defaultConfig);
    const state = makeState(2); // only 2 messages, keepRecentMessages is 2
    const result = await mw.beforeModel!(state, runtimeConfig);

    expect(result).toBeUndefined();
  });
});
