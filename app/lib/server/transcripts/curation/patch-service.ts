import "server-only";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { canPatchCuration } from "./authorization";
import { PatchRefusedError } from "./errors";
import { applyCurationPatch, findTranscriptForCuration } from "./queries";
import { type CurationPatchInput, CurationValidationError, validateCurationPatch } from "./validation";

// Patch service owned by `add-transcript-curation-controls`. It is the
// single entry point for metadata curation writes (rename, tags, and
// important toggle). The order below is load-bearing for the spec:
//
//   1. resolve the workspace from the URL slug so session/remembered
//      state cannot override the explicit route context
//   2. refuse archived workspaces with `workspace_archived` so the UI
//      can render the active-workspace lockout
//   3. enforce the workspace role gate (`read_only` is refused)
//   4. validate and normalize the patch body (throws
//      `invalid_patch` with a specific validation reason)
//   5. look up the transcript scoped to this workspace; a miss maps to
//      `not_found` so cross-workspace probes cannot enumerate records
//   6. apply the write and return the updated transcript row
//
// The route handler translates `PatchRefusedError.reason` through
// `patchRefusalToHttpStatus`; the UI uses the same `reason` to show a
// targeted message.

export type PatchCurationInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  patch: CurationPatchInput;
  now?: Date;
};

export async function patchTranscriptCuration(inputs: PatchCurationInputs): Promise<TranscriptRow> {
  const context = await resolveWorkspaceOrRefuse(inputs);

  if (!isWorkspaceActive(context.workspace)) {
    throw new PatchRefusedError("workspace_archived");
  }

  if (!canPatchCuration(context.role)) {
    throw new PatchRefusedError("forbidden");
  }

  const values = validateOrRefuse(inputs.patch);

  const existing = await findTranscriptForCuration({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
  });
  if (!existing) {
    throw new PatchRefusedError("not_found");
  }

  const now = inputs.now ?? new Date();
  const updated = await applyCurationPatch({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
    values,
    now,
  });
  if (!updated) {
    // Concurrent delete between the existence check and the update.
    // Hide the race as the same `not_found` refusal the caller would
    // have seen if the delete had landed first.
    throw new PatchRefusedError("not_found");
  }
  return updated;
}

async function resolveWorkspaceOrRefuse(inputs: { workspaceSlug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new PatchRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new PatchRefusedError("access_denied");
    }
    throw error;
  }
}

function validateOrRefuse(patch: CurationPatchInput) {
  try {
    return validateCurationPatch(patch);
  } catch (error) {
    if (error instanceof CurationValidationError) {
      throw new PatchRefusedError("invalid_patch", error.reason);
    }
    throw error;
  }
}
