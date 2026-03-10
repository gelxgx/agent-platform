import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { LocalSandbox } from "../../sandbox/local-sandbox.js";
import { loadConfig } from "../../config/loader.js";
import { toPhysicalPath } from "../../sandbox/path-mapper.js";
import type { SandboxConfig } from "../../sandbox/types.js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enabled: true,
  provider: "local",
  timeoutMs: 30000,
  maxOutputSize: 65536,
  allowedCommands: [],
  blockedCommands: [],
};

export const pythonExecTool = tool(
  async ({ code, cwd }, runManager) => {
    const threadId =
      (runManager as any)?.config?.configurable?.threadId ??
      (runManager as any)?.config?.configurable?.thread_id ??
      "default";
    const config = loadConfig();
    const sandbox = new LocalSandbox(config.sandbox ?? DEFAULT_SANDBOX_CONFIG);

    const scriptName = `_tmp_${randomUUID().slice(0, 8)}.py`;
    const physicalCwd = cwd
      ? toPhysicalPath(cwd, threadId)
      : toPhysicalPath("/workspace", threadId);
    const scriptPath = path.join(physicalCwd, scriptName);

    fs.mkdirSync(physicalCwd, { recursive: true });
    fs.writeFileSync(scriptPath, code, "utf-8");

    try {
      const result = await sandbox.execute({
        command: `python3 ${scriptName}`,
        cwd,
        threadId,
      });

      let output = "";
      if (result.stdout) output += result.stdout;
      if (result.stderr)
        output += (output ? "\n--- stderr ---\n" : "") + result.stderr;
      if (result.timedOut) output += "\n[Execution timed out]";
      if (!output) output = `(no output, exit code: ${result.exitCode})`;

      return `Exit code: ${result.exitCode}\n${output}`;
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
    }
  },
  {
    name: "python_exec",
    description:
      "Execute Python code in the thread's sandboxed workspace. " +
      "Writes the code to a temp file and runs it with python3. " +
      "Use for data processing, calculations, or any Python task.",
    schema: z.object({
      code: z.string().describe("Python code to execute"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory (virtual path, default: /workspace)"),
    }),
  }
);
