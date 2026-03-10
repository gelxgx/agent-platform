import { randomUUID } from "node:crypto";
import {
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createChatModel } from "../models/factory.js";
import { getAvailableTools } from "../tools/registry.js";
import { getSubAgent } from "./registry.js";
import type { SubAgentTask, SubAgentResult } from "./types.js";

const MAX_CONCURRENT = 3;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_TURNS = 20;

let activeCount = 0;

export function getActiveCount(): number {
  return activeCount;
}

const SubAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

function getToolsForSubAgent(allowedTools?: string[]): StructuredToolInterface[] {
  const allTools = getAvailableTools();
  const filtered = allTools.filter((t) => t.name !== "task");
  if (!allowedTools || allowedTools.length === 0) return filtered;
  return filtered.filter((t) => allowedTools.includes(t.name));
}

export async function executeSubAgent(
  task: SubAgentTask,
  modelName?: string
): Promise<SubAgentResult> {
  const taskId = task.id || randomUUID();
  const startTime = Date.now();

  if (activeCount >= MAX_CONCURRENT) {
    return {
      taskId,
      status: "failed",
      error: `Max concurrent subagents (${MAX_CONCURRENT}) reached. Try again later.`,
    };
  }

  const definition = getSubAgent(task.subagentType);
  if (!definition) {
    return {
      taskId,
      status: "failed",
      error: `Unknown subagent type: "${task.subagentType}". Available: general-purpose, bash`,
    };
  }

  activeCount++;
  try {
    const model = await createChatModel(modelName);
    const tools = getToolsForSubAgent(definition.allowedTools);
    const modelWithTools = tools.length > 0 ? model.bindTools!(tools) : model;

    function shouldContinue(state: typeof SubAgentState.State) {
      const last = state.messages.at(-1);
      if (last && AIMessage.isInstance(last) && last.tool_calls?.length) {
        return "tools";
      }
      return END;
    }

    async function callModel(state: typeof SubAgentState.State) {
      const response = await modelWithTools.invoke([
        new SystemMessage(definition!.systemPrompt),
        ...state.messages,
      ]);
      return { messages: [response] };
    }

    const toolNode = tools.length > 0 ? new ToolNode(tools) : undefined;

    const builder = new StateGraph(SubAgentState)
      .addNode("callModel", callModel)
      .addEdge(START, "callModel");

    if (toolNode) {
      builder
        .addNode("tools", toolNode)
        .addConditionalEdges("callModel", shouldContinue, ["tools", END])
        .addEdge("tools", "callModel");
    } else {
      builder.addEdge("callModel", END);
    }

    const graph = builder.compile();

    const taskPrompt = `## Task\n${task.description}\n\n## Instructions\n${task.prompt}`;

    const resultPromise = graph.invoke({
      messages: [new HumanMessage(taskPrompt)],
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), DEFAULT_TIMEOUT_MS);
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);

    const lastMessage = result.messages.at(-1);
    const content =
      lastMessage && typeof lastMessage.content === "string"
        ? lastMessage.content
        : "Task completed but no text response.";

    return {
      taskId,
      status: "completed",
      result: content,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "TIMEOUT";
    return {
      taskId,
      status: isTimeout ? "timed_out" : "failed",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  } finally {
    activeCount--;
  }
}
