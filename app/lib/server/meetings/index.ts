// Barrel re-exports for the meeting-import-processing capability.
// Upstream route handlers, worker glue, and tests should import
// through this module so the capability can evolve its file layout
// without breaking downstream call sites.

export {
  type AcceptanceInputs,
  type AcceptancePlan,
  type AcceptancePresigns,
  type AcceptanceResult,
  type FinalizeAcceptanceInputs,
  finalizeAcceptance,
  MEETING_JOB_NAME,
  type MeetingJobPayload,
  planAcceptance,
  type PreparedUpload,
  presignPlanUploads,
  submissionRefusalToHttpStatus,
} from "./acceptance";

export {
  AcceptancePlanTokenError,
  type AcceptancePlanVerificationError,
  signAcceptancePlan,
  type VerifiedAcceptancePlan,
  verifyAcceptancePlan,
} from "./plan-token";

export {
  StatusReadRefusedError,
  type StatusReadRefusalReason,
  SubmissionRefusedError,
  type SubmissionRefusalReason,
} from "./errors";

export { generateProcessingJobId, generateTranscriptId, generateUploadId } from "./ids";

export {
  DEFAULT_MEDIA_NORMALIZATION_POLICY,
  getMediaNormalizationPolicy,
  MEDIA_NORMALIZATION_POLICY_KEY,
  setMediaNormalizationPolicy,
} from "./normalization-policy";

export {
  classifyRetry,
  DEFAULT_MAX_ATTEMPTS,
  defaultFailureSummary,
  type FailureKind,
  QUEUE_RETRY_DELAY_MS,
  type RetryDecision,
  type RetryDecisionInputs,
} from "./retry-policy";

export { isProgressStatus, isTerminalStatus, PROGRESS_STATUSES, statusForPipelineStage, TERMINAL_STATUSES } from "./stage-plan";

export {
  readTranscriptStatus,
  type StatusReadInputs,
  statusReadRefusalToHttpStatus,
  toStatusView,
  type TranscriptStatusView,
} from "./status-read";

export {
  type ListUploadManagerRehydrationItemsArgs,
  listUploadManagerRehydrationItems,
  toUploadManagerRehydrationItem,
  type UploadManagerRehydrationItem,
  type UploadManagerRehydrationRow,
} from "./upload-manager-rehydration";

export {
  type BrowserNormalizationOutcome,
  canRoleCreateTranscripts,
  evaluateSubmission,
  SUBMISSION_MAX_MEDIA_BYTES,
  SUBMISSION_MAX_NOTES_BYTES,
  type SubmissionDecision,
  type SubmissionInputs,
} from "./submission-decisions";

export {
  clearTransientReferences,
  createTranscriptAndJob,
  type CreatedSubmission,
  type CreateTranscriptAndJobInputs,
  findProcessingJobByTranscriptId,
  findTranscriptById,
  findTranscriptForWorkspace,
  markCompleted,
  markFailed,
  persistFailureSummary,
  persistSuccessfulContent,
  type PersistSuccessArgs,
  recordJobAttemptStart,
  recordRetryingFailure,
  setSubmissionStatus,
} from "./transcripts";
