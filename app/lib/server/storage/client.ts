import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { getStorageConfig, type StorageConfig } from "@/lib/server/storage/config";

let cachedClient: S3Client | undefined;
let cachedClientConfig: StorageConfig | undefined;

export function getS3Client(): S3Client {
  const config = getStorageConfig();

  if (cachedClient && cachedClientConfig === config) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    ...(config.credentials
      ? {
          credentials: {
            accessKeyId: config.credentials.accessKeyId,
            secretAccessKey: config.credentials.secretAccessKey,
          },
        }
      : {}),
  });
  cachedClientConfig = config;
  return cachedClient;
}

export async function closeS3Client(): Promise<void> {
  if (cachedClient) {
    cachedClient.destroy();
    cachedClient = undefined;
    cachedClientConfig = undefined;
  }
}
