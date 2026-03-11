"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelInfo {
  name: string;
  displayName: string;
  provider: string;
}

interface ModelSelectProps {
  models: ModelInfo[];
  currentModel: string;
  onSelect: (name: string) => void;
}

export function ModelSelect({ models, currentModel, onSelect }: ModelSelectProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        模型
      </h3>
      <Select value={currentModel} onValueChange={(v) => v && onSelect(v)}>
        <SelectTrigger className="w-full text-sm">
          <SelectValue placeholder="选择模型" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.name} value={m.name}>
              {m.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
