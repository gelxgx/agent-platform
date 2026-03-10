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

export interface ThreadData {
  workspacePath: string;
  uploadsPath: string;
  outputsPath: string;
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
  threadData: Annotation<ThreadData | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

export type AgentStateType = typeof AgentState.State;
