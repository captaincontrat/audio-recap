import { describe, expect, test } from "vitest";

import { type ArchivalEligibilityInputs, evaluateArchivalEligibility } from "@/lib/server/workspaces/archival-eligibility";

function team(partial: Partial<ArchivalEligibilityInputs> = {}): ArchivalEligibilityInputs {
  return {
    workspaceType: "team",
    hasInProgressUpload: false,
    hasNonTerminalProcessing: false,
    ...partial,
  };
}

describe("evaluateArchivalEligibility", () => {
  test("a quiet team workspace is eligible to archive", () => {
    expect(evaluateArchivalEligibility(team())).toEqual({ kind: "eligible" });
  });

  test("refuses personal workspaces regardless of activity signals", () => {
    const outcome = evaluateArchivalEligibility({
      workspaceType: "personal",
      hasInProgressUpload: false,
      hasNonTerminalProcessing: false,
    });
    expect(outcome).toEqual({ kind: "refused", reason: "personal_workspace" });
  });

  test("refuses archive while an upload is still in progress", () => {
    const outcome = evaluateArchivalEligibility(team({ hasInProgressUpload: true }));
    expect(outcome).toEqual({ kind: "refused", reason: "upload_in_progress" });
  });

  test("refuses archive while non-terminal audio processing is still in progress", () => {
    const outcome = evaluateArchivalEligibility(team({ hasNonTerminalProcessing: true }));
    expect(outcome).toEqual({ kind: "refused", reason: "processing_in_progress" });
  });

  test("prefers the personal-workspace reason over processing signals when both apply", () => {
    const outcome = evaluateArchivalEligibility({
      workspaceType: "personal",
      hasInProgressUpload: true,
      hasNonTerminalProcessing: true,
    });
    expect(outcome).toEqual({ kind: "refused", reason: "personal_workspace" });
  });

  test("prefers the upload reason over the processing reason when both are active", () => {
    const outcome = evaluateArchivalEligibility(team({ hasInProgressUpload: true, hasNonTerminalProcessing: true }));
    expect(outcome).toEqual({ kind: "refused", reason: "upload_in_progress" });
  });
});
