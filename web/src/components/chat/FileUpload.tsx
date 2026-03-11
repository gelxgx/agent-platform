"use client";

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Loader2, CheckCircle2, AlertCircle, ImageIcon } from "lucide-react";
import { uploadFile, type UploadResult } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  threadId: string;
  disabled?: boolean;
}

export interface FileUploadHandle {
  getUploadedFiles: () => string[];
  clear: () => void;
}

interface UploadItem {
  file: File;
  status: "uploading" | "done" | "error";
  result?: UploadResult;
  error?: string;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

function isImage(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(
  function FileUpload({ threadId, disabled }, ref) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      getUploadedFiles() {
        return uploads
          .filter((u) => u.status === "done" && u.result)
          .map((u) => u.result!.filename);
      },
      clear() {
        setUploads([]);
      },
    }));

    const processFiles = useCallback(
      async (files: FileList | File[]) => {
        const items: UploadItem[] = Array.from(files).map((file) => ({
          file,
          status: "uploading" as const,
        }));

        setUploads((prev) => [...prev, ...items]);

        for (const item of items) {
          try {
            const result = await uploadFile(threadId, item.file);
            setUploads((prev) =>
              prev.map((u) =>
                u.file === item.file ? { ...u, status: "done" as const, result } : u
              )
            );
          } catch (err) {
            setUploads((prev) =>
              prev.map((u) =>
                u.file === item.file
                  ? { ...u, status: "error" as const, error: String(err) }
                  : u
              )
            );
          }
        }
      },
      [threadId]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
          processFiles(e.dataTransfer.files);
        }
      },
      [processFiles]
    );

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
          processFiles(e.target.files);
          e.target.value = "";
        }
      },
      [processFiles]
    );

    const removeItem = useCallback((file: File) => {
      setUploads((prev) => prev.filter((u) => u.file !== file));
    }, []);

    const hasUploading = uploads.some((u) => u.status === "uploading");

    return (
      <div className="flex flex-col gap-2">
        {uploads.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {uploads.map((item) => {
              const img = isImage(item.file.name);
              return (
                <div
                  key={`${item.file.name}-${item.file.lastModified}`}
                  className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-1 text-xs"
                >
                  {item.status === "uploading" && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                  {item.status === "done" && <CheckCircle2 className="size-3 text-green-500" />}
                  {item.status === "error" && <AlertCircle className="size-3 text-destructive" />}
                  {img ? <ImageIcon className="size-3 text-muted-foreground" /> : <FileText className="size-3 text-muted-foreground" />}
                  <span className="max-w-[100px] truncate">{item.file.name}</span>
                  {item.result?.converted && (
                    <span className="text-[10px] text-muted-foreground">(已转换)</span>
                  )}
                  <button
                    onClick={() => removeItem(item.file)}
                    className="ml-0.5 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "hidden",
            isDragging &&
              "!fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          )}
        >
          {isDragging && (
            <div className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-12 py-10 text-center">
              <FileText className="mx-auto size-10 text-primary/50" />
              <p className="mt-2 text-sm font-medium text-primary">拖放文件到此处上传</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleInputChange}
          disabled={disabled || hasUploading}
        />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || hasUploading}
          title="上传文件"
        >
          <Paperclip className="size-4" />
        </Button>
      </div>
    );
  }
);
