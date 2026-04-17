import type { TranscriptStatus } from "@/lib/server/db/schema";

// The visible lifecycle stages defined by the spec. Exposed as an
// ordered list so UI code and worker glue agree on progress ordering
// without reopening the decision.
export const PROGRESS_STATUSES: readonly TranscriptStatus[] = [
  "queued",
  "preprocessing",
  "transcribing",
  "generating_recap",
  "generating_title",
  "finalizing",
] as const;

export const TERMINAL_STATUSES: readonly TranscriptStatus[] = ["completed", "failed"] as const;

export function isTerminalStatus(status: TranscriptStatus): boolean {
  return status === "completed" || status === "failed";
}

export function isProgressStatus(status: TranscriptStatus): boolean {
  return PROGRESS_STATUSES.includes(status);
}

// Map the shared-library pipeline stage into the transcript status
// the worker should publish on entering that stage. Kept in sync with
// the `MeetingPipelineStage` union exported by `libs/audio-recap`.
export function statusForPipelineStage(stage: "prepare-audio" | "transcribe" | "build-transcript" | "generate-summary"): TranscriptStatus {
  switch (stage) {
    case "prepare-audio":
      return "preprocessing";
    case "transcribe":
      return "transcribing";
    case "build-transcript":
      // The shared pipeline folds transcript artifact construction
      // into the transcription stage for the purposes of user-visible
      // progress — the transcribing stage remains the canonical
      // external status until recap generation begins.
      return "transcribing";
    case "generate-summary":
      return "generating_recap";
    default: {
      const exhaustive: never = stage;
      throw new Error(`Unhandled pipeline stage: ${String(exhaustive)}`);
    }
  }
}
