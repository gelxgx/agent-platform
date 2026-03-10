export interface SandboxConfig {
  enabled: boolean;
  provider: "local" | "docker";
  timeoutMs: number;
  maxOutputSize: number;
  allowedCommands: string[];
  blockedCommands: string[];
}

export interface ExecutionRequest {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  threadId: string;
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface SandboxProvider {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  name(): string;
}
