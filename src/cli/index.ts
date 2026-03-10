import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { createLeadAgent } from "../agents/lead-agent/agent.js";
import { loadConfig } from "../config/loader.js";
import { handleCommand } from "./commands.js";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
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
        console.log(cmdResult.output + "\n");
        prompt();
        return;
      }

      try {
        log(COLORS.cyan, "Agent: ");
        const stream = await agent.stream(
          {
            messages: [new HumanMessage(input)],
            threadId,
          },
          { streamMode: "messages" }
        );

        for await (const [message, _metadata] of stream) {
          if (!message.content) continue;
          if (typeof message.content === "string") {
            process.stdout.write(message.content);
          } else if (Array.isArray(message.content)) {
            for (const block of message.content) {
              if (typeof block === "string") {
                process.stdout.write(block);
              } else if (block && typeof block === "object" && "text" in block) {
                process.stdout.write((block as { text: string }).text);
              }
            }
          }
        }
        process.stdout.write("\n\n");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(
          `\n${COLORS.yellow}Error: ${msg}${COLORS.reset}\n`
        );
      }

      prompt();
    });
  };

  prompt();
}
