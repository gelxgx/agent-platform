export interface SkillMeta {
  name: string;
  description: string;
  allowedTools?: string[];
  license?: string;
  enabled: boolean;
  path: string;
}

export interface SkillContent extends SkillMeta {
  body: string;
}

export interface SkillsConfig {
  path: string;
  enabled: boolean;
}
