export interface PresignedPutRequest {
  key: string;
  contentType: string;
  contentLength?: number;
  expiresInSec: number;
}

export interface PresignedPutDescriptor {
  key: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  expiresInSec: number;
}

export type PresignedPutUrlProvider = (request: PresignedPutRequest) => Promise<string>;

export interface CreatePresignedPutOptions {
  key: string;
  contentType?: string;
  contentLength?: number;
  expiresInSec: number;
  provider: PresignedPutUrlProvider;
  now?: () => Date;
}

export const DEFAULT_PRESIGNED_PUT_CONTENT_TYPE = "application/octet-stream";

export async function createPresignedPutDescriptor(options: CreatePresignedPutOptions): Promise<PresignedPutDescriptor> {
  if (options.expiresInSec <= 0) {
    throw new Error("Presigned PUT expiration must be a positive number of seconds.");
  }

  const contentType = options.contentType?.trim() || DEFAULT_PRESIGNED_PUT_CONTENT_TYPE;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  if (typeof options.contentLength === "number") {
    if (!Number.isFinite(options.contentLength) || options.contentLength < 0) {
      throw new Error("Presigned PUT contentLength must be a non-negative finite number.");
    }

    headers["Content-Length"] = String(Math.floor(options.contentLength));
  }

  const url = await options.provider({
    key: options.key,
    contentType,
    contentLength: options.contentLength,
    expiresInSec: options.expiresInSec,
  });

  const nowFn = options.now ?? (() => new Date());
  const expiresAt = new Date(nowFn().getTime() + options.expiresInSec * 1000).toISOString();

  return {
    key: options.key,
    method: "PUT",
    url,
    headers,
    expiresAt,
    expiresInSec: options.expiresInSec,
  };
}
