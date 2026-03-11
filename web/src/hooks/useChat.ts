"use client";

import { useState, useCallback, useEffect } from "react";
import { streamChat, fetchThreadMessages } from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useChat(threadId: string, model?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState(threadId);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);

    fetchThreadMessages(threadId)
      .then((data) => {
        if (cancelled) return;
        if (data.messages?.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              id: crypto.randomUUID(),
              role: m.role,
              content: m.content,
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantId = crypto.randomUUID();
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        for await (const event of streamChat(content, currentThreadId, model)) {
          if (event.threadId && event.event === "thread") {
            setCurrentThreadId(event.threadId);
          }
          if (event.content) {
            assistantContent += event.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: assistantContent }
                  : m,
              ),
            );
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [currentThreadId, model],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, clearMessages, currentThreadId, historyLoaded };
}
