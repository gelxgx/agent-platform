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

export interface SSEEvent {
  event: string;
  threadId?: string;
  content?: string;
}

export async function* streamChat(
  message: string,
  threadId?: string,
  model?: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, threadId, model }),
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
