import "server-only";

import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { evaluateDeleteAuthorization } from "./authorization";
import { DeleteRefusedError } from "./errors";
import { deleteTranscriptInWorkspace, findTranscriptForCuration } from "./queries";

// Delete service owned by `add-transcript-curation-controls`. Mirrors
// the patch service's order of checks so refusal telemetry stays
// comparable between the two surfaces:
//
//   1. resolve the workspace from the URL slug (explicit-context rule)
//   2. refuse archived workspaces with `workspace_archived`
//   3. locate the transcript scoped to this workspace (cross-workspace
//      records collapse to `not_found`)
//   4. evaluate the role + creator-attribution rules:
//        - admin                      -> always allowed
//        - member + creator attribution matches -> allowed
//        - member + creator cleared              -> refused (admin-only)
//        - member + different creator            -> refused
//        - read_only                             -> refused
//   5. perform the permanent delete and report "done"; a concurrent
//      delete between steps 3 and 5 surfaces as `not_found`.

export type DeleteCurationInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
};

export type DeleteCurationResult = {
  transcriptId: string;
  workspaceId: string;
};

export async function deleteTranscript(inputs: DeleteCurationInputs): Promise<DeleteCurationResult> {
  const context = await resolveWorkspaceOrRefuse(inputs);

  if (!isWorkspaceActive(context.workspace)) {
    throw new DeleteRefusedError("workspace_archived");
  }

  const record = await findTranscriptForCuration({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
  });
  if (!record) {
    throw new DeleteRefusedError("not_found");
  }

  const decision = evaluateDeleteAuthorization({
    role: context.role,
    requestingUserId: inputs.userId,
    transcriptCreatedByUserId: record.createdByUserId,
  });
  if (decision.kind === "refuse") {
    throw new DeleteRefusedError("forbidden", decision.reason);
  }

  const deleted = await deleteTranscriptInWorkspace({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
  });
  if (!deleted) {
    // Concurrent delete between the existence check and the destructive
    // write: report the same not-found refusal the caller would have
    // seen if the delete had landed first.
    throw new DeleteRefusedError("not_found");
  }
  return { transcriptId: inputs.transcriptId, workspaceId: context.workspace.id };
}

async function resolveWorkspaceOrRefuse(inputs: { workspaceSlug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new DeleteRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new DeleteRefusedError("access_denied");
    }
    throw error;
  }
}
