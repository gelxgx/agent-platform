"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { fetchTodos, type TodoItem } from "@/lib/api";

const STATUS_ICONS: Record<string, string> = {
  pending: "⬜",
  in_progress: "🔄",
  completed: "✅",
  cancelled: "❌",
};

interface TodoPanelProps {
  threadId: string;
}

export function TodoPanel({ threadId }: TodoPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchTodos(threadId);
      setTodos(items);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  if (todos.length === 0 && !loading) {
    return (
      <p className="text-xs text-muted-foreground p-3">暂无任务</p>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-xs font-medium text-muted-foreground">
          {todos.filter((t) => t.status === "completed").length}/{todos.length} 完成
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={loadTodos}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <ul className="space-y-1.5 mt-1">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="text-xs flex items-start gap-1.5"
            >
              <span className="shrink-0">{STATUS_ICONS[todo.status] ?? "⬜"}</span>
              <span
                className={
                  todo.status === "completed"
                    ? "line-through text-muted-foreground"
                    : todo.status === "cancelled"
                      ? "line-through text-muted-foreground/50"
                      : ""
                }
              >
                {todo.title}
              </span>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
