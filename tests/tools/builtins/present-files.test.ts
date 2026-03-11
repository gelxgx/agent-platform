import { describe, it, expect } from "vitest";
import { presentFilesTool } from "../../../src/tools/builtins/present-files.js";

describe("presentFilesTool", () => {
  it("should have the correct tool name", () => {
    expect(presentFilesTool.name).toBe("present_files");
  });

  it("should return JSON with _artifacts array", async () => {
    const result = await presentFilesTool.invoke({
      files: [
        { path: "report.md", title: "Weekly Report" },
        { path: "data.csv" },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed._artifacts).toBeDefined();
    expect(parsed._artifacts.length).toBe(2);
    expect(parsed.message).toContain("2 file(s)");
  });

  it("should infer artifact types correctly", async () => {
    const result = await presentFilesTool.invoke({
      files: [
        { path: "code.py" },
        { path: "page.html" },
        { path: "image.png" },
        { path: "unknown.xyz" },
      ],
    });

    const parsed = JSON.parse(result);
    const types = parsed._artifacts.map((a: any) => a.type);
    expect(types).toEqual(["code", "webpage", "image", "file"]);
  });

  it("should use filename as title when title is not provided", async () => {
    const result = await presentFilesTool.invoke({
      files: [{ path: "dir/report.md" }],
    });

    const parsed = JSON.parse(result);
    expect(parsed._artifacts[0].title).toBe("report.md");
  });

  it("should use provided title when given", async () => {
    const result = await presentFilesTool.invoke({
      files: [{ path: "report.md", title: "My Report" }],
    });

    const parsed = JSON.parse(result);
    expect(parsed._artifacts[0].title).toBe("My Report");
  });

  it("should generate unique ids for each artifact", async () => {
    const result = await presentFilesTool.invoke({
      files: [{ path: "a.txt" }, { path: "b.txt" }],
    });

    const parsed = JSON.parse(result);
    const ids = parsed._artifacts.map((a: any) => a.id);
    expect(new Set(ids).size).toBe(2);
  });
});
