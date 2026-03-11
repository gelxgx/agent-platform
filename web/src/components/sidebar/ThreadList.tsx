"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Thread } from "@/hooks/useThreads";

interface ThreadListProps {
  threads: Thread[];
  activeThreadId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onDelete,
  onNew,
}: ThreadListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          对话列表
        </h3>
        <Button variant="default" size="xs" onClick={onNew}>
          <Plus className="size-3" />
          新建
        </Button>
      </div>

      <ScrollArea className="max-h-[40vh]">
        <div className="space-y-1 pr-2">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">暂无对话</p>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                t.id === activeThreadId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted",
              )}
              onClick={() => onSelect(t.id)}
            >
              <span className="truncate flex-1 mr-2">{t.id.slice(0, 8)}...</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t.id);
                }}
              >
                <Trash2 className="size-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
