"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchThreads, deleteThread } from "@/lib/api";

export interface Thread {
  id: string;
  createdAt: string;
}

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchThreads();
      setThreads(data.threads ?? []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await deleteThread(id);
      setThreads((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  return { threads, loading, refresh, remove };
}
