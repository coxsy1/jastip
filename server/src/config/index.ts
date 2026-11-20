import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

/**
 * Zod validation schema for application configuration.
 * Ensures all required environment and YAML settings are present and typed correctly.
 */
const configSchema = z.object({
  app: z.object({
    name: z.string().default("JastipOps Server"),
    env: z.enum(["development", "production", "test"]).default("development"),
    port: z.coerce.number().default(3000),
    apiPrefix: z.string().default("/api/v1"),
  }),
  security: z.object({
    apiKey: z.string().min(1, "API Key is required"),
  }),
  database: z.object({
    url: z.string().min(1, "Database URL is required"),
  }),
  jwt: z.object({
    accessSecret: z.string().min(16, "JWT access secret must be at least 16 characters"),
    refreshSecret: z.string().min(16, "JWT refresh secret must be at least 16 characters"),
    accessExpiresIn: z.string().default("15m"),
    refreshExpiresIn: z.string().default("7d"),
    bcryptSaltRounds: z.coerce.number().default(12),
  }),
  cors: z.object({
    origin: z.string().default("*"),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Replace ${VAR:-default} or ${VAR} with environment variable values
 */
function interpolateEnv(content: string): string {
  return content.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gi, (_, varName, defaultValue) => {
    const val = process.env[varName];
    if (val !== undefined && val !== "") {
      return val;
    }
    return defaultValue !== undefined ? defaultValue : "";
  });
}

/**
 * Loads and validates configuration from config.yaml and .env
 */
function loadConfig(): Config {
  const configPath = path.resolve(process.cwd(), "config.yaml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found at: ${configPath}`);
  }

  const fileContent = fs.readFileSync(configPath, "utf-8");
  const interpolatedContent = interpolateEnv(fileContent);
  const rawParsed = YAML.parse(interpolatedContent);

  const parsed = configSchema.safeParse(rawParsed);

  if (!parsed.success) {
    console.error("❌ Invalid configuration found in config.yaml / .env:");
     console.error(z.prettifyError(parsed.error));
    throw new Error("Configuration validation failed");
  }

  return parsed.data;
}

export const config = loadConfig();
