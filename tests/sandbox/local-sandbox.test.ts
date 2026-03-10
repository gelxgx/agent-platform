import { describe, it, expect, afterAll } from "vitest";
import { LocalSandbox } from "../../src/sandbox/local-sandbox.js";
import type { SandboxConfig } from "../../src/sandbox/types.js";
import fs from "node:fs";
import path from "node:path";

const TEST_THREAD = "sandbox-test-thread";
const TEST_WORKSPACE = path.resolve(`data/threads/${TEST_THREAD}/workspace`);

const defaultConfig: SandboxConfig = {
  enabled: true,
  provider: "local",
  timeoutMs: 10000,
  maxOutputSize: 65536,
  allowedCommands: [],
  blockedCommands: ["rm -rf /", "shutdown", "reboot"],
};

afterAll(() => {
  fs.rmSync(path.resolve(`data/threads/${TEST_THREAD}`), {
    recursive: true,
    force: true,
  });
});

describe("LocalSandbox", () => {
  it("should return provider name", () => {
    const sandbox = new LocalSandbox(defaultConfig);
    expect(sandbox.name()).toBe("local");
  });

  it("should execute a simple echo command", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    const result = await sandbox.execute({
      command: 'echo "hello sandbox"',
      threadId: TEST_THREAD,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello sandbox");
    expect(result.stderr).toBe("");
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should capture stderr", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    const result = await sandbox.execute({
      command: 'echo "err" >&2',
      threadId: TEST_THREAD,
    });
    expect(result.stderr).toBe("err");
  });

  it("should report non-zero exit code", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    const result = await sandbox.execute({
      command: "exit 42",
      threadId: TEST_THREAD,
    });
    expect(result.exitCode).toBe(42);
  });

  it("should create workspace directory if it does not exist", async () => {
    const threadId = "auto-create-test";
    const sandbox = new LocalSandbox(defaultConfig);

    await sandbox.execute({
      command: "echo ok",
      threadId,
    });

    const workspace = path.resolve(`data/threads/${threadId}/workspace`);
    expect(fs.existsSync(workspace)).toBe(true);

    fs.rmSync(path.resolve(`data/threads/${threadId}`), {
      recursive: true,
      force: true,
    });
  });

  it("should timeout long-running commands", async () => {
    const sandbox = new LocalSandbox({ ...defaultConfig, timeoutMs: 500 });
    const result = await sandbox.execute({
      command: "sleep 30",
      threadId: TEST_THREAD,
    });
    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeLessThan(5000);
  }, 10000);

  it("should block commands matching blockedCommands", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    await expect(
      sandbox.execute({
        command: "rm -rf /",
        threadId: TEST_THREAD,
      })
    ).rejects.toThrow("Command blocked by security policy");
  });

  it("should enforce allowedCommands whitelist", async () => {
    const sandbox = new LocalSandbox({
      ...defaultConfig,
      allowedCommands: ["echo", "ls"],
    });

    await expect(
      sandbox.execute({
        command: "cat /etc/passwd",
        threadId: TEST_THREAD,
      })
    ).rejects.toThrow('Command "cat" not in allowed list');
  });

  it("should reject path escape in cwd", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    const result = await sandbox.execute({
      command: "echo exploited",
      cwd: "/workspace/../../../etc",
      threadId: TEST_THREAD,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("outside the thread sandbox");
  });

  it("should truncate large output", async () => {
    const sandbox = new LocalSandbox({ ...defaultConfig, maxOutputSize: 50 });
    const result = await sandbox.execute({
      command: 'python3 -c "print(\'A\' * 1000)"',
      threadId: TEST_THREAD,
    });
    expect(result.stdout.length).toBeLessThanOrEqual(50);
  });

  it("should execute with custom environment variables", async () => {
    const sandbox = new LocalSandbox(defaultConfig);
    const result = await sandbox.execute({
      command: 'echo "$MY_TEST_VAR"',
      threadId: TEST_THREAD,
      env: { MY_TEST_VAR: "custom_value" },
    });
    expect(result.stdout).toBe("custom_value");
  });

  it("should execute in specified cwd", async () => {
    const sandbox = new LocalSandbox(defaultConfig);

    // First create a subdirectory
    await sandbox.execute({
      command: "mkdir -p subdir",
      threadId: TEST_THREAD,
    });

    const result = await sandbox.execute({
      command: "pwd",
      cwd: "/workspace/subdir",
      threadId: TEST_THREAD,
    });
    expect(result.stdout).toContain("subdir");
  });
});
