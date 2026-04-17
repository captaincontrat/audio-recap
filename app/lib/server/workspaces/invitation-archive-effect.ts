import "server-only";

import type { ArchiveSideEffect } from "./archival-side-effects";
import { registerArchiveSideEffect, unregisterArchiveSideEffect } from "./archival-side-effects";
import { invalidateWorkspaceInvitationsOnArchive } from "./invitations";

// The `workspace-archival-lifecycle` spec requires archive to
// invalidate pending invitations immediately. That policy lives with
// the archival capability, but the concrete side effect that drops
// token hashes and flips pending rows to `superseded` is owned here by
// the invitation capability. Registration is idempotent so module
// reloads (Next.js dev, tests) don't stack duplicate listeners.

export const INVITATION_ARCHIVE_EFFECT_ID = "invitations.invalidate";

// Archive-time teardown: flip every pending invitation for the
// archived workspace to `superseded` and drop its token hash. The
// same rule also applies to acceptance gating through
// `assertInvitationAcceptanceAllowed` in `archival-gates.ts`, so even
// an invitation that somehow slips past this teardown still refuses
// acceptance because the workspace itself is archived.
export const invitationArchiveSideEffect: ArchiveSideEffect = {
  id: INVITATION_ARCHIVE_EFFECT_ID,
  run: async (context) => {
    await invalidateWorkspaceInvitationsOnArchive({
      workspaceId: context.workspaceId,
      now: context.archivedAt,
    });
  },
};

export function registerInvitationArchiveSideEffect(): void {
  registerArchiveSideEffect(invitationArchiveSideEffect);
}

export function unregisterInvitationArchiveSideEffect(): void {
  unregisterArchiveSideEffect(INVITATION_ARCHIVE_EFFECT_ID);
}
