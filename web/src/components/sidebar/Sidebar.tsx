"use client";

import { ThreadList } from "./ThreadList";
import { ModelSelect } from "./ModelSelect";
import { InfoTabs } from "./InfoTabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Thread } from "@/hooks/useThreads";

interface ModelInfo {
  name: string;
  displayName: string;
  provider: string;
}

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string;
  models: ModelInfo[];
  currentModel: string;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onNewThread: () => void;
  onSelectModel: (name: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  threads,
  activeThreadId,
  models,
  currentModel,
  onSelectThread,
  onDeleteThread,
  onNewThread,
  onSelectModel,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50",
          "w-72 flex flex-col gap-4 p-4 overflow-y-auto",
          "bg-sidebar border-r border-sidebar-border",
          "transform transition-transform duration-200 ease-in-out",
          "md:transform-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="size-4 text-primary-foreground" />
            </div>
            <h1 className="text-sm font-bold tracking-tight">智能体平台</h1>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="md:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <Separator />

        <ThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          onSelect={onSelectThread}
          onDelete={onDeleteThread}
          onNew={onNewThread}
        />

        <Separator />

        <ModelSelect
          models={models}
          currentModel={currentModel}
          onSelect={onSelectModel}
        />

        <Separator />

        <InfoTabs />
      </aside>
    </>
  );
}
