import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import {
  type InsertProcessingJobRow,
  type InsertTranscriptRow,
  processingJob,
  type ProcessingJobRow,
  transcript,
  type TranscriptFailureCode,
  type TranscriptRow,
  type TranscriptStatus,
} from "@/lib/server/db/schema";

// DB helpers that persist, advance, and clean up transcript +
// processing-job rows. Callers that need pure decision logic (status
// transitions, retry classification) should reach for the sibling
// `retry-policy`, `stage-plan`, and `submission-decisions` modules;
// this file only handles the Drizzle writes.

export type CreateTranscriptAndJobInputs = {
  transcriptId: string;
  processingJobId: string;
  workspaceId: string;
  createdByUserId: string | null;
  sourceMediaKind: "audio" | "video";
  submittedWithNotes: boolean;
  mediaNormalizationPolicySnapshot: "optional" | "required";
  mediaInputKind: "original" | "mp3-derivative";
  uploadId: string;
  mediaInputKey: string;
  mediaContentType: string;
  notesInputKey: string | null;
  now?: Date;
};

export type CreatedSubmission = {
  transcript: TranscriptRow;
  processingJob: ProcessingJobRow;
};

export async function createTranscriptAndJob(inputs: CreateTranscriptAndJobInputs): Promise<CreatedSubmission> {
  const now = inputs.now ?? new Date();
  const transcriptInsert: InsertTranscriptRow = {
    id: inputs.transcriptId,
    workspaceId: inputs.workspaceId,
    createdByUserId: inputs.createdByUserId,
    status: "queued",
    sourceMediaKind: inputs.sourceMediaKind,
    submittedWithNotes: inputs.submittedWithNotes,
    createdAt: now,
    updatedAt: now,
  };

  const jobInsert: InsertProcessingJobRow = {
    id: inputs.processingJobId,
    transcriptId: inputs.transcriptId,
    status: "queued",
    mediaNormalizationPolicySnapshot: inputs.mediaNormalizationPolicySnapshot,
    mediaInputKind: inputs.mediaInputKind,
    uploadId: inputs.uploadId,
    mediaInputKey: inputs.mediaInputKey,
    mediaContentType: inputs.mediaContentType,
    notesInputKey: inputs.notesInputKey,
    createdAt: now,
    updatedAt: now,
  };

  return await getDb().transaction(async (tx) => {
    const [transcriptRow] = await tx.insert(transcript).values(transcriptInsert).returning();
    const [jobRow] = await tx.insert(processingJob).values(jobInsert).returning();
    if (!transcriptRow || !jobRow) {
      throw new Error("Failed to persist transcript or processing job row");
    }
    return { transcript: transcriptRow, processingJob: jobRow };
  });
}

export async function findTranscriptById(transcriptId: string): Promise<TranscriptRow | null> {
  const rows = await getDb().select().from(transcript).where(eq(transcript.id, transcriptId)).limit(1);
  return rows[0] ?? null;
}

export async function findProcessingJobByTranscriptId(transcriptId: string): Promise<ProcessingJobRow | null> {
  const rows = await getDb().select().from(processingJob).where(eq(processingJob.transcriptId, transcriptId)).limit(1);
  return rows[0] ?? null;
}

// Advance both the transcript and processing-job statuses in lockstep
// so post-submit status reads reflect the worker's current position.
// The helper keeps rows consistent by writing through a single
// transaction.
export async function setSubmissionStatus(transcriptId: string, status: TranscriptStatus, now: Date = new Date()): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.update(transcript).set({ status, updatedAt: now }).where(eq(transcript.id, transcriptId));
    await tx.update(processingJob).set({ status, updatedAt: now }).where(eq(processingJob.transcriptId, transcriptId));
  });
}

export async function recordJobAttemptStart(transcriptId: string, attempts: number, now: Date = new Date()): Promise<void> {
  await getDb().update(processingJob).set({ attempts, updatedAt: now }).where(eq(processingJob.transcriptId, transcriptId));
}

export async function recordRetryingFailure(
  transcriptId: string,
  args: { failureCode: TranscriptFailureCode; failureSummary: string; now?: Date },
): Promise<void> {
  const now = args.now ?? new Date();
  await getDb().transaction(async (tx) => {
    await tx.update(transcript).set({ status: "retrying", updatedAt: now }).where(eq(transcript.id, transcriptId));
    await tx
      .update(processingJob)
      .set({
        status: "retrying",
        lastFailureCode: args.failureCode,
        lastFailureSummary: args.failureSummary,
        updatedAt: now,
      })
      .where(eq(processingJob.transcriptId, transcriptId));
  });
}

export type PersistSuccessArgs = {
  title: string;
  transcriptMarkdown: string;
  recapMarkdown: string;
  originalDurationSec: number | null;
  now?: Date;
};

// Persist successful canonical content at the finalizing stage.
// Terminal publication happens later, after transient cleanup runs,
// through `markCompleted`.
export async function persistSuccessfulContent(transcriptId: string, args: PersistSuccessArgs): Promise<void> {
  const now = args.now ?? new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(transcript)
      .set({
        status: "finalizing",
        title: args.title,
        transcriptMarkdown: args.transcriptMarkdown,
        recapMarkdown: args.recapMarkdown,
        originalDurationSec: args.originalDurationSec,
        updatedAt: now,
      })
      .where(eq(transcript.id, transcriptId));
    await tx.update(processingJob).set({ status: "finalizing", updatedAt: now }).where(eq(processingJob.transcriptId, transcriptId));
  });
}

// Persist the generic failure summary at the finalizing stage without
// marking the transcript terminal. The worker publishes the terminal
// state only after transient cleanup succeeds.
export async function persistFailureSummary(
  transcriptId: string,
  args: { failureCode: TranscriptFailureCode; failureSummary: string; now?: Date },
): Promise<void> {
  const now = args.now ?? new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(transcript)
      .set({
        status: "finalizing",
        failureCode: args.failureCode,
        failureSummary: args.failureSummary,
        updatedAt: now,
      })
      .where(eq(transcript.id, transcriptId));
    await tx
      .update(processingJob)
      .set({
        status: "finalizing",
        lastFailureCode: args.failureCode,
        lastFailureSummary: args.failureSummary,
        updatedAt: now,
      })
      .where(eq(processingJob.transcriptId, transcriptId));
  });
}

export async function clearTransientReferences(transcriptId: string, now: Date = new Date()): Promise<void> {
  await getDb()
    .update(processingJob)
    .set({
      mediaInputKey: null,
      notesInputKey: null,
      transientCleanupCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(processingJob.transcriptId, transcriptId));
}

export async function markCompleted(transcriptId: string, now: Date = new Date()): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.update(transcript).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(transcript.id, transcriptId));
    await tx.update(processingJob).set({ status: "completed", updatedAt: now }).where(eq(processingJob.transcriptId, transcriptId));
  });
}

export async function markFailed(transcriptId: string, now: Date = new Date()): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.update(transcript).set({ status: "failed", completedAt: now, updatedAt: now }).where(eq(transcript.id, transcriptId));
    await tx.update(processingJob).set({ status: "failed", updatedAt: now }).where(eq(processingJob.transcriptId, transcriptId));
  });
}

// Narrow read used by the post-submit status surface. Caller is
// expected to gate access through workspace membership + archival
// checks before reaching this helper.
export async function findTranscriptForWorkspace(transcriptId: string, workspaceId: string): Promise<TranscriptRow | null> {
  const rows = await getDb()
    .select()
    .from(transcript)
    .where(and(eq(transcript.id, transcriptId), eq(transcript.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}
