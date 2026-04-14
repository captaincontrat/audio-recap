import { afterEach, describe, expect, it, vi } from "vitest";

const transcribeMocks = vi.hoisted(() => ({
  createReadStream: vi.fn((filePath: string) => `stream:${filePath}`),
}));

vi.mock("node:fs", () => ({
  createReadStream: transcribeMocks.createReadStream,
}));

import { extractChunkSegments, transcribePreparedAudio } from "../src/openai/transcribe.js";

describe("prepared audio transcription", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("extracts diarized segments and filters invalid entries", () => {
    expect(
      extractChunkSegments({
        segments: [
          {
            speaker: " Alice ",
            start: 0,
            end: 1.2,
            text: " Hello ",
          },
          {
            speaker: "   ",
            start: 2,
            text: "No speaker provided",
          },
          {
            speaker: "  ",
            start: 2,
            end: 1,
            text: "invalid backwards range",
          },
          {},
          {
            start: Number.NaN,
            end: 2,
            text: "invalid timing",
          },
        ],
      }),
    ).toEqual([
      {
        speaker: "Alice",
        startSec: 0,
        endSec: 1.2,
        text: "Hello",
      },
      {
        speaker: "speaker_unknown",
        startSec: 2,
        endSec: 2,
        text: "No speaker provided",
      },
    ]);
  });

  it("falls back to response text or an empty segment list", () => {
    expect(
      extractChunkSegments({
        text: "  Unstructured fallback transcript  ",
      }),
    ).toEqual([
      {
        speaker: "speaker_unknown",
        startSec: 0,
        endSec: 0,
        text: "Unstructured fallback transcript",
      },
    ]);

    expect(extractChunkSegments({ text: "   " })).toEqual([]);
  });

  it("transcribes chunks in parallel, sorts them, and forwards the language hint", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        segments: [
          {
            speaker: "Bob",
            start: 0,
            end: 1,
            text: "Chunk two",
          },
        ],
      })
      .mockResolvedValueOnce({
        segments: [
          {
            speaker: "Alice",
            start: 0,
            end: 1,
            text: "Chunk one",
          },
        ],
      });

    const result = await transcribePreparedAudio(
      {
        audio: {
          transcriptions: {
            create,
          },
        },
      } as never,
      {
        sourcePath: "/tmp/source.m4a",
        preparedPath: "/tmp/prepared.mp3",
        durationSec: 20,
        sizeBytes: 1024,
        formatName: "mp3",
        speedMultiplier: 2,
        overlapSec: 1,
        chunks: [
          {
            index: 1,
            path: "/tmp/chunk-002.mp3",
            startSec: 10,
            durationSec: 10,
            sizeBytes: 512,
            overlapBeforeSec: 1,
            overlapAfterSec: 0,
          },
          {
            index: 0,
            path: "/tmp/chunk-001.mp3",
            startSec: 0,
            durationSec: 10,
            sizeBytes: 512,
            overlapBeforeSec: 0,
            overlapAfterSec: 1,
          },
        ],
      },
      {
        language: "fr",
      },
    );

    expect(transcribeMocks.createReadStream).toHaveBeenCalledWith("/tmp/chunk-002.mp3");
    expect(transcribeMocks.createReadStream).toHaveBeenCalledWith("/tmp/chunk-001.mp3");
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        file: "stream:/tmp/chunk-002.mp3",
        model: "gpt-4o-transcribe-diarize",
        language: "fr",
      }),
    );
    expect(result.chunkTranscripts.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(result.mergedSegments.map((segment) => segment.text)).toEqual(["Chunk one", "Chunk two"]);
  });

  it("omits the language hint when none is provided", async () => {
    const create = vi.fn().mockResolvedValue({
      text: "Fallback chunk transcript",
    });

    const result = await transcribePreparedAudio(
      {
        audio: {
          transcriptions: {
            create,
          },
        },
      } as never,
      {
        sourcePath: "/tmp/source.m4a",
        preparedPath: "/tmp/prepared.mp3",
        durationSec: 5,
        sizeBytes: 256,
        formatName: "mp3",
        speedMultiplier: 2,
        overlapSec: 1,
        chunks: [
          {
            index: 0,
            path: "/tmp/chunk-001.mp3",
            startSec: 0,
            durationSec: 5,
            sizeBytes: 256,
            overlapBeforeSec: 0,
            overlapAfterSec: 0,
          },
        ],
      },
    );

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        language: expect.anything(),
      }),
    );
    expect(result.mergedSegments).toEqual([
      {
        id: "seg-00001",
        speaker: "speaker_unknown",
        startSec: 0,
        endSec: 0,
        text: "Fallback chunk transcript",
        chunkIndex: 0,
      },
    ]);
  });
});
