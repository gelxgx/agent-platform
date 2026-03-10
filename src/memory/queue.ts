import type { BaseMessage } from "@langchain/core/messages";
import { MemoryUpdater } from "./updater.js";
import { DEFAULT_MEMORY_CONFIG, type MemoryConfig } from "./types.js";

interface QueueEntry {
  threadId: string;
  messages: BaseMessage[];
  timer: ReturnType<typeof setTimeout>;
}

export class MemoryQueue {
  private queue: Map<string, QueueEntry> = new Map();
  private updater: MemoryUpdater;
  private debounceMs: number;

  constructor(updater: MemoryUpdater, config?: Partial<MemoryConfig>) {
    this.updater = updater;
    const seconds = config?.debounceSeconds ?? DEFAULT_MEMORY_CONFIG.debounceSeconds;
    this.debounceMs = seconds * 1000;
  }

  enqueue(threadId: string, messages: BaseMessage[]): void {
    const existing = this.queue.get(threadId);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.processEntry(threadId);
    }, this.debounceMs);

    this.queue.set(threadId, { threadId, messages, timer });
  }

  private async processEntry(threadId: string): Promise<void> {
    const entry = this.queue.get(threadId);
    if (!entry) return;

    this.queue.delete(threadId);

    try {
      await this.updater.update(entry.messages);
    } catch (error) {
      console.error(`[MemoryQueue] Failed to update memory for thread ${threadId}:`, error);
    }
  }

  async flush(): Promise<void> {
    const entries = Array.from(this.queue.values());
    for (const entry of entries) {
      clearTimeout(entry.timer);
    }
    this.queue.clear();

    await Promise.allSettled(
      entries.map((entry) => this.updater.update(entry.messages))
    );
  }

  get pendingCount(): number {
    return this.queue.size;
  }
}
