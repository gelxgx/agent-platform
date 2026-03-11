import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { createLeadAgent } from "../agents/lead-agent/agent.js";
import { loadConfig } from "../config/loader.js";
import { handleCommand } from "./commands.js";
import { initializeMcpClient, closeMcpClient } from "../mcp/client.js";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

function log(color: string, text: string) {
  process.stdout.write(`${color}${text}${COLORS.reset}`);
}

export async function startCli() {
  const config = loadConfig();
  let currentModel = config.defaultModel ?? config.models[0]?.name;
  let threadId = randomUUID();

  console.log(`${COLORS.cyan}🤖 Agent Platform CLI${COLORS.reset}`);
  console.log(`${COLORS.dim}Model: ${currentModel} | Thread: ${threadId.slice(0, 8)}...${COLORS.reset}`);
  console.log(`${COLORS.dim}Type /help for commands${COLORS.reset}\n`);

  if (config.mcp?.enabled) {
    try {
      await initializeMcpClient(config.mcp.configPath);
    } catch (e) {
      console.warn(
        `${COLORS.yellow}[MCP] Failed to initialize: ${e instanceof Error ? e.message : String(e)}${COLORS.reset}`
      );
    }
  }

  let agent = await createLeadAgent(currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`${COLORS.green}You: ${COLORS.reset}`, async (input) => {
      if (!input.trim()) {
        prompt();
        return;
      }

      const cmdResult = handleCommand(input);

      if (cmdResult.handled) {
        if (cmdResult.shouldQuit) {
          console.log(cmdResult.output);
          await closeMcpClient();
          rl.close();
          process.exit(0);
        }
        if (cmdResult.output === "NEW_THREAD") {
          threadId = randomUUID();
          console.log(`${COLORS.dim}New thread: ${threadId.slice(0, 8)}...${COLORS.reset}\n`);
          prompt();
          return;
        }
        if (cmdResult.output?.startsWith("MODEL_SWITCH:")) {
          const newModel = cmdResult.output.split(":")[1];
          try {
            agent = await createLeadAgent(newModel);
            currentModel = newModel;
            console.log(`${COLORS.dim}Switched to model: ${newModel}${COLORS.reset}\n`);
          } catch (e) {
            console.log(`${COLORS.yellow}Error: ${e instanceof Error ? e.message : String(e)}${COLORS.reset}\n`);
          }
          prompt();
          return;
        }
        if (cmdResult.output === "SHOW_MEMORY") {
          try {
            const { MemoryStore } = await import("../memory/store.js");
            const { loadConfig: lc } = await import("../config/loader.js");
            const cfg = lc();
            const store = new MemoryStore(cfg.memory);
            const data = store.load();

            if (!data.facts.length && !data.userContext.workContext) {
              console.log(`${COLORS.dim}No memories stored yet.${COLORS.reset}\n`);
            } else {
              console.log(`${COLORS.cyan}=== Memory ===${COLORS.reset}`);
              const ctx = data.userContext;
              if (ctx.workContext) console.log(`  Work: ${ctx.workContext}`);
              if (ctx.personalContext) console.log(`  Personal: ${ctx.personalContext}`);
              if (ctx.topOfMind) console.log(`  Focus: ${ctx.topOfMind}`);
              if (data.facts.length) {
                console.log(`\n  Facts (${data.facts.length}):`);
                data.facts
                  .sort((a, b) => b.confidence - a.confidence)
                  .slice(0, 10)
                  .forEach((f) => {
                    console.log(`    [${f.confidence.toFixed(1)}] ${f.content}`);
                  });
              }
              console.log();
            }
          } catch {
            console.log(`${COLORS.yellow}Failed to load memory${COLORS.reset}\n`);
          }
          prompt();
          return;
        }
        if (cmdResult.output === "SHOW_MCP") {
          try {
            const { listMcpServers, getMcpTools } = await import("../mcp/client.js");
            const servers = listMcpServers();
            const tools = getMcpTools();

            if (servers.length === 0) {
              console.log(`${COLORS.dim}No MCP servers configured.${COLORS.reset}`);
              console.log(`${COLORS.dim}Edit mcp_servers.json to add servers.${COLORS.reset}\n`);
            } else {
              console.log(`${COLORS.cyan}=== MCP Servers ===${COLORS.reset}`);
              for (const server of servers) {
                const status = server.enabled !== false ? "✓" : "✗";
                console.log(
                  `  ${status} ${server.name} (${server.transport}: ${server.url ?? server.command})`
                );
              }
              if (tools.length > 0) {
                console.log(`\n  Tools loaded: ${tools.map((t) => t.name).join(", ")}`);
              }
              console.log();
            }
          } catch {
            console.log(`${COLORS.yellow}Failed to load MCP info${COLORS.reset}\n`);
          }
          prompt();
          return;
        }
        if (cmdResult.output === "SHOW_SKILLS") {
          try {
            const { loadSkills: ls } = await import("../skills/loader.js");
            const skills = ls();
            if (skills.length === 0) {
              console.log(`${COLORS.dim}No skills found.${COLORS.reset}\n`);
            } else {
              console.log(`${COLORS.cyan}=== Skills ===${COLORS.reset}`);
              for (const skill of skills) {
                const status = skill.enabled ? "✓" : "✗";
                console.log(`  ${status} ${skill.name} — ${skill.description}`);
              }
              console.log();
            }
          } catch {
            console.log(`${COLORS.yellow}Failed to load skills${COLORS.reset}\n`);
          }
          prompt();
          return;
        }
        console.log(cmdResult.output + "\n");
        prompt();
        return;
      }

      try {
        log(COLORS.cyan, "Agent: ");
        let fullOutput = "";
        const stream = await agent.stream(
          {
            messages: [new HumanMessage(input)],
            threadId,
          },
          {
            streamMode: "messages",
            configurable: { thread_id: threadId },
          }
        );

        for await (const [message, _metadata] of stream) {
          if (!message.content) continue;
          if (typeof message.content === "string") {
            fullOutput += message.content;
            process.stdout.write(message.content.replace("[CLARIFICATION_NEEDED] ", ""));
          } else if (Array.isArray(message.content)) {
            for (const block of message.content) {
              const chunk =
                typeof block === "string"
                  ? block
                  : block && typeof block === "object" && "text" in block
                    ? (block as { text: string }).text
                    : "";
              if (chunk) {
                fullOutput += chunk;
                process.stdout.write(chunk.replace("[CLARIFICATION_NEEDED] ", ""));
              }
            }
          }
        }
        process.stdout.write("\n");

        if (fullOutput.includes("[CLARIFICATION_NEEDED]")) {
          log(COLORS.magenta, "  ↳ The agent needs more information. Please reply to continue.\n");
        }
        process.stdout.write("\n");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(
          `\n${COLORS.yellow}Error: ${msg}${COLORS.reset}\n`
        );
      }

      prompt();
    });
  };

  const cleanup = async () => {
    await closeMcpClient();
  };

  rl.on("close", cleanup);
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  prompt();
}
