import { describe, expect, test, vi } from "vitest";

import { createPresignedPutDescriptor, DEFAULT_PRESIGNED_PUT_CONTENT_TYPE } from "@/lib/server/storage/presign";

describe("presigned PUT descriptor", () => {
  test("defaults content type to application/octet-stream and omits content length when not provided", async () => {
    const provider = vi.fn(async () => "https://signed.example/upload");
    const now = () => new Date("2026-04-14T10:00:00.000Z");

    const descriptor = await createPresignedPutDescriptor({
      key: "transient-inputs/upload_1/media/source",
      expiresInSec: 900,
      provider,
      now,
    });

    expect(descriptor).toEqual({
      key: "transient-inputs/upload_1/media/source",
      method: "PUT",
      url: "https://signed.example/upload",
      headers: { "Content-Type": DEFAULT_PRESIGNED_PUT_CONTENT_TYPE },
      expiresAt: "2026-04-14T10:15:00.000Z",
      expiresInSec: 900,
    });
    expect(provider).toHaveBeenCalledWith({
      key: "transient-inputs/upload_1/media/source",
      contentType: DEFAULT_PRESIGNED_PUT_CONTENT_TYPE,
      contentLength: undefined,
      expiresInSec: 900,
    });
  });

  test("forwards content type and length and floors the content length header", async () => {
    const provider = vi.fn(async () => "https://signed.example/upload");

    const descriptor = await createPresignedPutDescriptor({
      key: "transient-inputs/upload_1/media/meeting.mp3",
      contentType: "audio/mpeg",
      contentLength: 1024.7,
      expiresInSec: 60,
      provider,
    });

    expect(descriptor.headers).toEqual({
      "Content-Type": "audio/mpeg",
      "Content-Length": "1024",
    });
    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "audio/mpeg",
        contentLength: 1024.7,
      }),
    );
  });

  test("uses the current clock when no time override is provided", async () => {
    const fixedNow = new Date("2030-01-01T00:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));

    try {
      const descriptor = await createPresignedPutDescriptor({
        key: "transient-inputs/upload_2/media/source",
        expiresInSec: 120,
        provider: async () => "https://signed.example/upload",
      });

      expect(descriptor.expiresAt).toBe(new Date(fixedNow + 120 * 1000).toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  test("rejects non-positive expirations and invalid content lengths", async () => {
    const provider = vi.fn(async () => "https://signed.example/upload");

    await expect(
      createPresignedPutDescriptor({
        key: "k",
        expiresInSec: 0,
        provider,
      }),
    ).rejects.toThrow(/positive number/);

    await expect(
      createPresignedPutDescriptor({
        key: "k",
        expiresInSec: 60,
        contentLength: Number.NaN,
        provider,
      }),
    ).rejects.toThrow(/non-negative finite/);

    await expect(
      createPresignedPutDescriptor({
        key: "k",
        expiresInSec: 60,
        contentLength: -1,
        provider,
      }),
    ).rejects.toThrow(/non-negative finite/);
    expect(provider).not.toHaveBeenCalled();
  });
});
