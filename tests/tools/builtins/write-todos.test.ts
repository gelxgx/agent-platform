import { describe, it, expect } from "vitest";
import { writeTodosTool } from "../../../src/tools/builtins/write-todos.js";

describe("writeTodosTool", () => {
  it("should have the correct tool name", () => {
    expect(writeTodosTool.name).toBe("write_todos");
  });

  it("should return JSON with _todos array", async () => {
    const result = await writeTodosTool.invoke({
      todos: [
        { id: "1", title: "Research topic", status: "completed" as const },
        { id: "2", title: "Write draft", status: "in_progress" as const },
        { id: "3", title: "Review", status: "pending" as const },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed._todos).toBeDefined();
    expect(parsed._todos.length).toBe(3);
  });

  it("should preserve todo item fields", async () => {
    const todos = [
      { id: "task-1", title: "Setup project", status: "completed" as const },
      { id: "task-2", title: "Implement feature", status: "pending" as const },
    ];

    const result = await writeTodosTool.invoke({ todos });
    const parsed = JSON.parse(result);

    expect(parsed._todos[0]).toEqual({
      id: "task-1",
      title: "Setup project",
      status: "completed",
    });
    expect(parsed._todos[1]).toEqual({
      id: "task-2",
      title: "Implement feature",
      status: "pending",
    });
  });

  it("should handle empty todo list", async () => {
    const result = await writeTodosTool.invoke({ todos: [] });
    const parsed = JSON.parse(result);
    expect(parsed._todos).toEqual([]);
  });

  it("should support all status values", async () => {
    const todos = [
      { id: "1", title: "A", status: "pending" as const },
      { id: "2", title: "B", status: "in_progress" as const },
      { id: "3", title: "C", status: "completed" as const },
      { id: "4", title: "D", status: "cancelled" as const },
    ];

    const result = await writeTodosTool.invoke({ todos });
    const parsed = JSON.parse(result);
    const statuses = parsed._todos.map((t: any) => t.status);
    expect(statuses).toEqual(["pending", "in_progress", "completed", "cancelled"]);
  });
});
