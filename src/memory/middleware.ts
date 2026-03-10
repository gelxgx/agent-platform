import type { Middleware } from "../agents/middlewares/types.js";
import { MemoryStore } from "./store.js";
import { MemoryUpdater } from "./updater.js";
import { MemoryQueue } from "./queue.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  type MemoryConfig,
  type MemoryData,
  DEFAULT_MEMORY_CONFIG,
} from "./types.js";

let sharedStore: MemoryStore | null = null;
let sharedQueue: MemoryQueue | null = null;

function getStore(config: MemoryConfig): MemoryStore {
  if (!sharedStore) {
    sharedStore = new MemoryStore(config);
  }
  return sharedStore;
}

function getQueue(config: MemoryConfig): MemoryQueue {
  if (!sharedQueue) {
    const store = getStore(config);
    const updater = new MemoryUpdater(store, config);
    sharedQueue = new MemoryQueue(updater, config);
  }
  return sharedQueue;
}

export function createMemoryMiddleware(
  config?: Partial<MemoryConfig>
): Middleware & { getMemoryData: () => MemoryData; flushQueue: () => Promise<void> } {
  const memConfig = { ...DEFAULT_MEMORY_CONFIG, ...config };

  const middleware: Middleware & { getMemoryData: () => MemoryData; flushQueue: () => Promise<void> } = {
    name: "Memory",
    enabled: memConfig.enabled,

    async beforeModel(state, _runtimeConfig) {
      if (!memConfig.injectionEnabled) return;

      const store = getStore(memConfig);
      const memory = store.load();

      if (!memory.facts.length && !memory.userContext.workContext) return;

      return {
        stateUpdates: {
          _memoryContext: memory,
        } as any,
      };
    },

    async afterModel(state, response, runtimeConfig) {
      const relevantMessages = state.messages.filter(
        (m) => HumanMessage.isInstance(m) || AIMessage.isInstance(m)
      );

      const allMessages = [...relevantMessages, response];

      const queue = getQueue(memConfig);
      queue.enqueue(runtimeConfig.threadId, allMessages);
    },

    getMemoryData(): MemoryData {
      const store = getStore(memConfig);
      return store.load();
    },

    async flushQueue(): Promise<void> {
      const queue = getQueue(memConfig);
      await queue.flush();
    },
  };

  return middleware;
}

export function resetMemoryInstances(): void {
  sharedStore = null;
  sharedQueue = null;
}
