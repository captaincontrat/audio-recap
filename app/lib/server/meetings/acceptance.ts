import "server-only";

import { getQueue, QUEUE_NAMES } from "@/lib/server/queue/queues";
import { buildTransientInputKey, createTransientPresignedPut, type PresignedPutDescriptor, transientObjectExists } from "@/lib/server/storage";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";

import type { ProcessingJobRow, TranscriptRow } from "@/lib/server/db/schema";
import { SubmissionRefusedError, type SubmissionRefusalReason } from "./errors";
import { generateProcessingJobId, generateTranscriptId, generateUploadId } from "./ids";
import { getMediaNormalizationPolicy } from "./normalization-policy";
import { type BrowserNormalizationOutcome, evaluateSubmission, type SubmissionInputs } from "./submission-decisions";
import { createTranscriptAndJob } from "./transcripts";

// Canonical queue job payload. The worker consumer reads exactly this
// shape so producers and consumers agree without a broader shared
// module; the worker only needs the transcript id to fetch the durable
// row and the upload id to build transient keys.
export type MeetingJobPayload = {
  transcriptId: string;
  processingJobId: string;
  uploadId: string;
};

export const MEETING_JOB_NAME = "process-meeting";

export type AcceptanceInputs = {
  workspaceSlug: string;
  userId: string;
  sourceMediaKind: "audio" | "video";
  mediaBytes: number;
  mediaContentType: string;
  mediaFilename?: string;
  notesText?: string;
  normalization: BrowserNormalizationOutcome;
  now?: Date;
};

export type PreparedUpload = {
  uploadId: string;
  mediaInputKey: string;
  notesInputKey: string | null;
};

export type AcceptanceResult = {
  transcript: TranscriptRow;
  processingJob: ProcessingJobRow;
};

// Step 1 of the acceptance flow: validate the submission against the
// workspace, role, and current normalization policy, then return
// the transient-input keys the caller must upload to before finalizing.
// Keeping this step separate from the durable write lets the browser
// perform the presigned `PUT` uploads in between without holding a
// DB transaction open.
export type AcceptancePlan = {
  workspaceId: string;
  createdByUserId: string;
  resolvedMediaInputKind: "original" | "mp3-derivative";
  mediaNormalizationPolicySnapshot: "optional" | "required";
  sourceMediaKind: "audio" | "video";
  mediaContentType: string;
  submittedWithNotes: boolean;
  prepared: PreparedUpload;
};

export async function planAcceptance(inputs: AcceptanceInputs): Promise<AcceptancePlan> {
  const context = await resolveContextOrRefuse(inputs);

  const policy = await getMediaNormalizationPolicy();
  const notesBytes = inputs.notesText ? Buffer.byteLength(inputs.notesText, "utf8") : 0;

  const submissionInputs: SubmissionInputs = {
    role: context.role,
    workspaceActive: isWorkspaceActive(context.workspace),
    mediaKind: inputs.sourceMediaKind,
    mediaBytes: inputs.mediaBytes,
    mediaContentType: inputs.mediaContentType,
    notesBytes,
    normalizationPolicy: policy,
    normalization: inputs.normalization,
  };

  const decision = evaluateSubmission(submissionInputs);
  if (decision.kind === "refused") {
    throw new SubmissionRefusedError(decision.reason);
  }

  const uploadId = generateUploadId();
  const mediaKind = decision.inputKind === "mp3-derivative" ? "mp3-derivative" : "media";
  const mediaInputKey = buildTransientInputKey({
    uploadId,
    kind: mediaKind,
    filename: inputs.mediaFilename,
  });
  const notesInputKey = inputs.notesText
    ? buildTransientInputKey({
        uploadId,
        kind: "notes",
      })
    : null;

  return {
    workspaceId: context.workspace.id,
    createdByUserId: inputs.userId,
    resolvedMediaInputKind: decision.inputKind,
    mediaNormalizationPolicySnapshot: policy,
    sourceMediaKind: inputs.sourceMediaKind,
    mediaContentType: inputs.mediaContentType,
    submittedWithNotes: Boolean(inputs.notesText),
    prepared: {
      uploadId,
      mediaInputKey,
      notesInputKey,
    },
  };
}

export type FinalizeAcceptanceInputs = {
  plan: AcceptancePlan;
  now?: Date;
};

// Step 2 of the acceptance flow: once the browser confirms the
// presigned uploads landed, create the durable transcript and
// processing-job rows and enqueue the job. We verify the transient
// object is actually present before writing so a dropped upload does
// not leak a queued row the worker cannot run.
export async function finalizeAcceptance(inputs: FinalizeAcceptanceInputs): Promise<AcceptanceResult> {
  const plan = inputs.plan;
  const now = inputs.now ?? new Date();

  const mediaExists = await transientObjectExists(plan.prepared.mediaInputKey);
  if (!mediaExists) {
    throw new SubmissionRefusedError("media_missing");
  }
  if (plan.prepared.notesInputKey) {
    const notesExists = await transientObjectExists(plan.prepared.notesInputKey);
    if (!notesExists) {
      throw new SubmissionRefusedError("media_missing");
    }
  }

  const transcriptId = generateTranscriptId();
  const processingJobId = generateProcessingJobId();

  const created = await createTranscriptAndJob({
    transcriptId,
    processingJobId,
    workspaceId: plan.workspaceId,
    createdByUserId: plan.createdByUserId,
    sourceMediaKind: plan.sourceMediaKind,
    submittedWithNotes: plan.submittedWithNotes,
    mediaNormalizationPolicySnapshot: plan.mediaNormalizationPolicySnapshot,
    mediaInputKind: plan.resolvedMediaInputKind,
    uploadId: plan.prepared.uploadId,
    mediaInputKey: plan.prepared.mediaInputKey,
    mediaContentType: plan.mediaContentType,
    notesInputKey: plan.prepared.notesInputKey,
    now,
  });

  const payload: MeetingJobPayload = {
    transcriptId,
    processingJobId,
    uploadId: plan.prepared.uploadId,
  };
  await getQueue(QUEUE_NAMES.meetings).add(MEETING_JOB_NAME, payload, {
    // Retries are orchestrated at the transcript level rather than via
    // BullMQ's default exponential backoff, so disable per-job retry
    // attempts and let the worker re-enqueue explicitly after a
    // retryable failure.
    attempts: 1,
  });

  return created;
}

async function resolveContextOrRefuse(inputs: AcceptanceInputs) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new SubmissionRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new SubmissionRefusedError("access_denied");
    }
    throw error;
  }
}

export type AcceptancePresigns = {
  media: PresignedPutDescriptor;
  notes: PresignedPutDescriptor | null;
};

// Companion helper that turns a plan into the two presigned PUT
// descriptors the browser uses to upload the source media (and
// optional markdown notes) directly to transient storage. Kept next to
// `planAcceptance` so route handlers can issue a plan token and the
// matching upload surface in one pass.
export async function presignPlanUploads(args: {
  plan: AcceptancePlan;
  mediaContentLength?: number;
  notesContentLength?: number;
}): Promise<AcceptancePresigns> {
  const media = await createTransientPresignedPut({
    key: args.plan.prepared.mediaInputKey,
    contentType: args.plan.mediaContentType,
    ...(typeof args.mediaContentLength === "number" ? { contentLength: args.mediaContentLength } : {}),
  });
  const notes = args.plan.prepared.notesInputKey
    ? await createTransientPresignedPut({
        key: args.plan.prepared.notesInputKey,
        contentType: "text/markdown; charset=utf-8",
        ...(typeof args.notesContentLength === "number" ? { contentLength: args.notesContentLength } : {}),
      })
    : null;
  return { media, notes };
}

export function submissionRefusalToHttpStatus(reason: SubmissionRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "workspace_archived":
      return 409;
    case "role_not_authorized":
      return 403;
    case "media_missing":
    case "media_unsupported":
    case "media_too_large":
    case "notes_too_long":
    case "normalization_required_failed":
      return 400;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled refusal reason: ${String(exhaustive)}`);
    }
  }
}
