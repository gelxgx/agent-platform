"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, Code, Image, FileSpreadsheet, Eye } from "lucide-react";
import {
  fetchArtifacts,
  fetchArtifactContent,
  getArtifactDownloadUrl,
  type Artifact,
} from "@/lib/api";

interface ArtifactPanelProps {
  threadId: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  code: Code,
  image: Image,
  data: FileSpreadsheet,
};

const TYPE_COLORS: Record<string, string> = {
  code: "bg-blue-500/10 text-blue-600",
  markdown: "bg-purple-500/10 text-purple-600",
  webpage: "bg-orange-500/10 text-orange-600",
  data: "bg-green-500/10 text-green-600",
  image: "bg-pink-500/10 text-pink-600",
  document: "bg-yellow-500/10 text-yellow-600",
};

export function ArtifactPanel({ threadId }: ArtifactPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const loadArtifacts = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const data = await fetchArtifacts(threadId);
      setArtifacts(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const handlePreview = async (artifact: Artifact) => {
    if (artifact.type === "image") return;
    try {
      const content = await fetchArtifactContent(threadId, artifact.path);
      setPreviewContent(content);
      setPreviewTitle(artifact.title);
    } catch {
      setPreviewContent("无法加载文件内容");
      setPreviewTitle(artifact.title);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground p-3">加载中...</p>;
  }

  if (artifacts.length === 0) {
    return <p className="text-xs text-muted-foreground p-3">暂无制品</p>;
  }

  if (previewContent !== null) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <span className="text-xs font-medium truncate">{previewTitle}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setPreviewContent(null);
              setPreviewTitle("");
            }}
          >
            <span className="text-xs">返回</span>
          </Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
            {previewContent}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <ul className="space-y-1.5 p-1">
        {artifacts.map((a) => {
          const Icon = TYPE_ICONS[a.type] ?? FileText;
          const colorClass = TYPE_COLORS[a.type] ?? "bg-muted text-muted-foreground";

          return (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors group"
            >
              <div className={`size-7 rounded-md flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[9px] mr-1">
                    {a.type}
                  </Badge>
                  {new Date(a.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {a.type !== "image" && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handlePreview(a)}
                    title="预览"
                  >
                    <Eye className="size-3" />
                  </Button>
                )}
                <a
                  href={getArtifactDownloadUrl(threadId, a.path)}
                  download
                >
                  <Button variant="ghost" size="icon-xs" title="下载">
                    <Download className="size-3" />
                  </Button>
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
