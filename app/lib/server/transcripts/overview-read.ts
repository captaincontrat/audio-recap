import "server-only";

import type { WorkspaceRole } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { OverviewReadRefusedError } from "./errors";
import type { TranscriptLibraryItem } from "./projections";
import { listActiveWorkTranscriptsForWorkspace, listLibraryHighlightsForWorkspace } from "./queries";

// Server-side composition for the workspace overview surface owned by
// `add-workspace-overview-and-default-landing`. The overview MUST:
//   1. resolve the current workspace from the explicit URL slug (the
//      workspace-foundation contract owns the slug-is-authoritative
//      rule)
//   2. inherit the private-transcript-library access model — refuse
//      inaccessible workspaces with `not_found` so cross-workspace
//      probing can't enumerate slugs, and refuse archived workspaces
//      with `workspace_archived` so the page can render the inactive
//      notice
//   3. surface two narrow projections (active-work + library-highlights)
//      built from the workspace transcript table — never invent a new
//      aggregate read contract
//
// The role is returned alongside the projections so the page can
// gate the start-upload CTA without re-resolving the workspace
// context (`canRoleCreateTranscripts` runs in the page).

// Caps the size of each overview group. Tuned to fit a card-sized
// summary without becoming a second library list. The library link
// in the overview footer routes the user to the full surface when
// they need more rows.
export const OVERVIEW_GROUP_LIMIT = 6;

export type OverviewReadInputs = {
  workspaceSlug: string;
  userId: string;
  // Allow tests / callers to override the per-group cap when they
  // need more deterministic seeding shapes. Defaults to
  // `OVERVIEW_GROUP_LIMIT` so production callers never have to think
  // about the cap.
  groupLimit?: number;
};

export type OverviewReadResult = {
  role: WorkspaceRole;
  activeWork: TranscriptLibraryItem[];
  libraryHighlights: TranscriptLibraryItem[];
};

export async function readWorkspaceOverview(inputs: OverviewReadInputs): Promise<OverviewReadResult> {
  const context = await resolveContextOrRefuse({ slug: inputs.workspaceSlug, userId: inputs.userId });

  if (!isWorkspaceActive(context.workspace)) {
    throw new OverviewReadRefusedError("workspace_archived");
  }

  const limit = inputs.groupLimit ?? OVERVIEW_GROUP_LIMIT;
  // Both reads are independent — fetch them in parallel so the
  // overview's render path stays close to a single round-trip.
  const [activeWork, libraryHighlights] = await Promise.all([
    listActiveWorkTranscriptsForWorkspace({ workspaceId: context.workspace.id, limit }),
    listLibraryHighlightsForWorkspace({ workspaceId: context.workspace.id, limit }),
  ]);

  return {
    role: context.role,
    activeWork,
    libraryHighlights,
  };
}

async function resolveContextOrRefuse(args: { slug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug(args);
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new OverviewReadRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new OverviewReadRefusedError("access_denied");
    }
    throw error;
  }
}
