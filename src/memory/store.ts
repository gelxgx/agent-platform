import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EMPTY_MEMORY, type MemoryData, type MemoryConfig, DEFAULT_MEMORY_CONFIG } from "./types.js";

export class MemoryStore {
  private filePath: string;
  private cache: MemoryData | null = null;
  private cacheMtime: number = 0;

  constructor(config?: Partial<MemoryConfig>) {
    const storagePath = config?.storagePath ?? DEFAULT_MEMORY_CONFIG.storagePath;
    this.filePath = path.resolve(storagePath);
  }

  load(): MemoryData {
    if (!fs.existsSync(this.filePath)) {
      return { ...EMPTY_MEMORY };
    }

    const stat = fs.statSync(this.filePath);
    if (this.cache && stat.mtimeMs === this.cacheMtime) {
      return this.cache;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(raw) as MemoryData;
      this.cache = data;
      this.cacheMtime = stat.mtimeMs;
      return data;
    } catch {
      return { ...EMPTY_MEMORY };
    }
  }

  save(data: MemoryData): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Atomic write: write to temp file, then rename
    const tempPath = path.join(dir, `.memory-${randomUUID()}.tmp`);
    const content = JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, this.filePath);

    this.cache = data;
    this.cacheMtime = fs.statSync(this.filePath).mtimeMs;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheMtime = 0;
  }
}
