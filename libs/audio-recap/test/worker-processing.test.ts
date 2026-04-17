import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => ({
  runMeetingPipeline: vi.fn(),
  generateMeetingTitle: vi.fn(),
  buildTranscriptArtifacts: vi.fn(),
}));

vi.mock("../src/pipeline/process-meeting.js", () => ({
  runMeetingPipeline: workerMocks.runMeetingPipeline,
}));

vi.mock("../src/openai/title.js", () => ({
  generateMeetingTitle: workerMocks.generateMeetingTitle,
}));

vi.mock("../src/domain/transcript.js", async () => {
  const actual = await vi.importActual<typeof import("../src/domain/transcript.js")>("../src/domain/transcript.js");
  return {
    ...actual,
    buildTranscriptArtifacts: workerMocks.buildTranscriptArtifacts,
  };
});

import { processMeetingForWorker } from "../src/pipeline/worker-processing.js";

const mergedSegments = [
  { id: "seg-00001", speaker: "Alice", startSec: 0, endSec: 1, text: "Hello", chunkIndex: 0 },
  { id: "seg-00002", speaker: "Bob", startSec: 1, endSec: 2, text: "World", chunkIndex: 0 },
];

const transcriptArtifacts = {
  segments: mergedSegments,
  blocks: [{ id: "block-0001", startSec: 0, endSec: 2, content: "Alice: Hello\nBob: World", segmentIds: ["seg-00001", "seg-00002"] }],
  speakers: ["Alice", "Bob"],
  fullText: "Hello\nWorld",
};

const preparedAudio = {
  sourcePath: "/tmp/source.m4a",
  preparedPath: "/tmp/prepared.mp3",
  durationSec: 30,
  sizeBytes: 1024,
  formatName: "mp3",
  speedMultiplier: 2,
  overlapSec: 1,
  chunks: [
    {
      index: 0,
      path: "/tmp/chunk-001.mp3",
      startSec: 0,
      durationSec: 30,
      sizeBytes: 1024,
      overlapBeforeSec: 0,
      overlapAfterSec: 0,
    },
  ],
};

const pipelineResult = {
  inputKind: "original" as const,
  preparedAudio,
  transcription: { chunkTranscripts: [], mergedSegments },
  transcriptArtifacts,
  summary: "# Meeting recap\n- Decision A",
};

describe("processMeetingForWorker", () => {
  beforeEach(() => {
    workerMocks.runMeetingPipeline.mockResolvedValue(pipelineResult);
    workerMocks.generateMeetingTitle.mockResolvedValue("Q1 Kickoff");
    workerMocks.buildTranscriptArtifacts.mockReturnValue(transcriptArtifacts);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes timestamps using the observed duration ratio and returns privacy-safe markdown", async () => {
    const result = await processMeetingForWorker(
      {} as never,
      {
        inputKind: "original",
        audioPath: "/tmp/source.m4a",
        tempDir: "/tmp/work",
        meetingNotes: "pre-meeting notes",
        outputLanguage: "fr",
        originalDurationSec: 60,
        generatedAt: new Date("2026-04-18T12:00:00.000Z"),
      },
      { onStage: () => {} },
    );

    expect(workerMocks.runMeetingPipeline).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ inputKind: "original", audioPath: "/tmp/source.m4a" }),
      expect.objectContaining({ onStage: expect.any(Function) }),
    );
    expect(result.outputs.durationRatio).toEqual({ value: 2, source: "duration-observed" });
    expect(result.outputs.normalizedSegments.map((segment) => ({ startSec: segment.startSec, endSec: segment.endSec }))).toEqual([
      { startSec: 0, endSec: 2 },
      { startSec: 2, endSec: 4 },
    ]);
    expect(result.outputs.title).toBe("Q1 Kickoff");
    expect(workerMocks.generateMeetingTitle).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        summary: pipelineResult.summary,
        meetingNotes: "pre-meeting notes",
        outputLanguage: "fr",
        transcriptBlocks: transcriptArtifacts.blocks,
      }),
    );
    expect(result.outputs.generatedAt).toBe("2026-04-18T12:00:00.000Z");
    expect(result.outputs.transcriptMarkdown).toContain("# Q1 Kickoff");
    expect(result.outputs.transcriptMarkdown).toContain("timeline du média soumis à l'origine");
    expect(result.outputs.transcriptMarkdown).not.toContain("/tmp/");
    expect(result.outputs.summaryMarkdown).toContain("# Q1 Kickoff");
    expect(result.outputs.summaryMarkdown).not.toContain("/tmp/");
    expect(result.outputs.summaryMarkdown).toContain("Decision A");
  });

  it("accepts an MP3 derivative input and falls back to the speed multiplier when the original duration is unknown", async () => {
    workerMocks.runMeetingPipeline.mockResolvedValueOnce({
      ...pipelineResult,
      inputKind: "mp3-derivative" as const,
    });

    const result = await processMeetingForWorker({} as never, {
      inputKind: "mp3-derivative",
      audioPath: "/tmp/derivative.mp3",
      tempDir: "/tmp/derivative-work",
    });

    expect(result.inputKind).toBe("mp3-derivative");
    expect(result.outputs.durationRatio).toEqual({ value: 2, source: "speed-multiplier" });
    expect(workerMocks.generateMeetingTitle).toHaveBeenCalledWith({}, expect.not.objectContaining({ meetingNotes: expect.anything() }));
    expect(workerMocks.generateMeetingTitle).toHaveBeenCalledWith({}, expect.not.objectContaining({ outputLanguage: expect.anything() }));
    expect(typeof result.outputs.generatedAt).toBe("string");
    expect(result.outputs.generatedAt.length).toBeGreaterThan(0);
  });

  it("uses a string generatedAt verbatim when provided", async () => {
    const result = await processMeetingForWorker({} as never, {
      inputKind: "original",
      audioPath: "/tmp/source.m4a",
      tempDir: "/tmp/work",
      generatedAt: "2026-04-18T00:00:00Z",
    });

    expect(result.outputs.generatedAt).toBe("2026-04-18T00:00:00Z");
  });

  it("ignores blank string generatedAt values and falls back to the current timestamp", async () => {
    const result = await processMeetingForWorker({} as never, {
      inputKind: "original",
      audioPath: "/tmp/source.m4a",
      tempDir: "/tmp/work",
      generatedAt: "   ",
    });

    expect(result.outputs.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
