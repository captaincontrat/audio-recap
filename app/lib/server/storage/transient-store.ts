import "server-only";

import type { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, NotFound, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3Client } from "@/lib/server/storage/client";
import { getStorageConfig } from "@/lib/server/storage/config";
import { createPresignedPutDescriptor, type PresignedPutDescriptor } from "@/lib/server/storage/presign";

export interface PutTransientObjectInput {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  contentLength?: number;
}

export async function putTransientObject(input: PutTransientObjectInput): Promise<void> {
  const config = getStorageConfig();
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ...(input.contentType ? { ContentType: input.contentType } : {}),
      ...(typeof input.contentLength === "number" ? { ContentLength: input.contentLength } : {}),
    }),
  );
}

export interface GetTransientObjectResult {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export async function getTransientObjectStream(key: string): Promise<GetTransientObjectResult> {
  const config = getStorageConfig();
  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Transient object "${key}" has no body.`);
  }

  return {
    body: response.Body as Readable,
    ...(response.ContentType ? { contentType: response.ContentType } : {}),
    ...(typeof response.ContentLength === "number" ? { contentLength: response.ContentLength } : {}),
  };
}

export async function deleteTransientObject(key: string): Promise<void> {
  const config = getStorageConfig();
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export async function transientObjectExists(key: string): Promise<boolean> {
  const config = getStorageConfig();
  const client = getS3Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof NotFound) {
      return false;
    }

    if (isHttp404(error)) {
      return false;
    }

    throw error;
  }
}

export interface CreateTransientUploadInput {
  key: string;
  contentType?: string;
  contentLength?: number;
  expiresInSec?: number;
}

export async function createTransientPresignedPut(input: CreateTransientUploadInput): Promise<PresignedPutDescriptor> {
  const config = getStorageConfig();
  const client = getS3Client();
  const expiresInSec = input.expiresInSec ?? config.presignedPutTtlSeconds;

  return createPresignedPutDescriptor({
    key: input.key,
    contentType: input.contentType,
    contentLength: input.contentLength,
    expiresInSec,
    provider: async (request) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: request.key,
          ContentType: request.contentType,
          ...(typeof request.contentLength === "number" ? { ContentLength: request.contentLength } : {}),
        }),
        {
          expiresIn: request.expiresInSec,
        },
      ),
  });
}

function isHttp404(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode === 404;
}
