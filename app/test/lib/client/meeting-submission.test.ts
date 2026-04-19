import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Integration coverage for `submitMeeting()` end-to-end. We mock only
// the two side-effecting boundaries — `normalizeMediaForSubmission`
// (browser-side Mediabunny conversion) and `fetch` (presigned PUTs +
// the prepare/finalize JSON endpoints) — and let the rest of the
// helper run for real. That exercises:
//   - phase callback ordering (`onNormalizing` → `onPreparing` →
//     `onUploading` → `onFinalizing`),
//   - the prepare endpoint receiving the actual normalization
//     outcome and an upload file shaped like the MP3 derivative,
//   - the upload PUT receiving the MP3 file (not the original
//     selection),
//   - the AbortSignal short-circuit between phases.

const normalizeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/media-normalization", () => ({
  normalizeMediaForSubmission: normalizeMock,
}));

import { submitMeeting } from "@/lib/client/meeting-submission";

type FetchCall = {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
};

const fetchCalls: FetchCall[] = [];

function makeOriginal(name: string, type: string): File {
  return new File(["original-bytes"], name, { type });
}

function makeMp3(name: string): File {
  return new File(["mp3-bytes"], name, { type: "audio/mpeg" });
}

function configureFetch(handler: (call: FetchCall) => Response): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = {
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      method: init?.method,
      headers: ((init?.headers as Record<string, string> | undefined) ?? {}) as Record<string, string>,
      body: init?.body as BodyInit | null | undefined,
    };
    fetchCalls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
}

function jsonResponse(payload: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  fetchCalls.length = 0;
  normalizeMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitMeeting (task 5.2 — successful normalization end-to-end)", () => {
  test("walks the local phase sequence normalizing → preparing → uploading → finalizing and uploads the MP3 derivative", async () => {
    const original = makeOriginal("kickoff.mov", "video/quicktime");
    const mp3Derivative = makeMp3("kickoff.mp3");
    normalizeMock.mockResolvedValue({
      outcome: { kind: "succeeded", inputKind: "mp3-derivative" },
      file: mp3Derivative,
    });

    let prepareBody: Record<string, unknown> | null = null;
    let uploadedBody: BodyInit | null | undefined = null;
    configureFetch((call) => {
      if (call.url.includes("/meetings/prepare")) {
        prepareBody = JSON.parse(String(call.body)) as Record<string, unknown>;
        return jsonResponse({
          ok: true,
          planToken: "plan_xyz",
          expiresInSec: 600,
          uploads: {
            media: {
              key: "transient-inputs/up_1/media/source",
              method: "PUT",
              url: "https://fixture.s3/upload-media",
              headers: { "content-type": "audio/mpeg" },
              expiresAt: "2099-01-01T00:00:00Z",
              expiresInSec: 600,
            },
            notes: null,
          },
          submission: {
            uploadId: "up_1",
            resolvedMediaInputKind: "mp3-derivative",
            mediaNormalizationPolicySnapshot: "optional",
          },
        });
      }
      if (call.url === "https://fixture.s3/upload-media") {
        uploadedBody = call.body;
        return new Response(null, { status: 200 });
      }
      if (call.url.endsWith("/meetings")) {
        return jsonResponse({ ok: true, transcript: { id: "trx_1", status: "queued" } });
      }
      throw new Error(`Unexpected fetch URL: ${call.url}`);
    });

    const phaseLog: string[] = [];
    const result = await submitMeeting({
      workspaceSlug: "riley",
      file: original,
      callbacks: {
        onNormalizing: () => phaseLog.push("normalizing"),
        onPreparing: () => phaseLog.push("preparing"),
        onUploading: () => phaseLog.push("uploading"),
        onFinalizing: () => phaseLog.push("finalizing"),
      },
    });

    expect(phaseLog).toEqual(["normalizing", "preparing", "uploading", "finalizing"]);
    expect(normalizeMock).toHaveBeenCalledTimes(1);
    expect(normalizeMock.mock.calls[0]?.[0]).toMatchObject({ kind: "video", file: original });

    expect(prepareBody).toMatchObject({
      sourceMediaKind: "video",
      mediaContentType: "audio/mpeg",
      mediaFilename: "kickoff.mov",
      normalization: { kind: "succeeded", inputKind: "mp3-derivative" },
    });
    expect(uploadedBody).toBe(mp3Derivative);
    expect(result).toEqual({
      transcriptId: "trx_1",
      submission: {
        uploadId: "up_1",
        resolvedMediaInputKind: "mp3-derivative",
        mediaNormalizationPolicySnapshot: "optional",
      },
    });
  });

  test("forwards the AbortSignal and onProgress to normalizeMediaForSubmission so the encoder Worker can be cancelled mid-conversion", async () => {
    const original = makeOriginal("kickoff.mp3", "audio/mpeg");
    normalizeMock.mockResolvedValue({
      outcome: { kind: "succeeded", inputKind: "mp3-derivative" },
      file: makeMp3("kickoff.mp3"),
    });

    configureFetch((call) => {
      if (call.url.includes("/meetings/prepare")) {
        return jsonResponse({
          ok: true,
          planToken: "plan_y",
          expiresInSec: 600,
          uploads: {
            media: {
              key: "k",
              method: "PUT",
              url: "https://fixture.s3/upload",
              headers: {},
              expiresAt: "2099-01-01T00:00:00Z",
              expiresInSec: 600,
            },
            notes: null,
          },
          submission: { uploadId: "u", resolvedMediaInputKind: "mp3-derivative", mediaNormalizationPolicySnapshot: "optional" },
        });
      }
      if (call.url === "https://fixture.s3/upload") {
        return new Response(null, { status: 200 });
      }
      return jsonResponse({ ok: true, transcript: { id: "trx_y", status: "queued" } });
    });

    const controller = new AbortController();
    const onNormalizationProgress = vi.fn();
    await submitMeeting({
      workspaceSlug: "riley",
      file: original,
      signal: controller.signal,
      callbacks: { onNormalizationProgress },
    });

    const arg = normalizeMock.mock.calls[0]?.[0];
    expect(arg?.signal).toBe(controller.signal);
    expect(typeof arg?.onProgress).toBe("function");
  });

  test("propagates an AbortError from normalizeMediaForSubmission without firing prepare/upload/finalize", async () => {
    const original = makeOriginal("kickoff.mp3", "audio/mpeg");
    normalizeMock.mockRejectedValue(new DOMException("Normalization cancelled", "AbortError"));
    configureFetch(() => {
      throw new Error("fetch must not be called when normalization aborts");
    });

    await expect(
      submitMeeting({
        workspaceSlug: "riley",
        file: original,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchCalls).toHaveLength(0);
  });

  test("short-circuits with AbortError when the signal is already aborted before the helper starts", async () => {
    const original = makeOriginal("kickoff.mp3", "audio/mpeg");
    normalizeMock.mockResolvedValue({ outcome: { kind: "succeeded", inputKind: "mp3-derivative" }, file: makeMp3("kickoff.mp3") });
    configureFetch(() => {
      throw new Error("fetch must not be called when the signal is already aborted");
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      submitMeeting({
        workspaceSlug: "riley",
        file: original,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(normalizeMock).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });
});
