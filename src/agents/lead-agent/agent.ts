import { StateGraph, START, END, MemorySaver, Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { AppConfig } from "../../config/types.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import type { Artifact, TodoItem } from "../thread-state.js";
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
  const rawToolNode = new ToolNode(tools);
  const middlewareChain = createDefaultMiddlewareChain();

  async function toolsWithArtifacts(state: AgentStateType) {
    const result = await rawToolNode.invoke(state);
    const messages: ToolMessage[] = result.messages ?? [];
    const extractedArtifacts: Artifact[] = [];
    const extractedTodos: TodoItem[] = [];

    for (const msg of messages) {
      if (typeof msg.content !== "string") continue;
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed?._artifacts)) {
          extractedArtifacts.push(...parsed._artifacts);
          msg.content = parsed.message ?? msg.content;
        }
        if (Array.isArray(parsed?._todos)) {
          extractedTodos.push(...parsed._todos);
          msg.content = `Updated task list (${parsed._todos.length} items).`;
        }
      } catch {
        // not JSON, skip
      }
    }

    return {
      messages,
      ...(extractedArtifacts.length > 0 && { artifacts: extractedArtifacts }),
      ...(extractedTodos.length > 0 && { todos: extractedTodos }),
    };
  }

  const skills = skillsEnabled ? loadSkills(config.skills?.path) : [];

  async function callModel(state: AgentStateType, graphConfig?: any) {
    const configurable = graphConfig?.configurable ?? {};
    const runtimeConfig: RuntimeConfig = {
      modelName: modelName ?? "default",
      threadId: state.threadId,
      subagentEnabled,
      isPlanMode: configurable.isPlanMode ?? false,
    };

    const { messages: processedMessages, stateUpdates: beforeUpdates } =
      await middlewareChain.runBeforeModel(state, runtimeConfig);

    const memoryContext = (beforeUpdates as any)?._memoryContext;
    const sandboxContext = (beforeUpdates as any)?._sandboxContext;
    const uploadedFiles = (beforeUpdates as any)?._uploadedFiles;
    const todosContext = (beforeUpdates as any)?._todosContext;
    const mcpToolNames = getMcpTools().map((t) => t.name);
    const systemMessage = new SystemMessage(
      buildSystemPrompt({
        memory: memoryContext,
        skills,
        subagentEnabled,
        mcpToolNames: mcpToolNames.length > 0 ? mcpToolNames : undefined,
        sandboxContext,
        uploadedFiles,
        maxInjectionFacts: config.memory?.maxInjectionFacts,
        todos: todosContext,
      })
    );

    const response = await modelWithTools.invoke([
      systemMessage,
      ...processedMessages,
    ]);

    const { response: processedResponse, stateUpdates: afterUpdates } =
      await middlewareChain.runAfterModel(state, response, runtimeConfig);

    const { _memoryContext, _sandboxContext, _uploadedFiles, _todosContext, ...cleanBeforeUpdates } = (beforeUpdates ?? {}) as any;
    const { _clarificationNeeded, ...cleanAfterUpdates } = (afterUpdates ?? {}) as any;

    if (_clarificationNeeded) {
      const clarificationMessage = new AIMessage(
        `[CLARIFICATION_NEEDED] ${_clarificationNeeded.question}`
      );
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
    .addNode("tools", toolsWithArtifacts)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue, ["tools", END])
    .addEdge("tools", "callModel")
    .compile({ checkpointer });

  return graph;
}
