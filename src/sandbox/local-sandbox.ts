import { spawn } from "node:child_process";
import fs from "node:fs";
import type {
  SandboxProvider,
  ExecutionRequest,
  ExecutionResult,
  SandboxConfig,
} from "./types.js";
import { toPhysicalPath, getThreadWorkspace, isPathSafe } from "./path-mapper.js";

export class LocalSandbox implements SandboxProvider {
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  name(): string {
    return "local";
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.validateCommand(request.command);

    const workDir = request.cwd
      ? toPhysicalPath(request.cwd, request.threadId)
      : getThreadWorkspace(request.threadId);

    if (!isPathSafe(workDir, request.threadId)) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Error: Working directory is outside the thread sandbox.",
        durationMs: 0,
        timedOut: false,
      };
    }

    fs.mkdirSync(workDir, { recursive: true });

    const timeout = request.timeoutMs ?? this.config.timeoutMs;
    const startTime = Date.now();

    return new Promise<ExecutionResult>((resolve) => {
      const child = spawn("sh", ["-c", request.command], {
        cwd: workDir,
        env: { ...process.env, ...request.env },
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const maxOutput = this.config.maxOutputSize;

      child.stdout.on("data", (data: Buffer) => {
        if (stdout.length < maxOutput) {
          stdout += data.toString().slice(0, maxOutput - stdout.length);
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        if (stderr.length < maxOutput) {
          stderr += data.toString().slice(0, maxOutput - stderr.length);
        }
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000);
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? 1,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout: "",
          stderr: `Execution error: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }

  private validateCommand(command: string): void {
    const { allowedCommands, blockedCommands } = this.config;

    for (const blocked of blockedCommands) {
      if (command.includes(blocked)) {
        throw new Error(`Command blocked by security policy: "${blocked}"`);
      }
    }

    if (allowedCommands.length > 0) {
      const baseCmd = command.split(/\s+/)[0];
      if (!allowedCommands.includes(baseCmd)) {
        throw new Error(
          `Command "${baseCmd}" not in allowed list: [${allowedCommands.join(", ")}]`
        );
      }
    }
  }
}
