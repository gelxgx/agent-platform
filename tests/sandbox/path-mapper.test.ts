import { describe, it, expect } from "vitest";
import {
  toPhysicalPath,
  toVirtualPath,
  getThreadWorkspace,
  isPathSafe,
} from "../../src/sandbox/path-mapper.js";
import path from "node:path";

const THREAD_ID = "test-thread-123";

describe("Path Mapper", () => {
  describe("toPhysicalPath", () => {
    it("should map /workspace path to physical path", () => {
      const result = toPhysicalPath("/workspace/src/index.ts", THREAD_ID);
      expect(result).toBe(
        path.join(path.resolve("data/threads"), THREAD_ID, "workspace", "src/index.ts")
      );
    });

    it("should map /workspace root to workspace dir", () => {
      const result = toPhysicalPath("/workspace", THREAD_ID);
      expect(result).toBe(
        path.join(path.resolve("data/threads"), THREAD_ID, "workspace")
      );
    });

    it("should map relative path to workspace subpath", () => {
      const result = toPhysicalPath("src/main.py", THREAD_ID);
      expect(result).toBe(
        path.join(path.resolve("data/threads"), THREAD_ID, "workspace", "src/main.py")
      );
    });

    it("should handle nested paths", () => {
      const result = toPhysicalPath("/workspace/a/b/c/d.txt", THREAD_ID);
      expect(result).toContain(path.join(THREAD_ID, "workspace", "a/b/c/d.txt"));
    });
  });

  describe("toVirtualPath", () => {
    it("should map physical path back to virtual path", () => {
      const workspace = getThreadWorkspace(THREAD_ID);
      const physical = path.join(workspace, "src/index.ts");
      const result = toVirtualPath(physical, THREAD_ID);
      expect(result).toBe("/workspace/src/index.ts");
    });

    it("should return original path if not in thread workspace", () => {
      const result = toVirtualPath("/some/other/path.ts", THREAD_ID);
      expect(result).toBe("/some/other/path.ts");
    });

    it("should handle workspace root", () => {
      const workspace = getThreadWorkspace(THREAD_ID);
      const result = toVirtualPath(workspace, THREAD_ID);
      expect(result).toBe("/workspace");
    });
  });

  describe("getThreadWorkspace", () => {
    it("should return the physical workspace path for a thread", () => {
      const result = getThreadWorkspace(THREAD_ID);
      expect(result).toBe(
        path.join(path.resolve("data/threads"), THREAD_ID, "workspace")
      );
    });

    it("should return different paths for different threads", () => {
      const a = getThreadWorkspace("thread-a");
      const b = getThreadWorkspace("thread-b");
      expect(a).not.toBe(b);
    });
  });

  describe("isPathSafe", () => {
    it("should return true for paths inside thread directory", () => {
      const workspace = getThreadWorkspace(THREAD_ID);
      expect(isPathSafe(workspace, THREAD_ID)).toBe(true);
      expect(isPathSafe(path.join(workspace, "file.txt"), THREAD_ID)).toBe(true);
    });

    it("should return false for paths outside thread directory", () => {
      expect(isPathSafe("/etc/passwd", THREAD_ID)).toBe(false);
      expect(isPathSafe("/tmp/hack", THREAD_ID)).toBe(false);
    });

    it("should reject path traversal attempts", () => {
      const workspace = getThreadWorkspace(THREAD_ID);
      const traversal = path.join(workspace, "../../etc/passwd");
      expect(isPathSafe(traversal, THREAD_ID)).toBe(false);
    });
  });
});
