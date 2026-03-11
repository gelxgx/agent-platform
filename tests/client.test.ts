import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
const mockStream = vi.fn();

vi.mock("../src/agents/lead-agent/agent.js", () => ({
  createLeadAgent: vi.fn(async () => ({
    invoke: mockInvoke,
    stream: mockStream,
  })),
}));

vi.mock("../src/config/loader.js", () => ({
  loadConfig: vi.fn(() => ({ mcp: { enabled: false } })),
}));

vi.mock("../src/mcp/client.js", () => ({
  initializeMcpClient: vi.fn(),
}));

const { AgentPlatformClient } = await import("../src/client.js");

describe("AgentPlatformClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chat() should return response string", async () => {
    mockInvoke.mockResolvedValue({
      messages: [{ content: "Hello from agent" }],
    });

    const client = new AgentPlatformClient();
    const response = await client.chat("Hi");

    expect(response).toBe("Hello from agent");
    expect(mockInvoke).toHaveBeenCalledOnce();
  });

  it("chat() should use provided threadId", async () => {
    mockInvoke.mockResolvedValue({
      messages: [{ content: "Response" }],
    });

    const client = new AgentPlatformClient();
    await client.chat("Hi", "my-thread-id");

    const callArgs = mockInvoke.mock.calls[0];
    expect(callArgs[0].threadId).toBe("my-thread-id");
    expect(callArgs[1].configurable.thread_id).toBe("my-thread-id");
  });

  it("stream() should yield content chunks", async () => {
    async function* mockGenerator() {
      yield [{ content: "Hello" }];
      yield [{ content: " world" }];
    }
    mockStream.mockResolvedValue(mockGenerator());

    const client = new AgentPlatformClient();
    const chunks: string[] = [];
    for await (const chunk of client.stream("Hi")) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("should auto-initialize on first call", async () => {
    mockInvoke.mockResolvedValue({
      messages: [{ content: "Ok" }],
    });

    const client = new AgentPlatformClient({ model: "test-model" });
    await client.chat("test");

    const { createLeadAgent } = await import("../src/agents/lead-agent/agent.js");
    expect(createLeadAgent).toHaveBeenCalledWith("test-model");
  });
});
