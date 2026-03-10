import { randomUUID } from "node:crypto";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/factory.js";
import { MemoryStore } from "./store.js";
import { MEMORY_EXTRACTION_PROMPT } from "./prompts.js";
import {
  type MemoryData,
  type MemoryConfig,
  type Fact,
  DEFAULT_MEMORY_CONFIG,
} from "./types.js";

interface ExtractionResult {
  userContext: {
    workContext: string;
    personalContext: string;
    topOfMind: string;
  };
  newFacts: Array<{
    content: string;
    category: string;
    confidence: number;
  }>;
}

export class MemoryUpdater {
  private store: MemoryStore;
  private config: MemoryConfig;

  constructor(store: MemoryStore, config?: Partial<MemoryConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  async update(messages: BaseMessage[]): Promise<void> {
    if (!this.config.enabled) return;

    const conversation = this.formatConversation(messages);
    if (!conversation) return;

    const currentMemory = this.store.load();
    const extraction = await this.extract(conversation, currentMemory);
    if (!extraction) return;

    this.applyUpdates(currentMemory, extraction);
  }

  private formatConversation(messages: BaseMessage[]): string | null {
    const relevant = messages.filter(
      (m) => HumanMessage.isInstance(m) || AIMessage.isInstance(m)
    );
    if (relevant.length === 0) return null;

    return relevant
      .map((m) => {
        const role = HumanMessage.isInstance(m) ? "User" : "Assistant";
        const content = typeof m.content === "string" ? m.content : "";
        return `${role}: ${content}`;
      })
      .join("\n");
  }

  private async extract(
    conversation: string,
    currentMemory: MemoryData
  ): Promise<ExtractionResult | null> {
    try {
      const model = await createChatModel(this.config.modelName ?? undefined);

      const prompt = MEMORY_EXTRACTION_PROMPT
        .replace("{CURRENT_MEMORY}", JSON.stringify(currentMemory, null, 2))
        .replace("{CONVERSATION}", conversation);

      const response = await model.invoke([new HumanMessage(prompt)]);
      const text = typeof response.content === "string" ? response.content : "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]) as ExtractionResult;
    } catch {
      return null;
    }
  }

  private applyUpdates(
    currentMemory: MemoryData,
    extraction: ExtractionResult
  ): void {
    const ctx = extraction.userContext;
    if (ctx.workContext) currentMemory.userContext.workContext = ctx.workContext;
    if (ctx.personalContext) currentMemory.userContext.personalContext = ctx.personalContext;
    if (ctx.topOfMind) currentMemory.userContext.topOfMind = ctx.topOfMind;

    const existingContents = new Set(currentMemory.facts.map((f) => f.content.toLowerCase()));

    for (const newFact of extraction.newFacts) {
      if (newFact.confidence < this.config.factConfidenceThreshold) continue;
      if (existingContents.has(newFact.content.toLowerCase())) continue;

      const fact: Fact = {
        id: randomUUID(),
        content: newFact.content,
        category: newFact.category as Fact["category"],
        confidence: newFact.confidence,
        createdAt: new Date().toISOString(),
      };
      currentMemory.facts.push(fact);
    }

    if (currentMemory.facts.length > this.config.maxFacts) {
      currentMemory.facts.sort((a, b) => b.confidence - a.confidence);
      currentMemory.facts = currentMemory.facts.slice(0, this.config.maxFacts);
    }

    currentMemory.lastUpdated = new Date().toISOString();
    this.store.save(currentMemory);
  }
}
