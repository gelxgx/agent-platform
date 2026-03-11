import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { LocalSandbox } from "../../sandbox/local-sandbox.js";
import { loadConfig } from "../../config/loader.js";
import type { SandboxConfig } from "../../sandbox/types.js";

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enabled: true,
  provider: "local",
  timeoutMs: 30000,
  maxOutputSize: 65536,
  allowedCommands: [],
  blockedCommands: ["rm -rf /", "shutdown", "reboot"],
};

let sandboxInstance: LocalSandbox | null = null;

function getSandbox(): LocalSandbox {
  if (!sandboxInstance) {
    const config = loadConfig();
    sandboxInstance = new LocalSandbox(config.sandbox ?? DEFAULT_SANDBOX_CONFIG);
  }
  return sandboxInstance;
}

export const bashExecTool = tool(
  async ({ command, cwd }, runManager) => {
    const threadId =
      (runManager as any)?.config?.configurable?.threadId ??
      (runManager as any)?.config?.configurable?.thread_id ??
      (runManager as any)?.configurable?.threadId ??
      (runManager as any)?.configurable?.thread_id ??
      "default";
    const sandbox = getSandbox();

    try {
      const result = await sandbox.execute({ command, cwd, threadId });

      let output = "";
      if (result.stdout) output += result.stdout;
      if (result.stderr)
        output += (output ? "\n--- stderr ---\n" : "") + result.stderr;
      if (result.timedOut) output += "\n[Command timed out]";
      if (!output) output = `(no output, exit code: ${result.exitCode})`;

      return `Exit code: ${result.exitCode}\n${output}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "bash_exec",
    description:
      "Execute a bash command in the thread's sandboxed workspace. " +
      "Use for running scripts, installing packages, git operations, etc. " +
      "The working directory is /workspace by default.",
    schema: z.object({
      command: z.string().describe("The bash command to execute"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory (virtual path, default: /workspace)"),
    }),
  }
);
