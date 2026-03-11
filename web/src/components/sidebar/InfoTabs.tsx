"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Server } from "lucide-react";
import { fetchSkills, fetchMemory, fetchMcpServers } from "@/lib/api";

export function InfoTabs() {
  const [memoryData, setMemoryData] = useState<any>(null);
  const [skillsData, setSkillsData] = useState<any>(null);
  const [mcpData, setMcpData] = useState<any>(null);

  const loadData = async (tab: string) => {
    try {
      if (tab === "memory" && !memoryData) setMemoryData(await fetchMemory());
      else if (tab === "skills" && !skillsData) setSkillsData(await fetchSkills());
      else if (tab === "mcp" && !mcpData) setMcpData(await fetchMcpServers());
    } catch {
      // fail silently
    }
  };

  useEffect(() => {
    loadData("memory");
  }, []);

  return (
    <Tabs defaultValue="memory" onValueChange={loadData} className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="memory" className="text-xs gap-1">
          <Brain className="size-3" />
          记忆
        </TabsTrigger>
        <TabsTrigger value="skills" className="text-xs gap-1">
          <Sparkles className="size-3" />
          技能
        </TabsTrigger>
        <TabsTrigger value="mcp" className="text-xs gap-1">
          <Server className="size-3" />
          MCP
        </TabsTrigger>
      </TabsList>

      <TabsContent value="memory" className="mt-2">
        <ScrollArea className="h-40 rounded-lg border bg-muted/50 p-3">
          <MemoryView data={memoryData} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="skills" className="mt-2">
        <ScrollArea className="h-40 rounded-lg border bg-muted/50 p-3">
          <SkillsView data={skillsData} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="mcp" className="mt-2">
        <ScrollArea className="h-40 rounded-lg border bg-muted/50 p-3">
          <McpView data={mcpData} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function MemoryView({ data }: { data: any }) {
  const facts = data?.facts ?? [];
  if (!data) return <p className="text-xs text-muted-foreground">加载中...</p>;
  if (facts.length === 0)
    return <p className="text-xs text-muted-foreground">暂无记忆</p>;
  return (
    <ul className="space-y-2">
      {facts.map((f: any, i: number) => (
        <li key={f.id ?? i} className="text-xs flex items-start gap-2">
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {f.category}
          </Badge>
          <span>{f.content}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillsView({ data }: { data: any }) {
  const skills = data?.skills ?? [];
  if (!data) return <p className="text-xs text-muted-foreground">加载中...</p>;
  if (skills.length === 0)
    return <p className="text-xs text-muted-foreground">暂无技能</p>;
  return (
    <ul className="space-y-2">
      {skills.map((s: any) => (
        <li key={s.name} className="text-xs">
          <span className="font-medium">{s.name}</span>
          {s.description && (
            <span className="text-muted-foreground ml-1">— {s.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function McpView({ data }: { data: any }) {
  const servers = data?.servers ?? [];
  if (!data) return <p className="text-xs text-muted-foreground">加载中...</p>;
  if (servers.length === 0)
    return <p className="text-xs text-muted-foreground">暂无 MCP 服务器</p>;
  return (
    <ul className="space-y-2">
      {servers.map((s: any) => (
        <li key={s.name} className="text-xs flex items-center gap-2">
          <span className="font-medium">{s.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {s.transport}
          </Badge>
          {s.enabled === false && (
            <Badge variant="destructive" className="text-[10px]">
              已禁用
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
