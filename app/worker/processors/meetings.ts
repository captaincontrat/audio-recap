import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { probeAudioFile, processMeetingForWorker } from "audio-recap";
import type { Job } from "bullmq";
import OpenAI from "openai";

import { getServerEnv } from "@/lib/server/env";
import { jobLogger } from "@/lib/server/logger";
import {
  classifyRetry,
  clearTransientReferences,
  DEFAULT_MAX_ATTEMPTS,
  defaultFailureSummary,
  findProcessingJobByTranscriptId,
  findTranscriptById,
  markCompleted,
  markFailed,
  MEETING_JOB_NAME,
  type MeetingJobPayload,
  persistFailureSummary,
  persistSuccessfulContent,
  QUEUE_RETRY_DELAY_MS,
  recordJobAttemptStart,
  recordRetryingFailure,
  setSubmissionStatus,
  statusForPipelineStage,
} from "@/lib/server/meetings";
import { QUEUE_NAMES, getQueue } from "@/lib/server/queue/queues";
import { deleteTransientObject, downloadTransientObjectToFile } from "@/lib/server/storage";

type AbortReason = "missing_transcript" | "missing_job" | "already_terminal";

// Worker processor for queued meeting submissions. The processor is
// responsible for:
//   1. Downloading the transient source media (and optional markdown
//      notes) to a private tempdir.
//   2. Driving the shared `audio-recap` pipeline and translating its
//      stage hooks into persistent transcript/processing-job status
//      transitions.
//   3. Persisting canonical content (title, transcript markdown, recap
//      markdown) before publishing the terminal `completed` state.
//   4. Running transient cleanup (S3 + DB references) before the
//      transcript's terminal `completed` or `failed` state is visible,
//      so post-submit status readers never race the worker into a
//      state that still points at deleted media.
//   5. Classifying errors into retry vs terminal outcomes (bounded at
//      `DEFAULT_MAX_ATTEMPTS` attempts) and re-enqueuing the job via
//      BullMQ when retry is warranted.
export async function processMeetingJob(job: Job<MeetingJobPayload>): Promise<void> {
  const log = jobLogger(
    {
      queue: QUEUE_NAMES.meetings,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    },
    { transcriptId: job.data.transcriptId },
  );

  const transcriptRow = await findTranscriptById(job.data.transcriptId);
  if (!transcriptRow) return abort(log, "missing_transcript");
  if (transcriptRow.status === "completed" || transcriptRow.status === "failed") {
    return abort(log, "already_terminal");
  }

  const jobRow = await findProcessingJobByTranscriptId(job.data.transcriptId);
  if (!jobRow) return abort(log, "missing_job");

  const mediaKey = jobRow.mediaInputKey;
  const notesKey = jobRow.notesInputKey;
  if (!mediaKey) {
    // Transient references were already cleared in a prior attempt.
    // Treat as terminal failure — the worker cannot recover without the
    // original media.
    await persistAndPublishFailure({
      transcriptId: job.data.transcriptId,
      mediaKey: null,
      notesKey: null,
      failureCode: "processing_failed",
      failureSummary: defaultFailureSummary("processing_failed"),
      log,
    });
    return;
  }

  const attemptNumber = (jobRow.attempts ?? 0) + 1;
  await recordJobAttemptStart(job.data.transcriptId, attemptNumber);

  const workDir = await mkdtemp(path.join(getWorkerTempRoot(), `meeting-${job.data.transcriptId}-`));
  const mediaPath = path.join(workDir, "source");
  const notesPath = notesKey ? path.join(workDir, "notes.md") : null;

  try {
    log.info({ mediaKey, notesKey: notesKey ?? undefined, attempt: attemptNumber }, "downloading transient inputs");
    await setSubmissionStatus(job.data.transcriptId, "preprocessing");
    await downloadTransientObjectToFile(mediaKey, mediaPath);
    if (notesKey && notesPath) {
      await downloadTransientObjectToFile(notesKey, notesPath);
    }

    const probe = await probeAudioFile(mediaPath).catch(() => null);
    const originalDurationSec = probe?.durationSec ?? null;

    const client = new OpenAI({ apiKey: requireOpenAiApiKey() });
    const result = await processMeetingForWorker(
      client,
      {
        inputKind: jobRow.mediaInputKind,
        audioPath: mediaPath,
        tempDir: workDir,
        ...(notesPath ? { notesPath } : {}),
        ...(typeof originalDurationSec === "number" ? { originalDurationSec } : {}),
      },
      {
        onStage: (stage) => {
          const status = statusForPipelineStage(stage);
          void setSubmissionStatus(job.data.transcriptId, status).catch((err) => log.warn({ err, stage, status }, "failed to persist stage transition"));
        },
      },
    );

    log.info({ attempt: attemptNumber }, "pipeline succeeded; persisting content");
    await persistSuccessfulContent(job.data.transcriptId, {
      title: result.outputs.title,
      transcriptMarkdown: result.outputs.transcriptMarkdown,
      recapMarkdown: result.outputs.summaryMarkdown,
      originalDurationSec,
    });

    await cleanupTransient({
      mediaKey,
      notesKey,
      transcriptId: job.data.transcriptId,
      log,
    });
    await markCompleted(job.data.transcriptId);
    log.info({ attempt: attemptNumber }, "transcript published as completed");
  } catch (err) {
    // We default to `infrastructure` so transient provider or network
    // failures get the bounded retry budget from the retry policy
    // module. Validation failures are caught upstream during
    // submission; anything reaching the worker is presumed runtime
    // infrastructure unless we can prove otherwise.
    const retry = classifyRetry({
      failureKind: "infrastructure",
      attempts: attemptNumber,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });

    if (retry.kind === "retry") {
      const failureSummary = defaultFailureSummary("processing_failed");
      log.warn({ err, attempt: attemptNumber, nextAttempt: retry.nextAttempt }, "worker failure classified as retryable");
      await recordRetryingFailure(job.data.transcriptId, {
        failureCode: "processing_failed",
        failureSummary,
      });
      await getQueue(QUEUE_NAMES.meetings).add(MEETING_JOB_NAME, job.data, {
        delay: QUEUE_RETRY_DELAY_MS,
        attempts: 1,
      });
      return;
    }

    const failureSummary = defaultFailureSummary(retry.failureCode);
    log.error({ err, attempt: attemptNumber, failureCode: retry.failureCode }, "worker failure classified as terminal");
    await persistAndPublishFailure({
      transcriptId: job.data.transcriptId,
      mediaKey,
      notesKey,
      failureCode: retry.failureCode,
      failureSummary,
      log,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch((err) => log.warn({ err, workDir }, "workdir cleanup failed"));
  }
}

async function persistAndPublishFailure(args: {
  transcriptId: string;
  mediaKey: string | null;
  notesKey: string | null;
  failureCode: "processing_failed" | "validation_failed";
  failureSummary: string;
  log: ReturnType<typeof jobLogger>;
}): Promise<void> {
  await persistFailureSummary(args.transcriptId, {
    failureCode: args.failureCode,
    failureSummary: args.failureSummary,
  });
  await cleanupTransient({
    mediaKey: args.mediaKey,
    notesKey: args.notesKey,
    transcriptId: args.transcriptId,
    log: args.log,
  });
  await markFailed(args.transcriptId);
}

async function cleanupTransient(args: {
  mediaKey: string | null;
  notesKey: string | null;
  transcriptId: string;
  log: ReturnType<typeof jobLogger>;
}): Promise<void> {
  const keys = [args.mediaKey, args.notesKey].filter((key): key is string => typeof key === "string" && key.length > 0);
  // Best-effort delete of both transient objects. Errors are logged
  // but do not block publication of the terminal state — the DB-level
  // `clearTransientReferences` always runs so the references are
  // removed even if the object delete is transient.
  await Promise.all(keys.map((key) => deleteTransientObject(key).catch((err) => args.log.warn({ err, key }, "transient delete failed"))));
  await clearTransientReferences(args.transcriptId).catch((err) =>
    args.log.warn({ err, transcriptId: args.transcriptId }, "clear transient references failed"),
  );
}

function getWorkerTempRoot(): string {
  return getServerEnv().WORKER_TEMP_DIR ?? tmpdir();
}

function requireOpenAiApiKey(): string {
  const env = getServerEnv();
  const key = env.OPENAI_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error("OPENAI_API_KEY must be set for the worker runtime.");
  }
  return key;
}

function abort(log: ReturnType<typeof jobLogger>, reason: AbortReason): void {
  log.warn({ reason }, "meeting job aborted");
}
