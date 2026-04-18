import "server-only";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { DetailReadRefusedError } from "./errors";
import { findTranscriptDetailForWorkspace } from "./queries";

// Detail read service owned by `add-transcript-management`. It mirrors
// the library's active-workspace + current-workspace scoping:
//   1. resolve the current workspace from the URL slug
//   2. refuse archived workspaces with the `workspace_archived` reason
//   3. collapse both "missing transcript" and "transcript belongs to a
//      different workspace" into `not_found` so the surface cannot be
//      used to probe records in other workspaces

export type DetailReadInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
};

export async function readTranscriptDetail(inputs: DetailReadInputs): Promise<TranscriptRow> {
  const context = await resolveContextOrRefuse(inputs);

  if (!isWorkspaceActive(context.workspace)) {
    throw new DetailReadRefusedError("workspace_archived");
  }

  const row = await findTranscriptDetailForWorkspace({ transcriptId: inputs.transcriptId, workspaceId: context.workspace.id });
  if (!row) {
    throw new DetailReadRefusedError("not_found");
  }
  return row;
}

async function resolveContextOrRefuse(inputs: DetailReadInputs) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new DetailReadRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new DetailReadRefusedError("access_denied");
    }
    throw error;
  }
}
