import "server-only";

import { BucketAlreadyOwnedByYou, CreateBucketCommand, HeadBucketCommand, NotFound, PutBucketCorsCommand } from "@aws-sdk/client-s3";

import { getS3Client } from "@/lib/server/storage/client";
import { getStorageConfig } from "@/lib/server/storage/config";
import { buildTransientCorsRules } from "@/lib/server/storage/cors";

export interface EnsureTransientBucketOptions {
  bucket?: string;
  allowedOrigins?: string[];
}

export async function ensureTransientBucket(options: EnsureTransientBucketOptions = {}): Promise<void> {
  const config = getStorageConfig();

  if (config.deployment === "aws-s3") {
    throw new Error("ensureTransientBucket is only supported for local/CI S3-compatible environments. Configure STORAGE_ENDPOINT to opt in.");
  }

  const bucket = options.bucket ?? config.bucket;
  const allowedOrigins = options.allowedOrigins ?? config.allowedOrigins;
  const client = getS3Client();

  await createBucketIfMissing(client, bucket);
  const corsRules = buildTransientCorsRules(allowedOrigins);

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: corsRules.map((rule) => ({
          AllowedMethods: [...rule.allowedMethods],
          AllowedOrigins: [...rule.allowedOrigins],
          AllowedHeaders: [...rule.allowedHeaders],
          ExposeHeaders: [...rule.exposeHeaders],
          MaxAgeSeconds: rule.maxAgeSeconds,
        })),
      },
    }),
  );
}

async function createBucketIfMissing(client: ReturnType<typeof getS3Client>, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
    if (!isMissingBucketError(error)) {
      throw error;
    }
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (error instanceof BucketAlreadyOwnedByYou) {
      return;
    }

    throw error;
  }
}

function isMissingBucketError(error: unknown): boolean {
  if (error instanceof NotFound) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode === 404;
}
