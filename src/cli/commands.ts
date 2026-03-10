import { loadConfig } from "../config/loader.js";

export interface CommandResult {
  handled: boolean;
  shouldQuit?: boolean;
  output?: string;
}

export function handleCommand(input: string): CommandResult {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const [command, ...args] = trimmed.slice(1).split(" ");

  switch (command) {
    case "quit":
    case "exit":
      return { handled: true, shouldQuit: true, output: "Goodbye!" };

    case "new":
      return { handled: true, output: "NEW_THREAD" };

    case "models": {
      const config = loadConfig();
      const list = config.models
        .map((m) => `  - ${m.name} (${m.displayName})`)
        .join("\n");
      return { handled: true, output: `Available models:\n${list}` };
    }

    case "model": {
      if (args[0]) {
        return { handled: true, output: `MODEL_SWITCH:${args[0]}` };
      }
      return { handled: true, output: "Usage: /model <name>" };
    }

    case "memory": {
      return { handled: true, output: "SHOW_MEMORY" };
    }

    case "skills": {
      return { handled: true, output: "SHOW_SKILLS" };
    }

    case "help":
      return {
        handled: true,
        output: [
          "Commands:",
          "  /new         - Start a new conversation",
          "  /models      - List available models",
          "  /model <n>   - Switch model",
          "  /memory      - Show stored memory",
          "  /skills      - List available skills",
          "  /help        - Show this help",
          "  /quit        - Exit",
        ].join("\n"),
      };

    default:
      return { handled: true, output: `Unknown command: /${command}` };
  }
}
