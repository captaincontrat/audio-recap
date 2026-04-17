import "server-only";

import { getServerEnv, type ServerEnv } from "@/lib/server/env";

export type StorageDeployment = "aws-s3" | "s3-compatible";

export interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StorageConfig {
  deployment: StorageDeployment;
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  credentials?: StorageCredentials;
  presignedPutTtlSeconds: number;
  allowedOrigins: string[];
}

export const DEFAULT_PRESIGNED_PUT_TTL_SECONDS = 900;

export function buildStorageConfig(env: ServerEnv): StorageConfig {
  const endpoint = env.STORAGE_ENDPOINT;
  const region = env.STORAGE_REGION ?? env.AWS_REGION;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY;
  const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
  const deployment: StorageDeployment = endpoint ? "s3-compatible" : "aws-s3";
  const forcePathStyle = env.STORAGE_FORCE_PATH_STYLE ?? deployment === "s3-compatible";

  return {
    deployment,
    bucket: env.STORAGE_TRANSIENT_BUCKET,
    region,
    endpoint,
    forcePathStyle,
    credentials,
    presignedPutTtlSeconds: env.STORAGE_PRESIGNED_PUT_TTL_SECONDS,
    allowedOrigins: env.STORAGE_ALLOWED_ORIGINS,
  };
}

let cachedConfig: StorageConfig | undefined;

export function getStorageConfig(): StorageConfig {
  if (!cachedConfig) {
    cachedConfig = buildStorageConfig(getServerEnv());
  }
  return cachedConfig;
}

export function resetStorageConfigForTests(): void {
  cachedConfig = undefined;
}
