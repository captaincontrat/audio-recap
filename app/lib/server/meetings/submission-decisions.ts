import type { MediaNormalizationPolicyValue, TranscriptSourceMediaKind, WorkspaceRole } from "@/lib/server/db/schema";
import type { SubmissionRefusalReason } from "./errors";

// Pure decision logic for the submission-acceptance flow. DB and
// storage helpers compose these predicates so the product rules have a
// single source of truth that can be unit-tested without touching
// Postgres, Redis, or S3.

// Upload ceiling matches the OpenAI transcription cap that the shared
// library enforces at the API layer. The web submission surface
// rejects overlarge uploads early so the transient storage never
// accepts work the worker would reject anyway.
export const SUBMISSION_MAX_MEDIA_BYTES = 500 * 1024 * 1024;

// Notes are bounded so that pre-queue validation can reject pathological
// payloads without taking the worker off-line. The limit is generous
// enough to cover structured agendas and multi-page notes while still
// giving the web request a short rejection path.
export const SUBMISSION_MAX_NOTES_BYTES = 64 * 1024;

// Roles the spec allows to submit new transcripts. `read_only` stays
// explicitly excluded so the decision module cannot silently widen
// the authorization contract.
const TRANSCRIPT_CREATION_ROLES: ReadonlySet<WorkspaceRole> = new Set<WorkspaceRole>(["member", "admin"]);

export function canRoleCreateTranscripts(role: WorkspaceRole): boolean {
  return TRANSCRIPT_CREATION_ROLES.has(role);
}

// Shape of the normalization result the web surface reports back to the
// acceptance flow after trying browser-side MP3 conversion.
export type BrowserNormalizationOutcome = { kind: "succeeded"; inputKind: "mp3-derivative" } | { kind: "unavailable" } | { kind: "failed" };

export type SubmissionInputs = {
  role: WorkspaceRole;
  workspaceActive: boolean;
  mediaKind: TranscriptSourceMediaKind | null;
  mediaBytes: number;
  mediaContentType: string | null;
  notesBytes: number;
  normalizationPolicy: MediaNormalizationPolicyValue;
  normalization: BrowserNormalizationOutcome;
};

export type SubmissionDecision = { kind: "accepted"; inputKind: "original" | "mp3-derivative" } | { kind: "refused"; reason: SubmissionRefusalReason };

// Decide whether a submission can be accepted. Refusal ordering is
// deterministic so both tests and the UI observe the same precedence:
//   1. workspace archived
//   2. role cannot submit transcripts
//   3. media input missing
//   4. media input too large
//   5. unsupported media format
//   6. notes exceed the allowed length
//   7. normalization required but did not complete
export function evaluateSubmission(inputs: SubmissionInputs): SubmissionDecision {
  if (!inputs.workspaceActive) {
    return { kind: "refused", reason: "workspace_archived" };
  }

  if (!canRoleCreateTranscripts(inputs.role)) {
    return { kind: "refused", reason: "role_not_authorized" };
  }

  if (inputs.mediaKind === null) {
    return { kind: "refused", reason: "media_missing" };
  }

  if (inputs.mediaBytes <= 0) {
    return { kind: "refused", reason: "media_missing" };
  }

  if (inputs.mediaBytes > SUBMISSION_MAX_MEDIA_BYTES) {
    return { kind: "refused", reason: "media_too_large" };
  }

  if (!isSupportedMediaContentType(inputs.mediaKind, inputs.mediaContentType, inputs.normalization)) {
    return { kind: "refused", reason: "media_unsupported" };
  }

  if (inputs.notesBytes > SUBMISSION_MAX_NOTES_BYTES) {
    return { kind: "refused", reason: "notes_too_long" };
  }

  const resolvedInputKind = resolveInputKind(inputs.normalizationPolicy, inputs.normalization);
  if (resolvedInputKind === null) {
    return { kind: "refused", reason: "normalization_required_failed" };
  }

  return { kind: "accepted", inputKind: resolvedInputKind };
}

// Resolve which pipeline input shape the job should use given the
// current normalization policy and the browser-side normalization
// outcome. `required` mode rejects failed or unavailable normalization;
// `optional` mode falls back to the original validated upload.
function resolveInputKind(policy: MediaNormalizationPolicyValue, outcome: BrowserNormalizationOutcome): "original" | "mp3-derivative" | null {
  switch (outcome.kind) {
    case "succeeded":
      return "mp3-derivative";
    case "unavailable":
    case "failed":
      return policy === "required" ? null : "original";
    default: {
      const exhaustive: never = outcome;
      throw new Error(`Unhandled normalization outcome: ${String(exhaustive)}`);
    }
  }
}

// Supported content types mirror the shared pipeline's ffmpeg intake.
// Audio submissions accept common meeting-audio formats; video
// submissions accept MP4/QuickTime shapes that the worker can
// downmix before transcription. The browser-normalized path always
// produces MP3, so we accept `audio/mpeg` regardless of the original
// kind when normalization succeeded.
const AUDIO_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aac",
]);

const VIDEO_CONTENT_TYPES: ReadonlySet<string> = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/mpeg"]);

function isSupportedMediaContentType(mediaKind: TranscriptSourceMediaKind, contentType: string | null, outcome: BrowserNormalizationOutcome): boolean {
  if (outcome.kind === "succeeded") {
    return AUDIO_CONTENT_TYPES.has("audio/mpeg");
  }
  if (!contentType) {
    return false;
  }
  // Strip any content-type parameters (e.g. "audio/mpeg; charset=utf-8")
  // before comparing against the supported set. `indexOf` sidesteps the
  // needless optional-branch noise from `split(";")[0]` and keeps the
  // fallback path (no parameter suffix) in the same expression.
  const lower = contentType.toLowerCase();
  const semiIndex = lower.indexOf(";");
  const normalized = (semiIndex === -1 ? lower : lower.slice(0, semiIndex)).trim();
  if (mediaKind === "audio") {
    return AUDIO_CONTENT_TYPES.has(normalized);
  }
  return VIDEO_CONTENT_TYPES.has(normalized);
}
