"use client";

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/hooks/useChat";

interface ChatPanelProps {
  threadId: string;
  model?: string;
  planMode?: boolean;
}

export function ChatPanel({ threadId, model, planMode }: ChatPanelProps) {
  const { messages, isLoading, sendMessage, currentThreadId } = useChat(threadId, model, planMode);

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} disabled={isLoading} threadId={currentThreadId} />
    </div>
  );
}
