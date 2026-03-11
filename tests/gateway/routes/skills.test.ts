import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../../../src/skills/loader.js", () => ({
  loadSkills: vi.fn(() => [
    {
      name: "test-skill",
      description: "A test skill",
      enabled: true,
      path: "/fake/path/SKILL.md",
    },
  ]),
  loadSkillContent: vi.fn((p: string) => ({
    name: "test-skill",
    description: "A test skill",
    enabled: true,
    path: p,
    body: "# Test Skill\nThis is test content.",
  })),
}));

const { skills } = await import("../../../src/gateway/routes/skills.js");

describe("Skills API", () => {
  const app = new Hono();
  app.route("/api/skills", skills);

  it("GET /api/skills should return skills list", async () => {
    const res = await app.request("/api/skills");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.skills).toBeDefined();
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].name).toBe("test-skill");
  });

  it("GET /api/skills/:name should return skill content", async () => {
    const res = await app.request("/api/skills/test-skill");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.skill).toBeDefined();
    expect(body.skill.name).toBe("test-skill");
    expect(body.skill.body).toContain("Test Skill");
  });

  it("GET /api/skills/:name should return 404 for unknown skill", async () => {
    const res = await app.request("/api/skills/nonexistent");
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Skill not found");
  });
});
