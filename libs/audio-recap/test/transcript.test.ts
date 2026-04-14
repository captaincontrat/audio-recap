import { describe, expect, it } from "vitest";

import { buildTranscriptArtifacts, formatTimestamp, mergeChunkTranscriptions, __private__ as transcriptPrivate } from "../src/domain/transcript.js";

describe("transcript domain helpers", () => {
  it("formats timestamps and handles empty transcript artifacts", () => {
    expect(formatTimestamp(-12.4)).toBe("00:00:00");
    expect(formatTimestamp(3661.9)).toBe("01:01:01");

    expect(buildTranscriptArtifacts([])).toEqual({
      segments: [],
      blocks: [],
      speakers: [],
      fullText: "",
    });
  });

  it("merges exact duplicate segments and assigns stable ids", () => {
    const merged = mergeChunkTranscriptions(
      [
        {
          chunkIndex: 0,
          chunkStartSec: 0,
          segments: [
            {
              speaker: "Alice",
              startSec: 0,
              endSec: 1,
              text: " Hello world ",
            },
            {
              speaker: "Bob",
              startSec: 0,
              endSec: 1.2,
              text: "hello world",
            },
            {
              speaker: "Alice",
              startSec: 4,
              endSec: 5,
              text: "  ",
            },
          ],
        },
      ],
      1,
    );

    expect(merged).toEqual([
      {
        id: "seg-00001",
        speaker: "Alice",
        startSec: 0,
        endSec: 1.2,
        text: "Hello world",
        chunkIndex: 0,
      },
    ]);
  });

  it("deduplicates close segments when one transcript contains the other", () => {
    const merged = mergeChunkTranscriptions(
      [
        {
          chunkIndex: 0,
          chunkStartSec: 0,
          segments: [
            {
              speaker: "Alice",
              startSec: 5,
              endSec: 6,
              text: "budget blockers next steps",
            },
          ],
        },
        {
          chunkIndex: 1,
          chunkStartSec: 0.5,
          segments: [
            {
              speaker: "Bob",
              startSec: 4.5,
              endSec: 6.2,
              text: "budget blockers next steps now",
            },
          ],
        },
      ],
      1,
    );

    expect(merged).toEqual([
      {
        id: "seg-00001",
        speaker: "Bob",
        startSec: 5,
        endSec: 6.7,
        text: "budget blockers next steps now",
        chunkIndex: 0,
      },
    ]);
  });

  it("builds transcript blocks from segment limits", () => {
    const segments = [
      {
        id: "seg-00001",
        speaker: "Alice",
        startSec: 0,
        endSec: 1,
        text: "Kickoff",
        chunkIndex: 0,
      },
      {
        id: "seg-00002",
        speaker: "Bob",
        startSec: 2,
        endSec: 3,
        text: "Budget",
        chunkIndex: 0,
      },
    ];

    const artifacts = buildTranscriptArtifacts(segments, {
      maxSegmentsPerBlock: 1,
      maxBlockChars: 32,
    });

    expect(artifacts.speakers).toEqual(["Alice", "Bob"]);
    expect(artifacts.fullText).toBe("[00:00:00] Alice: Kickoff\n[00:00:02] Bob: Budget");
    expect(artifacts.blocks).toEqual([
      {
        id: "block-0001",
        startSec: 0,
        endSec: 1,
        content: "[00:00:00 - 00:00:01] Alice: Kickoff",
        segmentIds: ["seg-00001"],
      },
      {
        id: "block-0002",
        startSec: 2,
        endSec: 3,
        content: "[00:00:02 - 00:00:03] Bob: Budget",
        segmentIds: ["seg-00002"],
      },
    ]);
  });

  it("splits transcript blocks when a block would exceed the character limit", () => {
    const artifacts = buildTranscriptArtifacts(
      [
        {
          id: "seg-00001",
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "This first line is intentionally long.",
          chunkIndex: 0,
        },
        {
          id: "seg-00002",
          speaker: "Bob",
          startSec: 2,
          endSec: 3,
          text: "This second line also takes space.",
          chunkIndex: 0,
        },
      ],
      {
        maxSegmentsPerBlock: 10,
        maxBlockChars: 70,
      },
    );

    expect(artifacts.blocks).toHaveLength(2);
  });

  it("keeps multiple segments in the same block when limits are not reached", () => {
    const artifacts = buildTranscriptArtifacts(
      [
        {
          id: "seg-00001",
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "Short line",
          chunkIndex: 0,
        },
        {
          id: "seg-00002",
          speaker: "Bob",
          startSec: 2,
          endSec: 3,
          text: "Another short line",
          chunkIndex: 0,
        },
      ],
      {
        maxSegmentsPerBlock: 10,
        maxBlockChars: 500,
      },
    );

    expect(artifacts.blocks).toEqual([
      {
        id: "block-0001",
        startSec: 0,
        endSec: 3,
        content: "[00:00:00 - 00:00:01] Alice: Short line\n[00:00:02 - 00:00:03] Bob: Another short line",
        segmentIds: ["seg-00001", "seg-00002"],
      },
    ]);
  });

  it("exposes internal helpers for edge-case coverage", () => {
    expect(transcriptPrivate.normalizeText(" Café,   team! ")).toBe("cafe team");
    expect(transcriptPrivate.computeWordOverlap("", "alpha beta")).toBe(0);
    expect(transcriptPrivate.computeWordOverlap("alpha beta gamma delta epsilon", "alpha beta gamma delta zeta")).toBe(0.8);
    expect(transcriptPrivate.pickPreferredText("alpha beta gamma", "beta gamma")).toBe("alpha beta gamma");
    expect(transcriptPrivate.pickPreferredText("beta gamma", "alpha beta gamma")).toBe("alpha beta gamma");
    expect(transcriptPrivate.pickPreferredText("hello", "hello!")).toBe("hello!");
    expect(transcriptPrivate.pickPreferredText("status", "project recap")).toBe("project recap");
    expect(transcriptPrivate.pickPreferredText("project retrospective", "summary")).toBe("project retrospective");

    expect(
      transcriptPrivate.shouldDeduplicate(
        {
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "!!!",
          chunkIndex: 0,
        },
        {
          speaker: "Bob",
          startSec: 0.3,
          endSec: 1.3,
          text: "alpha beta",
          chunkIndex: 1,
        },
        1,
      ),
    ).toBe(false);

    expect(
      transcriptPrivate.shouldDeduplicate(
        {
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "alpha beta gamma",
          chunkIndex: 0,
        },
        {
          speaker: "Bob",
          startSec: 0.4,
          endSec: 1.4,
          text: "alpha beta",
          chunkIndex: 1,
        },
        1,
      ),
    ).toBe(true);

    expect(
      transcriptPrivate.shouldDeduplicate(
        {
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "alpha beta gamma delta epsilon",
          chunkIndex: 0,
        },
        {
          speaker: "Bob",
          startSec: 0.5,
          endSec: 1.5,
          text: "alpha beta gamma delta zeta",
          chunkIndex: 1,
        },
        1,
      ),
    ).toBe(true);

    expect(
      transcriptPrivate.shouldDeduplicate(
        {
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "hello there",
          chunkIndex: 0,
        },
        {
          speaker: "Bob",
          startSec: 10,
          endSec: 11,
          text: "hello there",
          chunkIndex: 1,
        },
        1,
      ),
    ).toBe(false);

    expect(
      transcriptPrivate.mergeDuplicatePair(
        {
          speaker: "Alice",
          startSec: 0,
          endSec: 1,
          text: "project update today",
          chunkIndex: 2,
        },
        {
          speaker: "Bob",
          startSec: 0.2,
          endSec: 1.1,
          text: "project update",
          chunkIndex: 4,
        },
      ),
    ).toEqual({
      speaker: "Alice",
      startSec: 0,
      endSec: 1.1,
      text: "project update today",
      chunkIndex: 2,
    });

    expect(
      transcriptPrivate.mergeDuplicatePair(
        {
          speaker: "Alice",
          startSec: 1,
          endSec: 2,
          text: "Hello world",
          chunkIndex: 3,
        },
        {
          speaker: "Bob",
          startSec: 1.2,
          endSec: 2.2,
          text: "hello world",
          chunkIndex: 4,
        },
      ),
    ).toEqual({
      speaker: "Alice",
      startSec: 1,
      endSec: 2.2,
      text: "Hello world",
      chunkIndex: 3,
    });
  });
});
