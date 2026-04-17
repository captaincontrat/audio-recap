import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  EMAIL_PROVIDER: z.enum(["ses", "console", "memory"]).default("console"),
  EMAIL_FROM: z.string().email().default("no-reply@summitdown.local"),

  AWS_REGION: z.string().default("eu-west-3"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("\n  ");
    throw new Error(`Invalid server environment:\n  ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function resetServerEnvForTests() {
  cached = undefined;
}
