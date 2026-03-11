import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { uploadsMiddleware } from "../../../src/agents/middlewares/uploads.js";
import { HumanMessage } from "@langchain/core/messages";
import type { RuntimeConfig } from "../../../src/agents/middlewares/types.js";
import type { AgentStateType } from "../../../src/agents/thread-state.js";

const TEST_THREAD_ID = "test-uploads-mw";
const THREAD_DIR = path.resolve(`data/threads/${TEST_THREAD_ID}`);
const UPLOADS_DIR = path.join(THREAD_DIR, "uploads");

const config: RuntimeConfig = {
  modelName: "test",
  threadId: TEST_THREAD_ID,
};

function makeState(uploadsPath?: string): AgentStateType {
  return {
    messages: [new HumanMessage("test")],
    threadId: TEST_THREAD_ID,
    title: undefined,
    artifacts: [],
    threadData: uploadsPath
      ? { workspacePath: "", uploadsPath, outputsPath: "" }
      : undefined,
  } as AgentStateType;
}

afterEach(() => {
  if (fs.existsSync(THREAD_DIR)) {
    fs.rmSync(THREAD_DIR, { recursive: true, force: true });
  }
});

describe("UploadsMiddleware", () => {
  it("should return undefined when no threadData", async () => {
    const result = await uploadsMiddleware.beforeModel!(makeState(), config);
    expect(result).toBeUndefined();
  });

  it("should return undefined when uploads dir does not exist", async () => {
    const result = await uploadsMiddleware.beforeModel!(
      makeState("/nonexistent/path"),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should return undefined when uploads dir is empty", async () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const result = await uploadsMiddleware.beforeModel!(
      makeState(UPLOADS_DIR),
      config
    );
    expect(result).toBeUndefined();
  });

  it("should inject file names and contents for text files", async () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, "notes.txt"), "Hello world");
    fs.writeFileSync(path.join(UPLOADS_DIR, "data.json"), '{"a":1}');

    const result = await uploadsMiddleware.beforeModel!(
      makeState(UPLOADS_DIR),
      config
    );

    expect(result).toBeDefined();
    const uploadedFiles = (result!.stateUpdates as any)._uploadedFiles;
    expect(uploadedFiles).toBeDefined();
    expect(uploadedFiles.fileNames).toContain("notes.txt");
    expect(uploadedFiles.fileNames).toContain("data.json");
    expect(uploadedFiles.fileContents.length).toBe(2);
  });

  it("should skip files larger than 50KB", async () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, "small.txt"), "small");
    fs.writeFileSync(path.join(UPLOADS_DIR, "large.txt"), "x".repeat(60_000));

    const result = await uploadsMiddleware.beforeModel!(
      makeState(UPLOADS_DIR),
      config
    );

    const uploadedFiles = (result!.stateUpdates as any)._uploadedFiles;
    expect(uploadedFiles.fileNames).toContain("small.txt");
    expect(uploadedFiles.fileNames).toContain("large.txt");
    const contentNames = uploadedFiles.fileContents.map((f: any) => f.name);
    expect(contentNames).toContain("small.txt");
    expect(contentNames).not.toContain("large.txt");
  });

  it("should limit injected files to 5", async () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    for (let i = 0; i < 8; i++) {
      fs.writeFileSync(path.join(UPLOADS_DIR, `file${i}.txt`), `content${i}`);
    }

    const result = await uploadsMiddleware.beforeModel!(
      makeState(UPLOADS_DIR),
      config
    );

    const uploadedFiles = (result!.stateUpdates as any)._uploadedFiles;
    expect(uploadedFiles.fileNames.length).toBe(8);
    expect(uploadedFiles.fileContents.length).toBe(5);
  });
});
