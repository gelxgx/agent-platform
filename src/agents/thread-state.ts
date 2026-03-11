import {
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";

export interface Artifact {
  id: string;
  type: string;
  path: string;
  title: string;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export interface ThreadData {
  workspacePath: string;
  uploadsPath: string;
  outputsPath: string;
}

function mergeTodos(existing: TodoItem[], updates: TodoItem[]): TodoItem[] {
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const todo of updates) {
    map.set(todo.id, todo);
  }
  return Array.from(map.values());
}

function mergeArtifacts(
  existing: Artifact[],
  updates: Artifact[]
): Artifact[] {
  const map = new Map(existing.map((a) => [a.id, a]));
  for (const artifact of updates) {
    map.set(artifact.id, artifact);
  }
  return Array.from(map.values());
}

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  threadId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  title: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  artifacts: Annotation<Artifact[]>({
    reducer: mergeArtifacts,
    default: () => [],
  }),
  todos: Annotation<TodoItem[]>({
    reducer: mergeTodos,
    default: () => [],
  }),
  threadData: Annotation<ThreadData | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

export type AgentStateType = typeof AgentState.State;
