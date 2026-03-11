"use client";

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/hooks/useChat";

interface ChatPanelProps {
  threadId: string;
  model?: string;
}

export function ChatPanel({ threadId, model }: ChatPanelProps) {
  const { messages, isLoading, sendMessage } = useChat(threadId, model);

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
