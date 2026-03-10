import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryQueue } from "../../src/memory/queue.js";
import { MemoryUpdater } from "../../src/memory/updater.js";
import { MemoryStore } from "../../src/memory/store.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const TEST_PATH = "data/test-queue-memory.json";

describe("MemoryQueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should debounce updates for the same thread", async () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, { enabled: false });
    const updateSpy = vi.spyOn(updater, "update").mockResolvedValue();

    const queue = new MemoryQueue(updater, { debounceSeconds: 0.1 });

    const messages1 = [new HumanMessage("first")];
    const messages2 = [new HumanMessage("second"), new AIMessage("response")];

    queue.enqueue("thread-1", messages1);
    queue.enqueue("thread-1", messages2);

    expect(queue.pendingCount).toBe(1);

    await new Promise((r) => setTimeout(r, 200));

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(messages2);
  });

  it("should process different threads independently", async () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, { enabled: false });
    const updateSpy = vi.spyOn(updater, "update").mockResolvedValue();

    const queue = new MemoryQueue(updater, { debounceSeconds: 0.1 });

    queue.enqueue("thread-1", [new HumanMessage("a")]);
    queue.enqueue("thread-2", [new HumanMessage("b")]);

    expect(queue.pendingCount).toBe(2);

    await new Promise((r) => setTimeout(r, 200));

    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it("should flush all pending entries immediately", async () => {
    const store = new MemoryStore({ storagePath: TEST_PATH });
    const updater = new MemoryUpdater(store, { enabled: false });
    const updateSpy = vi.spyOn(updater, "update").mockResolvedValue();

    const queue = new MemoryQueue(updater, { debounceSeconds: 60 });

    queue.enqueue("thread-1", [new HumanMessage("a")]);
    queue.enqueue("thread-2", [new HumanMessage("b")]);

    await queue.flush();

    expect(queue.pendingCount).toBe(0);
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });
});
