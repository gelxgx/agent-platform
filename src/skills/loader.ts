import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { SkillMeta, SkillContent } from "./types.js";

const SKILL_FILENAME = "SKILL.md";

function scanDirectory(dir: string): SkillMeta[] {
  if (!fs.existsSync(dir)) return [];

  const skills: SkillMeta[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(dir, entry.name, SKILL_FILENAME);
    if (!fs.existsSync(skillPath)) continue;

    try {
      const raw = fs.readFileSync(skillPath, "utf-8");
      const { data } = matter(raw);

      skills.push({
        name: data.name ?? entry.name,
        description: data.description ?? "",
        allowedTools: data["allowed-tools"],
        license: data.license,
        enabled: true,
        path: skillPath,
      });
    } catch {
      // Skip malformed skill files
    }
  }

  return skills;
}

export function loadSkills(skillsRoot?: string): SkillMeta[] {
  const root = skillsRoot ?? path.resolve("skills");
  const publicDir = path.join(root, "public");
  const customDir = path.join(root, "custom");

  return [...scanDirectory(publicDir), ...scanDirectory(customDir)];
}

export function loadSkillContent(skillPath: string): SkillContent | null {
  try {
    const raw = fs.readFileSync(skillPath, "utf-8");
    const { data, content } = matter(raw);

    return {
      name: data.name ?? path.basename(path.dirname(skillPath)),
      description: data.description ?? "",
      allowedTools: data["allowed-tools"],
      license: data.license,
      enabled: true,
      path: skillPath,
      body: content.trim(),
    };
  } catch {
    return null;
  }
}
