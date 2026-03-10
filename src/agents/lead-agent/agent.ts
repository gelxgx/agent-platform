import {
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState, type AgentStateType } from "../thread-state.js";
import { buildSystemPrompt } from "./prompt.js";
import { getAvailableTools } from "../../tools/registry.js";
import { createChatModel } from "../../models/factory.js";
import { createDefaultMiddlewareChain } from "../middlewares/index.js";
import type { RuntimeConfig } from "../middlewares/types.js";

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
  const model = await createChatModel(modelName);
  const tools = getAvailableTools();
  const modelWithTools = model.bindTools!(tools);
  const toolNode = new ToolNode(tools);
  const middlewareChain = createDefaultMiddlewareChain();

  async function callModel(state: AgentStateType) {
    const runtimeConfig: RuntimeConfig = {
      modelName: modelName ?? "default",
      threadId: state.threadId,
    };

    const { messages: processedMessages, stateUpdates: beforeUpdates } =
      await middlewareChain.runBeforeModel(state, runtimeConfig);

    const systemMessage = new SystemMessage(buildSystemPrompt());
    const response = await modelWithTools.invoke([
      systemMessage,
      ...processedMessages,
    ]);

    const { response: processedResponse, stateUpdates: afterUpdates } =
      await middlewareChain.runAfterModel(state, response, runtimeConfig);

    return {
      messages: [processedResponse],
      ...beforeUpdates,
      ...afterUpdates,
    };
  }

  const graph = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue, ["tools", END])
    .addEdge("tools", "callModel")
    .compile();

  return graph;
}
