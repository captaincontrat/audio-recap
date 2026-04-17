import type { WorkspaceType } from "@/lib/server/db/schema";
import type { ArchivalEligibilityRefusalReason } from "./errors";

// Pure archival eligibility check shared between the admin archive
// action and the orchestration service that performs the DB write.
// Kept pure so every refusal rule is covered by unit tests without
// touching the DB or any external queue.
//
// The inputs describe the workspace plus the two activity signals that
// the spec forbids archival from racing with: in-progress upload
// activity and non-terminal audio-processing work. Downstream callers
// are expected to compute those booleans themselves (e.g. by querying
// the upload and processing-job tables) and hand them in here so the
// rule has a single source of truth.

export type ArchivalEligibilityInputs = {
  workspaceType: WorkspaceType;
  hasInProgressUpload: boolean;
  hasNonTerminalProcessing: boolean;
};

export type ArchivalEligibilityOutcome = { kind: "eligible" } | { kind: "refused"; reason: ArchivalEligibilityRefusalReason };

// Evaluate archival eligibility. Refusal ordering is deterministic so
// tests and UI both observe the same precedence:
//   1. personal workspaces are never eligible
//   2. in-progress upload activity blocks archive
//   3. non-terminal audio-processing work blocks archive
//   4. otherwise the workspace is eligible
export function evaluateArchivalEligibility(inputs: ArchivalEligibilityInputs): ArchivalEligibilityOutcome {
  if (inputs.workspaceType === "personal") {
    return { kind: "refused", reason: "personal_workspace" };
  }
  if (inputs.hasInProgressUpload) {
    return { kind: "refused", reason: "upload_in_progress" };
  }
  if (inputs.hasNonTerminalProcessing) {
    return { kind: "refused", reason: "processing_in_progress" };
  }
  return { kind: "eligible" };
}
