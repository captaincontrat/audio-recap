import "server-only";

import { randomUUID } from "node:crypto";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { canManagePublicSharing } from "./authorization";
import { ShareManagementRefusedError } from "./errors";
import { applyShareUpdate, findTranscriptForShare, type ShareAuthorizationView } from "./queries";

// Share-management service owned by `add-public-transcript-sharing`.
// Mirrors the curation services' order of checks so refusal
// telemetry stays comparable across transcript-write surfaces:
//
//   1. resolve the workspace from the URL slug (explicit-context
//      rule) — cross-workspace or missing workspace collapses to
//      `not_found`, a non-member caller receives `access_denied`.
//   2. refuse archived workspaces with `workspace_archived` so the
//      UI can render the active-workspace lockout.
//   3. enforce the workspace-role gate (`read_only` is refused).
//   4. look up the transcript scoped to this workspace; a miss
//      maps to `not_found` so cross-workspace probes cannot
//      enumerate records.
//   5. evaluate action-specific preconditions:
//        - enable: status must be `completed` (stable canonical
//          markdown precondition from the spec).
//        - disable: no status precondition; the action is
//          idempotent, so disabling an already-disabled share
//          still succeeds and bumps `shareUpdatedAt`.
//        - rotate: share must currently be enabled; rotating while
//          off is refused with `share_not_enabled` so the UI can
//          surface the mismatch explicitly.
//   6. apply the write and return the updated transcript row.
//
// Enable and rotate generate fresh UUIDs via `node:crypto`'s
// `randomUUID`; that matches the rest of the codebase (auth,
// membership, workspace provisioning) and keeps entropy out of
// application code.

export type ShareManagementInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  now?: Date;
};

// Enable public sharing for a completed transcript. If a stable
// `publicShareId` was minted on a previous enable, we reuse it so
// the workspace retains a consistent public handle across
// enable/disable toggles. The `shareSecretId` is always minted
// fresh because every enable must invalidate any dangling link
// that could still be cached somewhere.
export async function enablePublicSharing(inputs: ShareManagementInputs): Promise<TranscriptRow> {
  const { context, record } = await loadManagementContext(inputs);
  if (record.status !== "completed") {
    throw new ShareManagementRefusedError("transcript_not_completed");
  }
  const now = inputs.now ?? new Date();
  const publicShareId = record.publicShareId ?? randomUUID();
  const shareSecretId = randomUUID();
  const updated = await applyShareUpdate({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
    values: { isPubliclyShared: true, publicShareId, shareSecretId },
    now,
  });
  if (!updated) {
    // Concurrent delete between the existence check and the update.
    throw new ShareManagementRefusedError("not_found");
  }
  return updated;
}

// Disable public sharing. We intentionally keep the existing
// `publicShareId` on the row so a later enable can reuse it as the
// stable public handle, but we clear `shareSecretId` so no in-
// flight cached URL could accidentally resolve if the share is
// flipped back on without a fresh rotate. The service is
// idempotent: disabling a record that was never enabled succeeds
// without surfacing a refusal so the management UI does not need
// to special-case "already off" state.
export async function disablePublicSharing(inputs: ShareManagementInputs): Promise<TranscriptRow> {
  const { context, record } = await loadManagementContext(inputs);
  const now = inputs.now ?? new Date();
  const updated = await applyShareUpdate({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
    values: { isPubliclyShared: false, publicShareId: record.publicShareId, shareSecretId: null },
    now,
  });
  if (!updated) {
    throw new ShareManagementRefusedError("not_found");
  }
  return updated;
}

// Rotate the active share secret. Keeps `publicShareId` stable so
// the workspace handle persists, but replaces the secret UUID with
// a fresh value so the previous link fails immediately per the
// spec: "keep publicShareId; replace shareSecretId with a fresh
// UUID; invalidate the prior link immediately".
export async function rotatePublicShareSecret(inputs: ShareManagementInputs): Promise<TranscriptRow> {
  const { context, record } = await loadManagementContext(inputs);
  if (!record.isPubliclyShared) {
    throw new ShareManagementRefusedError("share_not_enabled");
  }
  // Defensive: a previously-enabled share must already carry a
  // `publicShareId`. If it doesn't, the row is in an inconsistent
  // state the service should refuse instead of silently minting a
  // fresh handle — treating this case as `share_not_enabled`
  // keeps the vocabulary small and routes the UI to "re-enable"
  // rather than "rotate".
  if (record.publicShareId === null) {
    throw new ShareManagementRefusedError("share_not_enabled");
  }
  const now = inputs.now ?? new Date();
  const updated = await applyShareUpdate({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
    values: { isPubliclyShared: true, publicShareId: record.publicShareId, shareSecretId: randomUUID() },
    now,
  });
  if (!updated) {
    throw new ShareManagementRefusedError("not_found");
  }
  return updated;
}

type ManagementContext = {
  context: Awaited<ReturnType<typeof resolveWorkspaceContextFromSlug>>;
  record: ShareAuthorizationView;
};

async function loadManagementContext(inputs: ShareManagementInputs): Promise<ManagementContext> {
  const context = await resolveWorkspaceOrRefuse(inputs);
  if (!isWorkspaceActive(context.workspace)) {
    throw new ShareManagementRefusedError("workspace_archived");
  }
  if (!canManagePublicSharing(context.role)) {
    throw new ShareManagementRefusedError("forbidden");
  }
  const record = await findTranscriptForShare({
    transcriptId: inputs.transcriptId,
    workspaceId: context.workspace.id,
  });
  if (!record) {
    throw new ShareManagementRefusedError("not_found");
  }
  return { context, record };
}

async function resolveWorkspaceOrRefuse(inputs: { workspaceSlug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new ShareManagementRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new ShareManagementRefusedError("access_denied");
    }
    throw error;
  }
}
