import type { Job } from "bullmq";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type OnStageCallback = (stage: "prepare-audio" | "transcribe" | "build-transcript" | "generate-summary") => void;

// The worker processor orchestrates side-effects across the DB
// (`@/lib/server/meetings`), the BullMQ queue, the transient object
// store, the shared `audio-recap` pipeline, and OpenAI. The tests
// below replace each external dependency with an observable fake so we
// can assert the orchestration contract (status transitions, retry
// enqueueing, cleanup-before-terminal-state) without spinning up
// Postgres, Redis, or the transcription provider.

const callOrder: string[] = [];
function record<K extends string>(name: K) {
  return async (...args: unknown[]): Promise<unknown> => {
    callOrder.push(name);
    return recordImpl[name]?.(...args);
  };
}

type RecordImpl = Record<string, (...args: unknown[]) => unknown>;
const recordImpl: RecordImpl = {};

const meetingsMock = vi.hoisted(() => ({
  classifyRetry: vi.fn(),
  clearTransientReferences: vi.fn(),
  defaultFailureSummary: vi.fn((code: string) => `summary:${code}`),
  findProcessingJobByTranscriptId: vi.fn(),
  findTranscriptById: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
  persistFailureSummary: vi.fn(),
  persistSuccessfulContent: vi.fn(),
  recordJobAttemptStart: vi.fn(),
  recordRetryingFailure: vi.fn(),
  setSubmissionStatus: vi.fn(),
  statusForPipelineStage: vi.fn((stage: string) => stage),
  DEFAULT_MAX_ATTEMPTS: 3,
  QUEUE_RETRY_DELAY_MS: 15_000,
  MEETING_JOB_NAME: "process-meeting",
}));

const queueMock = vi.hoisted(() => {
  const queue = { add: vi.fn() };
  return {
    QUEUE_NAMES: { meetings: "meetings" },
    getQueue: vi.fn(() => queue),
    __queue: queue,
  };
});

const storageMock = vi.hoisted(() => ({
  deleteTransientObject: vi.fn(),
  downloadTransientObjectToFile: vi.fn(),
}));

const envMock = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({ OPENAI_API_KEY: "sk-test", WORKER_TEMP_DIR: undefined })),
}));

const loggerMock = vi.hoisted(() => {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { jobLogger: vi.fn(() => log), __log: log };
});

const audioRecapMock = vi.hoisted(() => ({
  probeAudioFile: vi.fn(),
  processMeetingForWorker: vi.fn(),
}));

const fsMock = vi.hoisted(() => ({
  mkdtemp: vi.fn(async (prefix: string) => `${prefix}work`),
  rm: vi.fn(async () => undefined),
}));

const openaiMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/meetings", () => meetingsMock);
vi.mock("@/lib/server/queue/queues", () => ({
  QUEUE_NAMES: queueMock.QUEUE_NAMES,
  getQueue: queueMock.getQueue,
}));
vi.mock("@/lib/server/storage", () => storageMock);
vi.mock("@/lib/server/env", () => envMock);
vi.mock("@/lib/server/logger", () => loggerMock);
vi.mock("audio-recap", () => audioRecapMock);
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, ...fsMock };
});
vi.mock("openai", () => ({ default: openaiMock }));

function makeTranscript(overrides: Record<string, unknown> = {}) {
  return {
    id: "trx_1",
    status: "queued",
    workspaceId: "ws_1",
    createdByUserId: "user_1",
    title: "",
    transcriptMarkdown: "",
    recapMarkdown: "",
    sourceMediaKind: "audio",
    originalDurationSec: null,
    submittedWithNotes: false,
    failureCode: null,
    failureSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job_1",
    transcriptId: "trx_1",
    status: "queued",
    mediaNormalizationPolicySnapshot: "optional",
    mediaInputKind: "original" as const,
    uploadId: "up_1",
    mediaInputKey: "transient-inputs/up_1/media/source",
    mediaContentType: "audio/mpeg",
    notesInputKey: null as string | null,
    attempts: 0,
    maxAttempts: 3,
    lastFailureCode: null,
    lastFailureSummary: null,
    transientCleanupCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeBullJob(dataOverrides: Record<string, unknown> = {}): Job<{ transcriptId: string; processingJobId: string; uploadId: string }> {
  return {
    id: "queue_job_1",
    name: "process-meeting",
    attemptsMade: 0,
    data: { transcriptId: "trx_1", processingJobId: "job_1", uploadId: "up_1", ...dataOverrides },
  } as unknown as Job<{ transcriptId: string; processingJobId: string; uploadId: string }>;
}

async function loadProcessor() {
  const mod = await import("@/worker/processors/meetings");
  return mod.processMeetingJob;
}

beforeEach(() => {
  callOrder.length = 0;
  for (const key of Object.keys(recordImpl)) delete recordImpl[key];

  // Make every mock record its call into the shared `callOrder` so the
  // cleanup-before-terminal sequencing can be asserted after each run.
  meetingsMock.setSubmissionStatus.mockImplementation(record("setSubmissionStatus"));
  meetingsMock.recordJobAttemptStart.mockImplementation(record("recordJobAttemptStart"));
  meetingsMock.persistSuccessfulContent.mockImplementation(record("persistSuccessfulContent"));
  meetingsMock.persistFailureSummary.mockImplementation(record("persistFailureSummary"));
  meetingsMock.recordRetryingFailure.mockImplementation(record("recordRetryingFailure"));
  meetingsMock.clearTransientReferences.mockImplementation(record("clearTransientReferences"));
  meetingsMock.markCompleted.mockImplementation(record("markCompleted"));
  meetingsMock.markFailed.mockImplementation(record("markFailed"));
  storageMock.deleteTransientObject.mockImplementation(record("deleteTransientObject"));
  storageMock.downloadTransientObjectToFile.mockImplementation(record("downloadTransientObjectToFile"));
  queueMock.__queue.add.mockImplementation(record("queue.add"));

  meetingsMock.findTranscriptById.mockReset().mockResolvedValue(makeTranscript());
  meetingsMock.findProcessingJobByTranscriptId.mockReset().mockResolvedValue(makeJob());
  meetingsMock.classifyRetry.mockReset();

  audioRecapMock.probeAudioFile.mockReset().mockResolvedValue({ durationSec: 42 });
  audioRecapMock.processMeetingForWorker.mockReset().mockResolvedValue({
    outputs: {
      title: "Weekly sync",
      transcriptMarkdown: "## Transcript\nhi",
      summaryMarkdown: "## Recap\nhello",
    },
  });

  queueMock.__queue.add.mockResolvedValue({ id: "next" });
  openaiMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("processMeetingJob", () => {
  test("runs the happy path: download → pipeline → persist → cleanup → mark completed", async () => {
    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.recordJobAttemptStart).toHaveBeenCalledWith("trx_1", 1);
    expect(storageMock.downloadTransientObjectToFile).toHaveBeenCalledWith("transient-inputs/up_1/media/source", expect.stringContaining("source"));
    expect(audioRecapMock.processMeetingForWorker).toHaveBeenCalled();
    expect(meetingsMock.persistSuccessfulContent).toHaveBeenCalledWith("trx_1", {
      title: "Weekly sync",
      transcriptMarkdown: "## Transcript\nhi",
      recapMarkdown: "## Recap\nhello",
      originalDurationSec: 42,
    });
    expect(meetingsMock.markCompleted).toHaveBeenCalledTimes(1);
    expect(meetingsMock.markFailed).not.toHaveBeenCalled();

    const completedAt = callOrder.indexOf("markCompleted");
    const cleanupAt = Math.min(...["deleteTransientObject", "clearTransientReferences"].map((name) => callOrder.indexOf(name)).filter((idx) => idx !== -1));
    expect(cleanupAt).toBeLessThan(completedAt);
  });

  test("downloads notes when a notes key is present", async () => {
    meetingsMock.findProcessingJobByTranscriptId.mockResolvedValue(makeJob({ notesInputKey: "transient-inputs/up_1/notes/meeting.md" }));

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(storageMock.downloadTransientObjectToFile).toHaveBeenCalledWith("transient-inputs/up_1/notes/meeting.md", expect.stringContaining("notes.md"));
    expect(storageMock.deleteTransientObject).toHaveBeenCalledWith("transient-inputs/up_1/notes/meeting.md");
  });

  test("publishes each pipeline stage onto the transcript status surface", async () => {
    audioRecapMock.processMeetingForWorker.mockImplementation(async (_client, _inputs, handlers) => {
      const onStage = (handlers as { onStage?: OnStageCallback } | undefined)?.onStage;
      onStage?.("prepare-audio");
      onStage?.("transcribe");
      onStage?.("generate-summary");
      return {
        outputs: {
          title: "Title",
          transcriptMarkdown: "T",
          summaryMarkdown: "S",
        },
      };
    });

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    const calls = meetingsMock.setSubmissionStatus.mock.calls.map((call) => call[1]);
    expect(calls).toContain("preprocessing");
    expect(calls).toContain("prepare-audio");
    expect(calls).toContain("transcribe");
    expect(calls).toContain("generate-summary");
  });

  test("re-enqueues with the shared retry delay when classification returns retry", async () => {
    audioRecapMock.processMeetingForWorker.mockRejectedValue(new Error("transient provider 5xx"));
    meetingsMock.classifyRetry.mockReturnValue({ kind: "retry", nextAttempt: 2 });

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.recordRetryingFailure).toHaveBeenCalledWith("trx_1", {
      failureCode: "processing_failed",
      failureSummary: expect.stringContaining("processing_failed"),
    });
    expect(queueMock.__queue.add).toHaveBeenCalledWith(
      "process-meeting",
      { transcriptId: "trx_1", processingJobId: "job_1", uploadId: "up_1" },
      { delay: 15_000, attempts: 1 },
    );
    expect(meetingsMock.markFailed).not.toHaveBeenCalled();
    expect(meetingsMock.markCompleted).not.toHaveBeenCalled();
  });

  test("publishes a terminal failure when the retry budget is exhausted, cleaning transient data first", async () => {
    audioRecapMock.processMeetingForWorker.mockRejectedValue(new Error("final blow"));
    meetingsMock.classifyRetry.mockReturnValue({ kind: "fail_terminal", failureCode: "processing_failed" });

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob({ attemptsMade: 2 } as Record<string, unknown>));

    expect(meetingsMock.persistFailureSummary).toHaveBeenCalledWith("trx_1", {
      failureCode: "processing_failed",
      failureSummary: expect.stringContaining("processing_failed"),
    });
    expect(meetingsMock.markFailed).toHaveBeenCalledTimes(1);
    expect(meetingsMock.markCompleted).not.toHaveBeenCalled();

    const persistAt = callOrder.indexOf("persistFailureSummary");
    const deleteAt = callOrder.indexOf("deleteTransientObject");
    const clearAt = callOrder.indexOf("clearTransientReferences");
    const failedAt = callOrder.indexOf("markFailed");
    expect(persistAt).toBeGreaterThanOrEqual(0);
    expect(deleteAt).toBeGreaterThan(persistAt);
    expect(clearAt).toBeGreaterThan(deleteAt);
    expect(failedAt).toBeGreaterThan(clearAt);
  });

  test("aborts without side effects when the transcript row is missing", async () => {
    meetingsMock.findTranscriptById.mockResolvedValue(null);

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.findProcessingJobByTranscriptId).not.toHaveBeenCalled();
    expect(meetingsMock.markCompleted).not.toHaveBeenCalled();
    expect(meetingsMock.markFailed).not.toHaveBeenCalled();
    expect(audioRecapMock.processMeetingForWorker).not.toHaveBeenCalled();
  });

  test("aborts without side effects when the transcript is already in a terminal state", async () => {
    meetingsMock.findTranscriptById.mockResolvedValue(makeTranscript({ status: "completed" }));

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.findProcessingJobByTranscriptId).not.toHaveBeenCalled();
    expect(audioRecapMock.processMeetingForWorker).not.toHaveBeenCalled();
  });

  test("aborts without side effects when the processing job row is missing", async () => {
    meetingsMock.findProcessingJobByTranscriptId.mockResolvedValue(null);

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.recordJobAttemptStart).not.toHaveBeenCalled();
    expect(audioRecapMock.processMeetingForWorker).not.toHaveBeenCalled();
  });

  test("fails terminally and cleans up if transient references were already cleared on a prior attempt", async () => {
    meetingsMock.findProcessingJobByTranscriptId.mockResolvedValue(makeJob({ mediaInputKey: null }));

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.persistFailureSummary).toHaveBeenCalledWith("trx_1", {
      failureCode: "processing_failed",
      failureSummary: expect.stringContaining("processing_failed"),
    });
    expect(meetingsMock.markFailed).toHaveBeenCalledTimes(1);
    expect(audioRecapMock.processMeetingForWorker).not.toHaveBeenCalled();
    const clearAt = callOrder.indexOf("clearTransientReferences");
    const failedAt = callOrder.indexOf("markFailed");
    expect(clearAt).toBeLessThan(failedAt);
  });

  test("throws if the OPENAI_API_KEY env is missing so the worker fails fast", async () => {
    envMock.getServerEnv.mockReturnValueOnce({ OPENAI_API_KEY: "", WORKER_TEMP_DIR: undefined });
    envMock.getServerEnv.mockReturnValueOnce({ OPENAI_API_KEY: "", WORKER_TEMP_DIR: undefined });
    meetingsMock.classifyRetry.mockReturnValue({ kind: "fail_terminal", failureCode: "processing_failed" });

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(openaiMock).not.toHaveBeenCalled();
    // The worker catches the missing-key error as a runtime failure and
    // routes it through the classifier.
    expect(meetingsMock.classifyRetry).toHaveBeenCalledWith({
      failureKind: "infrastructure",
      attempts: 1,
      maxAttempts: 3,
    });
  });

  test("tolerates transient delete failures without blocking terminal publication", async () => {
    storageMock.deleteTransientObject.mockRejectedValue(new Error("s3 blip"));

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob({} as Record<string, unknown>));

    expect(meetingsMock.markCompleted).toHaveBeenCalledTimes(1);
    expect(loggerMock.__log.warn).toHaveBeenCalled();
  });

  test("tolerates clearTransientReferences failures without blocking terminal publication", async () => {
    meetingsMock.clearTransientReferences.mockRejectedValue(new Error("db blip"));

    const processMeetingJob = await loadProcessor();
    await processMeetingJob(makeBullJob());

    expect(meetingsMock.markCompleted).toHaveBeenCalledTimes(1);
    expect(loggerMock.__log.warn).toHaveBeenCalled();
  });
});
