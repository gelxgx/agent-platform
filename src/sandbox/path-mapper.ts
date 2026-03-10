import path from "node:path";

const VIRTUAL_ROOT = "/workspace";
const DATA_ROOT = path.resolve("data/threads");

/**
 * Virtual path → physical path.
 * /workspace/src/index.ts → data/threads/{threadId}/workspace/src/index.ts
 */
export function toPhysicalPath(virtualPath: string, threadId: string): string {
  if (!virtualPath.startsWith(VIRTUAL_ROOT)) {
    return path.join(DATA_ROOT, threadId, "workspace", virtualPath);
  }
  const relative = virtualPath.slice(VIRTUAL_ROOT.length);
  return path.join(DATA_ROOT, threadId, "workspace", relative);
}

/**
 * Physical path → virtual path.
 * data/threads/{threadId}/workspace/src/index.ts → /workspace/src/index.ts
 */
export function toVirtualPath(physicalPath: string, threadId: string): string {
  const threadRoot = path.join(DATA_ROOT, threadId, "workspace");
  const absolute = path.resolve(physicalPath);
  if (absolute.startsWith(threadRoot)) {
    const relative = absolute.slice(threadRoot.length);
    return VIRTUAL_ROOT + relative;
  }
  return physicalPath;
}

/**
 * Get the physical workspace directory for a thread.
 */
export function getThreadWorkspace(threadId: string): string {
  return path.join(DATA_ROOT, threadId, "workspace");
}

/**
 * Safety check: ensure the path does not escape the thread directory.
 */
export function isPathSafe(physicalPath: string, threadId: string): boolean {
  const threadRoot = path.join(DATA_ROOT, threadId);
  const resolved = path.resolve(physicalPath);
  return resolved.startsWith(path.resolve(threadRoot));
}
