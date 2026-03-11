import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { createLeadAgent } from "./agents/lead-agent/agent.js";
import { loadConfig } from "./config/loader.js";
import { initializeMcpClient } from "./mcp/client.js";

export class AgentPlatformClient {
  private agent: Awaited<ReturnType<typeof createLeadAgent>> | null = null;
  private modelName?: string;

  constructor(options?: { model?: string }) {
    this.modelName = options?.model;
  }

  async initialize(): Promise<void> {
    const config = loadConfig();
    if (config.mcp?.enabled) {
      await initializeMcpClient(config.mcp.configPath);
    }
    this.agent = await createLeadAgent(this.modelName);
  }

  private async ensureAgent() {
    if (!this.agent) await this.initialize();
    return this.agent!;
  }

  async chat(message: string, threadId?: string): Promise<string> {
    const agent = await this.ensureAgent();
    const tid = threadId ?? randomUUID();

    const result = await agent.invoke(
      { messages: [new HumanMessage(message)], threadId: tid },
      { configurable: { thread_id: tid } },
    );

    const last = result.messages.at(-1);
    return typeof last?.content === "string" ? last.content : "";
  }

  async *stream(message: string, threadId?: string): AsyncGenerator<string> {
    const agent = await this.ensureAgent();
    const tid = threadId ?? randomUUID();

    const result = await agent.stream(
      { messages: [new HumanMessage(message)], threadId: tid },
      { streamMode: "messages", configurable: { thread_id: tid } },
    );

    for await (const [msg] of result) {
      if (typeof msg.content === "string" && msg.content) {
        yield msg.content;
      }
    }
  }
}
