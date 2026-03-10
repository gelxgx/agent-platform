import { describe, it, expect, afterAll } from "vitest";
import { LocalSandbox } from "../../src/sandbox/local-sandbox.js";
import { toPhysicalPath, getThreadWorkspace } from "../../src/sandbox/path-mapper.js";
import type { SandboxConfig } from "../../src/sandbox/types.js";
import fs from "node:fs";
import path from "node:path";

const SANDBOX_CONFIG: SandboxConfig = {
  enabled: true,
  provider: "local",
  timeoutMs: 10000,
  maxOutputSize: 65536,
  allowedCommands: [],
  blockedCommands: ["rm -rf /", "shutdown", "reboot"],
};

const THREAD_A = "integration-thread-a";
const THREAD_B = "integration-thread-b";

afterAll(() => {
  for (const tid of [THREAD_A, THREAD_B]) {
    fs.rmSync(path.resolve(`data/threads/${tid}`), {
      recursive: true,
      force: true,
    });
  }
});

describe("Sandbox Integration", () => {
  const sandbox = new LocalSandbox(SANDBOX_CONFIG);

  it("should execute bash commands and capture output", async () => {
    const result = await sandbox.execute({
      command: 'echo "integration test"',
      threadId: THREAD_A,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("integration test");
  });

  it("should execute Python scripts via bash", async () => {
    const result = await sandbox.execute({
      command: 'python3 -c "print(2 ** 10)"',
      threadId: THREAD_A,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("1024");
  });

  it("should isolate files between threads", async () => {
    // Thread A creates a file
    await sandbox.execute({
      command: 'echo "thread-a-data" > secret.txt',
      threadId: THREAD_A,
    });

    // Thread B should not see the file
    const result = await sandbox.execute({
      command: "cat secret.txt 2>&1 || echo FILE_NOT_FOUND",
      threadId: THREAD_B,
    });
    expect(result.stdout).toContain("FILE_NOT_FOUND");

    // Thread A should see its own file
    const resultA = await sandbox.execute({
      command: "cat secret.txt",
      threadId: THREAD_A,
    });
    expect(resultA.stdout).toBe("thread-a-data");
  });

  it("should terminate timed out commands", async () => {
    const fastSandbox = new LocalSandbox({ ...SANDBOX_CONFIG, timeoutMs: 500 });
    const result = await fastSandbox.execute({
      command: "sleep 30",
      threadId: THREAD_A,
    });
    expect(result.timedOut).toBe(true);
  }, 10000);

  it("should map virtual paths correctly in workflow", async () => {
    // Create a file via sandbox
    await sandbox.execute({
      command: 'echo "mapped content" > mapped.txt',
      threadId: THREAD_A,
    });

    // Verify via physical path
    const physicalPath = toPhysicalPath("/workspace/mapped.txt", THREAD_A);
    expect(fs.existsSync(physicalPath)).toBe(true);
    expect(fs.readFileSync(physicalPath, "utf-8").trim()).toBe("mapped content");
  });

  it("should execute multi-step workflow", async () => {
    // Step 1: Create a Python script
    await sandbox.execute({
      command: `cat > greet.py << 'EOF'
import sys
name = sys.argv[1] if len(sys.argv) > 1 else "World"
print(f"Hello, {name}!")
EOF`,
      threadId: THREAD_A,
    });

    // Step 2: Run the script
    const result = await sandbox.execute({
      command: "python3 greet.py Agent",
      threadId: THREAD_A,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Hello, Agent!");

    // Step 3: List workspace
    const lsResult = await sandbox.execute({
      command: "ls",
      threadId: THREAD_A,
    });
    expect(lsResult.stdout).toContain("greet.py");
  });
});
