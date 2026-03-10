import { describe, it, expect } from "vitest";
import { loadSkills, loadSkillContent } from "../../src/skills/loader.js";
import path from "node:path";

describe("Skills Loader", () => {
  it("should load skills from public directory", () => {
    const skills = loadSkills(path.resolve("skills"));
    expect(skills.length).toBeGreaterThanOrEqual(2);
    const names = skills.map((s) => s.name);
    expect(names).toContain("research");
    expect(names).toContain("code-review");
  });

  it("should parse YAML frontmatter correctly", () => {
    const skills = loadSkills(path.resolve("skills"));
    const research = skills.find((s) => s.name === "research");
    expect(research).toBeDefined();
    expect(research!.description).toContain("research");
    expect(research!.allowedTools).toContain("web_search");
  });

  it("should load full skill content", () => {
    const skills = loadSkills(path.resolve("skills"));
    const research = skills.find((s) => s.name === "research");
    const content = loadSkillContent(research!.path);
    expect(content).toBeDefined();
    expect(content!.body).toContain("Research Workflow");
  });

  it("should return empty array for nonexistent directory", () => {
    const skills = loadSkills("/nonexistent/path");
    expect(skills).toEqual([]);
  });
});
