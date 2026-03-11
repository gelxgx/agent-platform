import { Hono } from "hono";
import { loadSkills, loadSkillContent } from "../../skills/loader.js";

const skills = new Hono();

skills.get("/", (c) => {
  const list = loadSkills();
  return c.json({ skills: list });
});

skills.get("/:name", (c) => {
  const name = c.req.param("name");
  const list = loadSkills();
  const skill = list.find((s) => s.name === name);
  if (!skill) return c.json({ error: "Skill not found" }, 404);

  const content = loadSkillContent(skill.path);
  return c.json({ skill: content });
});

export { skills };
