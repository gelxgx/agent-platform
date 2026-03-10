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
          if (message.content && typeof message.content === "string") {
            process.stdout.write(message.content);
          }
        }
        process.stdout.write("\n\n");
      } catch (error) {
        console.log(
          `\n${COLORS.yellow}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}\n`
        );
      }

      prompt();
    });
  };

  prompt();
}
