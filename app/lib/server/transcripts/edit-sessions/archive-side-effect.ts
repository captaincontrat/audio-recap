import "server-only";

import type { ArchiveSideEffect } from "@/lib/server/workspaces/archival-side-effects";
import { registerArchiveSideEffect, unregisterArchiveSideEffect } from "@/lib/server/workspaces/archival-side-effects";

import { releaseAllLocksForWorkspace } from "./locks";

// The `workspace-archival-lifecycle` spec requires archive to release
// every active markdown edit lock in the workspace immediately and to
// cancel any pending same-tab resume window. This side effect is the
// edit-session capability's contribution to that cross-cutting
// transition; the archive service iterates registered effects and
// dispatches them without knowing Redis lock state.
//
// The runtime check for archived workspaces still lives with
// `assertAutosaveAllowed` in `archival-gates.ts`, so even if this
// side-effect were skipped in some future bootstrap path, an
// archived-workspace autosave would still be refused by the gate.

export const EDIT_SESSIONS_ARCHIVE_EFFECT_ID = "edit-sessions.release-and-cancel-resume";

// Archive-time teardown: force-release every active transcript edit
// lock whose owning workspace is being archived. The lock records
// themselves carry a short TTL as a safety net, but running the
// release synchronously also drops the workspace-scoped index set so
// we do not leave stale bookkeeping around after the TTL elapses.
export const editSessionsArchiveSideEffect: ArchiveSideEffect = {
  id: EDIT_SESSIONS_ARCHIVE_EFFECT_ID,
  run: async (context) => {
    await releaseAllLocksForWorkspace(context.workspaceId);
  },
};

export function registerEditSessionsArchiveSideEffect(): void {
  registerArchiveSideEffect(editSessionsArchiveSideEffect);
}

export function unregisterEditSessionsArchiveSideEffect(): void {
  unregisterArchiveSideEffect(EDIT_SESSIONS_ARCHIVE_EFFECT_ID);
}
