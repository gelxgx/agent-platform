const API_BASE = "/api";

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  return res.json();
}

export async function fetchThreads() {
  const res = await fetch(`${API_BASE}/threads`);
  return res.json();
}

export async function deleteThread(id: string) {
  const res = await fetch(`${API_BASE}/threads/${id}`, { method: "DELETE" });
  return res.json();
}

export async function fetchThreadMessages(
  id: string,
): Promise<{ messages: { role: "user" | "assistant"; content: string }[] }> {
  const res = await fetch(`${API_BASE}/threads/${id}/messages`);
  return res.json();
}

export async function fetchSkills() {
  const res = await fetch(`${API_BASE}/skills`);
  return res.json();
}

export async function fetchMemory() {
  const res = await fetch(`${API_BASE}/memory`);
  return res.json();
}

export async function fetchMcpServers() {
  const res = await fetch(`${API_BASE}/mcp/servers`);
  return res.json();
}

// --- Uploads ---

export interface UploadResult {
  filename: string;
  size: number;
  converted: boolean;
  convertedPath: string | null;
}

export async function uploadFile(
  threadId: string,
  file: File,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/threads/${threadId}/uploads`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function fetchUploads(
  threadId: string,
): Promise<{ files: { name: string; size: number; uploadedAt: string }[] }> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/uploads`);
  return res.json();
}

export async function deleteUpload(
  threadId: string,
  filename: string,
): Promise<void> {
  await fetch(`${API_BASE}/threads/${threadId}/uploads/${filename}`, {
    method: "DELETE",
  });
}

// --- Artifacts ---

export interface Artifact {
  id: string;
  type: string;
  path: string;
  title: string;
  createdAt: string;
}

export async function fetchArtifacts(
  threadId: string,
): Promise<Artifact[]> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/artifacts`);
  const data = await res.json();
  return data.artifacts ?? [];
}

export async function fetchArtifactContent(
  threadId: string,
  artifactPath: string,
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/threads/${threadId}/artifacts/${artifactPath}`,
  );
  return res.text();
}

export function getArtifactDownloadUrl(
  threadId: string,
  artifactPath: string,
): string {
  return `${API_BASE}/threads/${threadId}/artifacts/${artifactPath}?download=true`;
}

// --- Todos ---

export interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export async function fetchTodos(threadId: string): Promise<TodoItem[]> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/todos`);
  const data = await res.json();
  return data.todos ?? [];
}

// --- SSE ---

export interface SSEEvent {
  event: string;
  threadId?: string;
  content?: string;
}

export async function* streamChat(
  message: string,
  threadId?: string,
  model?: string,
  files?: string[],
  planMode?: boolean,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, threadId, model, files, planMode }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { event: currentEvent, ...data };
        } catch {
          // skip malformed data
        }
      }
    }
  }
}
