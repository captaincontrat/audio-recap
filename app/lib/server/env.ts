import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // Google OAuth / One Tap credentials. Both are optional so the app boots
  // without them in local dev; federated sign-in is enabled at runtime only
  // when both values are present.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Passkey relying-party identifier and origin. Defaults target local dev;
  // production deployments set these to the canonical host. `PASSKEY_RP_ID`
  // must be the eTLD+1 of the site, and `PASSKEY_ORIGIN` the full URL of
  // the page hosting the WebAuthn ceremony.
  PASSKEY_RP_ID: z.string().default("localhost"),
  PASSKEY_RP_NAME: z.string().default("Summitdown"),
  PASSKEY_ORIGIN: z.string().url().optional(),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  EMAIL_PROVIDER: z.enum(["ses", "console", "memory"]).default("console"),
  EMAIL_FROM: z.string().email().default("no-reply@summitdown.local"),

  AWS_REGION: z.string().default("eu-west-3"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  STORAGE_TRANSIENT_BUCKET: z.string().min(1).default("summitdown-transient-dev"),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  STORAGE_PRESIGNED_PUT_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  STORAGE_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0)
        : [],
    ),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),

  // Optional so the web app and local tooling boot without the worker
  // secret. The worker runtime explicitly asserts presence when building
  // the OpenAI client so a misconfigured worker fails fast at startup
  // rather than mid-pipeline.
  OPENAI_API_KEY: z.string().optional(),

  // Temp directory override for the worker. Defaults to the OS tmpdir.
  WORKER_TEMP_DIR: z.string().optional(),
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
