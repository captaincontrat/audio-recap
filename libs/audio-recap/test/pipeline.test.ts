import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pipelineMocks = vi.hoisted(() => ({
  prepareAudioForUpload: vi.fn(),
  transcribePreparedAudio: vi.fn(),
  buildTranscriptArtifacts: vi.fn(),
  generateMeetingSummary: vi.fn(),
}));

vi.mock("../src/audio/ffmpeg.js", () => ({
  DEFAULT_CHUNK_OVERLAP_SEC: 1,
  prepareAudioForUpload: pipelineMocks.prepareAudioForUpload,
}));

vi.mock("../src/domain/transcript.js", () => ({
  buildTranscriptArtifacts: pipelineMocks.buildTranscriptArtifacts,
}));

vi.mock("../src/openai/summarize.js", () => ({
  generateMeetingSummary: pipelineMocks.generateMeetingSummary,
}));

vi.mock("../src/openai/transcribe.js", () => ({
  transcribePreparedAudio: pipelineMocks.transcribePreparedAudio,
}));

import { runMeetingPipeline } from "../src/pipeline/process-meeting.js";

const preparedAudio = {
  sourcePath: "/tmp/source.m4a",
  preparedPath: "/tmp/prepared.mp3",
  durationSec: 60,
  sizeBytes: 2048,
  formatName: "mp3",
  speedMultiplier: 2,
  overlapSec: 1,
  chunks: [
    {
      index: 0,
      path: "/tmp/chunk-001.mp3",
      startSec: 0,
      durationSec: 60,
      sizeBytes: 2048,
      overlapBeforeSec: 0,
      overlapAfterSec: 0,
    },
  ],
};

const transcription = {
  chunkTranscripts: [],
  mergedSegments: [{ id: "seg-00001", speaker: "Alice", startSec: 0, endSec: 1, text: "hello", chunkIndex: 0 }],
};

const transcriptArtifacts = {
  segments: transcription.mergedSegments,
  blocks: [{ id: "block-0001", startSec: 0, endSec: 1, content: "", segmentIds: ["seg-00001"] }],
  speakers: ["Alice"],
  fullText: "",
};

describe("runMeetingPipeline", () => {
  beforeEach(() => {
    pipelineMocks.prepareAudioForUpload.mockResolvedValue(preparedAudio);
    pipelineMocks.transcribePreparedAudio.mockResolvedValue(transcription);
    pipelineMocks.buildTranscriptArtifacts.mockReturnValue(transcriptArtifacts);
    pipelineMocks.generateMeetingSummary.mockResolvedValue("# Summary");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs the full pipeline for an original upload and emits stage hooks", async () => {
    const stages: string[] = [];
    const result = await runMeetingPipeline(
      {} as never,
      {
        inputKind: "original",
        audioPath: "/tmp/source.m4a",
        tempDir: "/tmp/work",
        meetingNotes: "notes body",
        notesPath: "/tmp/notes.md",
        outputLanguage: "fr",
        overlapSec: 2,
      },
      {
        onStage: (stage) => {
          stages.push(stage);
        },
      },
    );

    expect(stages).toEqual(["prepare-audio", "transcribe", "build-transcript", "generate-summary"]);
    expect(pipelineMocks.prepareAudioForUpload).toHaveBeenCalledWith("/tmp/source.m4a", "/tmp/work", { overlapSec: 2 });
    expect(pipelineMocks.transcribePreparedAudio).toHaveBeenCalledWith({}, preparedAudio, { language: "fr" });
    expect(pipelineMocks.generateMeetingSummary).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        audioPath: "/tmp/source.m4a",
        notesPath: "/tmp/notes.md",
        meetingNotes: "notes body",
        outputLanguage: "fr",
        transcriptBlocks: transcriptArtifacts.blocks,
      }),
    );
    expect(result).toMatchObject({
      inputKind: "original",
      preparedAudio,
      transcription,
      transcriptArtifacts,
      summary: "# Summary",
    });
  });

  it("accepts an MP3 derivative input and applies default overlap/no-notes defaults", async () => {
    const result = await runMeetingPipeline({} as never, {
      inputKind: "mp3-derivative",
      audioPath: "/tmp/derivative.mp3",
      tempDir: "/tmp/derivative-work",
    });

    expect(pipelineMocks.prepareAudioForUpload).toHaveBeenCalledWith("/tmp/derivative.mp3", "/tmp/derivative-work", { overlapSec: 1 });
    expect(pipelineMocks.transcribePreparedAudio).toHaveBeenCalledWith({}, preparedAudio, {});
    expect(pipelineMocks.generateMeetingSummary).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        audioPath: "/tmp/derivative.mp3",
        meetingNotes: "",
        transcriptBlocks: transcriptArtifacts.blocks,
      }),
    );
    expect(pipelineMocks.generateMeetingSummary).toHaveBeenCalledWith({}, expect.not.objectContaining({ outputLanguage: expect.anything() }));
    expect(pipelineMocks.generateMeetingSummary).toHaveBeenCalledWith({}, expect.not.objectContaining({ notesPath: expect.anything() }));
    expect(result.inputKind).toBe("mp3-derivative");
  });
});
