import { describe, expect, it } from "vitest";

import { buildDurationRatio, DEFAULT_DURATION_RATIO, normalizeSegmentsToOriginalTime } from "../src/domain/timestamps.js";
import type { TranscriptSegment } from "../src/domain/transcript.js";

const preparedSegments: TranscriptSegment[] = [
  {
    id: "seg-00001",
    speaker: "Alice",
    startSec: 1,
    endSec: 2,
    text: "Kickoff",
    chunkIndex: 0,
  },
  {
    id: "seg-00002",
    speaker: "Bob",
    startSec: 10,
    endSec: 11.5,
    text: "Budget",
    chunkIndex: 1,
  },
];

describe("buildDurationRatio", () => {
  it("prefers observed duration when both original and prepared values are valid", () => {
    expect(buildDurationRatio({ originalDurationSec: 120, preparedDurationSec: 60 })).toEqual({
      value: 2,
      source: "duration-observed",
    });
  });

  it("falls back to the speed multiplier when durations are not observable", () => {
    expect(buildDurationRatio({ preparedDurationSec: 60, speedMultiplier: 2 })).toEqual({
      value: 2,
      source: "speed-multiplier",
    });
    expect(buildDurationRatio({ originalDurationSec: 0, speedMultiplier: 2 })).toEqual({
      value: 2,
      source: "speed-multiplier",
    });
  });

  it("uses the default ratio when nothing reliable is provided", () => {
    expect(buildDurationRatio({})).toBe(DEFAULT_DURATION_RATIO);
    expect(buildDurationRatio({ originalDurationSec: Number.NaN, preparedDurationSec: 60 })).toBe(DEFAULT_DURATION_RATIO);
    expect(buildDurationRatio({ speedMultiplier: -1 })).toBe(DEFAULT_DURATION_RATIO);
    expect(buildDurationRatio({ speedMultiplier: Number.POSITIVE_INFINITY })).toBe(DEFAULT_DURATION_RATIO);
  });
});

describe("normalizeSegmentsToOriginalTime", () => {
  it("returns an empty list when no segments are provided", () => {
    expect(normalizeSegmentsToOriginalTime([], { value: 2, source: "speed-multiplier" })).toEqual([]);
  });

  it("returns a shallow copy when the ratio is 1", () => {
    const ratio = { value: 1, source: "default" as const };
    const result = normalizeSegmentsToOriginalTime(preparedSegments, ratio);

    expect(result).toEqual(preparedSegments);
    expect(result[0]).not.toBe(preparedSegments[0]);
  });

  it("rescales timestamps back to the original media time", () => {
    const result = normalizeSegmentsToOriginalTime(preparedSegments, {
      value: 2,
      source: "duration-observed",
    });

    expect(result).toEqual([
      {
        id: "seg-00001",
        speaker: "Alice",
        startSec: 2,
        endSec: 4,
        text: "Kickoff",
        chunkIndex: 0,
      },
      {
        id: "seg-00002",
        speaker: "Bob",
        startSec: 20,
        endSec: 23,
        text: "Budget",
        chunkIndex: 1,
      },
    ]);
  });

  it("rounds rescaled timestamps to the nearest millisecond", () => {
    const [segment] = normalizeSegmentsToOriginalTime(
      [
        {
          id: "seg-0001",
          speaker: "Alice",
          startSec: 0.3333,
          endSec: 1.6667,
          text: "Clip",
          chunkIndex: 0,
        },
      ],
      { value: 1.999, source: "duration-observed" },
    );

    expect(segment.startSec).toBe(0.666);
    expect(segment.endSec).toBe(3.332);
  });
});
