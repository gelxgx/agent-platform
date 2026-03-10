import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import type { AppConfig, ModelConfig } from "./types.js";

dotenv.config();

function resolveEnvVars(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("$")) {
    return process.env[value.slice(1)] ?? "";
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(resolveEnvVars);
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return value;
}

function findConfigFile(): string {
  const envPath = process.env.AGENT_PLATFORM_CONFIG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const localPath = path.resolve("config.yaml");
  if (fs.existsSync(localPath)) return localPath;

  throw new Error("config.yaml not found");
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(configPath?: string): AppConfig {
  if (cachedConfig) return cachedConfig;

  const filePath = configPath ?? findConfigFile();
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;
  const resolved = resolveEnvVars(parsed) as AppConfig;

  cachedConfig = resolved;
  return resolved;
}

export function getModelConfig(name: string): ModelConfig {
  const config = loadConfig();
  const model = config.models.find((m) => m.name === name);
  if (!model) throw new Error(`Model "${name}" not found in config`);
  return model;
}

export function getDefaultModelName(): string {
  const config = loadConfig();
  return config.defaultModel ?? config.models[0]?.name ?? "gpt-4o";
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
