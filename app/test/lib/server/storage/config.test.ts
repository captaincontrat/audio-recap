import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetServerEnvForTests, type ServerEnv } from "@/lib/server/env";
import { buildStorageConfig, DEFAULT_PRESIGNED_PUT_TTL_SECONDS, getStorageConfig, resetStorageConfigForTests } from "@/lib/server/storage/config";

function makeEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    EMAIL_PROVIDER: "console",
    EMAIL_FROM: "no-reply@test.local",
    AWS_REGION: "eu-west-3",
    AWS_ACCESS_KEY_ID: undefined,
    AWS_SECRET_ACCESS_KEY: undefined,
    STORAGE_TRANSIENT_BUCKET: "summitdown-transient-dev",
    STORAGE_ENDPOINT: undefined,
    STORAGE_REGION: undefined,
    STORAGE_ACCESS_KEY_ID: undefined,
    STORAGE_SECRET_ACCESS_KEY: undefined,
    STORAGE_FORCE_PATH_STYLE: undefined,
    STORAGE_PRESIGNED_PUT_TTL_SECONDS: DEFAULT_PRESIGNED_PUT_TTL_SECONDS,
    STORAGE_ALLOWED_ORIGINS: [],
    LOG_LEVEL: "info",
    ...overrides,
  } as ServerEnv;
}

describe("storage config", () => {
  beforeEach(() => {
    resetServerEnvForTests();
    resetStorageConfigForTests();
  });

  afterEach(() => {
    resetServerEnvForTests();
    resetStorageConfigForTests();
  });

  test("defaults to AWS S3 when no custom endpoint is configured", () => {
    const config = buildStorageConfig(
      makeEnv({
        AWS_ACCESS_KEY_ID: "AKIA",
        AWS_SECRET_ACCESS_KEY: "SECRET",
      }),
    );

    expect(config).toEqual({
      deployment: "aws-s3",
      bucket: "summitdown-transient-dev",
      region: "eu-west-3",
      endpoint: undefined,
      forcePathStyle: false,
      credentials: { accessKeyId: "AKIA", secretAccessKey: "SECRET" },
      presignedPutTtlSeconds: DEFAULT_PRESIGNED_PUT_TTL_SECONDS,
      allowedOrigins: [],
    });
  });

  test("switches to S3-compatible mode when a custom endpoint is configured", () => {
    const config = buildStorageConfig(
      makeEnv({
        STORAGE_ENDPOINT: "http://minio.local:9000",
        STORAGE_REGION: "us-east-1",
        STORAGE_ACCESS_KEY_ID: "minio",
        STORAGE_SECRET_ACCESS_KEY: "minio-secret",
        STORAGE_ALLOWED_ORIGINS: ["http://localhost:3000", "http://127.0.0.1:3000"],
      }),
    );

    expect(config.deployment).toBe("s3-compatible");
    expect(config.endpoint).toBe("http://minio.local:9000");
    expect(config.region).toBe("us-east-1");
    expect(config.forcePathStyle).toBe(true);
    expect(config.credentials).toEqual({ accessKeyId: "minio", secretAccessKey: "minio-secret" });
    expect(config.allowedOrigins).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  });

  test("honors an explicit STORAGE_FORCE_PATH_STYLE override", () => {
    const config = buildStorageConfig(
      makeEnv({
        STORAGE_FORCE_PATH_STYLE: false,
      }),
    );

    expect(config.deployment).toBe("aws-s3");
    expect(config.forcePathStyle).toBe(false);
  });

  test("omits credentials when only one of the key parts is provided", () => {
    const config = buildStorageConfig(
      makeEnv({
        AWS_ACCESS_KEY_ID: "AKIA",
        AWS_SECRET_ACCESS_KEY: undefined,
      }),
    );

    expect(config.credentials).toBeUndefined();
  });

  test("caches the config across getStorageConfig calls until reset", () => {
    const originalEnv = process.env;
    process.env = {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      STORAGE_TRANSIENT_BUCKET: "bucket-one",
      STORAGE_ALLOWED_ORIGINS: "http://localhost:3000",
    } as NodeJS.ProcessEnv;

    try {
      const first = getStorageConfig();
      expect(first.bucket).toBe("bucket-one");

      process.env.STORAGE_TRANSIENT_BUCKET = "bucket-two";
      const second = getStorageConfig();
      expect(second).toBe(first);

      resetStorageConfigForTests();
      resetServerEnvForTests();
      const third = getStorageConfig();
      expect(third.bucket).toBe("bucket-two");
    } finally {
      process.env = originalEnv;
    }
  });
});
