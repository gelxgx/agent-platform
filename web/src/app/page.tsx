"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useThreads } from "@/hooks/useThreads";
import { fetchModels } from "@/lib/api";
import { Menu } from "lucide-react";

interface ModelInfo {
  name: string;
  displayName: string;
  provider: string;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const { threads, remove } = useThreads();

  useEffect(() => {
    setActiveThreadId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        setModels(data.models ?? []);
        setCurrentModel(data.defaultModel ?? data.models?.[0]?.name ?? "");
      })
      .catch(() => {});
  }, []);

  const handleNewThread = useCallback(() => {
    setActiveThreadId(crypto.randomUUID());
    setSidebarOpen(false);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
    setSidebarOpen(false);
  }, []);

  const handleDeleteThread = useCallback(
    async (id: string) => {
      await remove(id);
      if (id === activeThreadId) {
        setActiveThreadId(crypto.randomUUID());
      }
    },
    [remove, activeThreadId],
  );

  if (!activeThreadId) return null;

  return (
    <div className="h-screen flex">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        models={models}
        currentModel={currentModel}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
        onNewThread={handleNewThread}
        onSelectModel={setCurrentModel}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full min-w-0">
        <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            {currentModel && (
              <Badge variant="secondary" className="text-xs font-normal">
                {currentModel}
              </Badge>
            )}
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 min-h-0">
          <ChatPanel
            key={activeThreadId}
            threadId={activeThreadId}
            model={currentModel}
          />
        </div>
      </main>
    </div>
  );
}
