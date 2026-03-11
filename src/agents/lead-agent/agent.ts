import { StateGraph, START, END, MemorySaver, Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { AIMessage } from "@langchain/core/messages";
import type { AppConfig } from "../../config/types.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState, type AgentStateType } from "../thread-state.js";
import { buildSystemPrompt } from "./prompt.js";
import { getAllTools } from "../../tools/registry.js";
import { getMcpTools } from "../../mcp/client.js";
import { createChatModel } from "../../models/factory.js";
import { createDefaultMiddlewareChain } from "../middlewares/index.js";
import type { RuntimeConfig } from "../middlewares/types.js";
import { createTaskTool } from "../../subagents/task-tool.js";
import { loadSkills } from "../../skills/loader.js";
import { loadConfig } from "../../config/loader.js";

function createCheckpointer(config: AppConfig) {
  const cpConfig = config.checkpointer;
  const provider = cpConfig?.provider ?? "sqlite";

  if (provider === "memory") {
    return new MemorySaver();
  }

  const dbPath = cpConfig?.path ?? "data/checkpoints.db";
  return SqliteSaver.fromConnString(dbPath);
}

function shouldContinue(state: AgentStateType): "tools" | typeof END {
  const lastMessage = state.messages.at(-1);
  if (
    lastMessage &&
    AIMessage.isInstance(lastMessage) &&
    lastMessage.tool_calls?.length
  ) {
    return "tools";
  }
  return END;
}

export async function createLeadAgent(modelName?: string) {
  const config = loadConfig();
  const subagentEnabled = config.subagents?.enabled ?? false;
  const skillsEnabled = config.skills?.enabled ?? true;

  const model = await createChatModel(modelName);
  const tools = getAllTools();

  if (subagentEnabled) {
    tools.push(createTaskTool(modelName));
  }

  const modelWithTools = model.bindTools!(tools);
  const toolNode = new ToolNode(tools);
  const middlewareChain = createDefaultMiddlewareChain();

  const skills = skillsEnabled ? loadSkills(config.skills?.path) : [];

  async function callModel(state: AgentStateType) {
    const runtimeConfig: RuntimeConfig = {
      modelName: modelName ?? "default",
      threadId: state.threadId,
      subagentEnabled,
    };

    const { messages: processedMessages, stateUpdates: beforeUpdates } =
      await middlewareChain.runBeforeModel(state, runtimeConfig);

    const memoryContext = (beforeUpdates as any)?._memoryContext;
    const sandboxContext = (beforeUpdates as any)?._sandboxContext;
    const mcpToolNames = getMcpTools().map((t) => t.name);
    const systemMessage = new SystemMessage(
      buildSystemPrompt({
        memory: memoryContext,
        skills,
        subagentEnabled,
        mcpToolNames: mcpToolNames.length > 0 ? mcpToolNames : undefined,
        sandboxContext,
        maxInjectionFacts: config.memory?.maxInjectionFacts,
      })
    );

    const response = await modelWithTools.invoke([
      systemMessage,
      ...processedMessages,
    ]);

    const { response: processedResponse, stateUpdates: afterUpdates } =
      await middlewareChain.runAfterModel(state, response, runtimeConfig);

    const { _memoryContext, _sandboxContext, ...cleanBeforeUpdates } = (beforeUpdates ?? {}) as any;
    const { _clarificationNeeded, ...cleanAfterUpdates } = (afterUpdates ?? {}) as any;

    if (_clarificationNeeded) {
      const clarificationMessage = new AIMessage(_clarificationNeeded.question);
      return new Command({
        goto: END,
        update: {
          messages: [clarificationMessage],
          ...cleanBeforeUpdates,
          ...cleanAfterUpdates,
        },
      });
    }

    return {
      messages: [processedResponse],
      ...cleanBeforeUpdates,
      ...cleanAfterUpdates,
    };
  }

  const checkpointer = createCheckpointer(config);

  const graph = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue, ["tools", END])
    .addEdge("tools", "callModel")
    .compile({ checkpointer });

  return graph;
}
