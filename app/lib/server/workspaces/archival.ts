import "server-only";

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { type WorkspaceRow, workspace } from "@/lib/server/db/schema";
import { type ArchivalEligibilityInputs, evaluateArchivalEligibility } from "./archival-eligibility";
import { type ArchiveSideEffect, type ArchiveSideEffectContext, listRegisteredArchiveSideEffects, runArchiveSideEffects } from "./archival-side-effects";
import { computeScheduledDeleteAt, isPastRestorationWindow, isWorkspaceActive, isWorkspaceArchived } from "./archival-state";
import { ArchivalEligibilityError, WorkspaceNotFoundError } from "./errors";

// Server-only orchestration for the `workspace-archival-lifecycle`
// transitions. The goal is to keep this file thin: pure rules live in
// `archival-state.ts`, `archival-eligibility.ts`, and
// `archival-side-effects.ts`, and this module composes them with the
// DB writes.
//
// Transitions:
//   1. `archiveWorkspace` — evaluates eligibility, stamps `archivedAt`
//      and `scheduledDeleteAt`, then runs the registered archive
//      side-effects so invitations, public shares, and edit sessions
//      (once those capabilities land) all tear down in lockstep.
//   2. `restoreWorkspace` — clears `archivedAt`/`scheduledDeleteAt` and
//      stamps `restoredAt` for downstream capabilities (public sharing)
//      that suppress previously enabled state until fresh management
//      happens after restore.
//   3. `permanentlyDeleteWorkspace` — removes the workspace row after
//      the restoration window elapses. Other workspace-scoped tables
//      cascade via their existing `ON DELETE` rules.
//   4. `sweepExpiredArchivedWorkspaces` — batch helper for the delayed
//      deletion job; finds every archived workspace whose window has
//      elapsed and permanently deletes it.

export type ArchiveWorkspaceArgs = {
  workspaceId: string;
  eligibility: Pick<ArchivalEligibilityInputs, "hasInProgressUpload" | "hasNonTerminalProcessing">;
  now?: Date;
  sideEffects?: ReadonlyArray<ArchiveSideEffect>;
};

export async function archiveWorkspace(args: ArchiveWorkspaceArgs): Promise<WorkspaceRow> {
  const db = getDb();
  const now = args.now ?? new Date();

  const existingRows = await db.select().from(workspace).where(eq(workspace.id, args.workspaceId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new WorkspaceNotFoundError();
  }

  if (isWorkspaceArchived(existing)) {
    // Idempotent: re-archiving an archived workspace returns the
    // current row without re-running side effects or resetting the
    // scheduled-delete clock.
    return existing;
  }

  const outcome = evaluateArchivalEligibility({
    workspaceType: existing.type,
    hasInProgressUpload: args.eligibility.hasInProgressUpload,
    hasNonTerminalProcessing: args.eligibility.hasNonTerminalProcessing,
  });
  if (outcome.kind === "refused") {
    throw new ArchivalEligibilityError(outcome.reason);
  }

  const scheduledDeleteAt = computeScheduledDeleteAt(now);
  const [updated] = await db
    .update(workspace)
    .set({
      archivedAt: now,
      scheduledDeleteAt,
      updatedAt: now,
    })
    .where(eq(workspace.id, args.workspaceId))
    .returning();

  const context: ArchiveSideEffectContext = {
    workspaceId: args.workspaceId,
    archivedAt: now,
  };
  await runArchiveSideEffects(context, args.sideEffects ?? listRegisteredArchiveSideEffects());

  return updated ?? existing;
}

export type RestoreWorkspaceArgs = {
  workspaceId: string;
  now?: Date;
};

export async function restoreWorkspace(args: RestoreWorkspaceArgs): Promise<WorkspaceRow> {
  const db = getDb();
  const now = args.now ?? new Date();

  const existingRows = await db.select().from(workspace).where(eq(workspace.id, args.workspaceId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new WorkspaceNotFoundError();
  }
  if (isWorkspaceActive(existing)) {
    return existing;
  }

  const [restored] = await db
    .update(workspace)
    .set({
      archivedAt: null,
      scheduledDeleteAt: null,
      restoredAt: now,
      updatedAt: now,
    })
    .where(eq(workspace.id, args.workspaceId))
    .returning();

  return restored ?? existing;
}

export type PermanentlyDeleteWorkspaceArgs = {
  workspaceId: string;
  now?: Date;
};

// Permanently delete an archived workspace once its restoration window
// has elapsed. The guard is required because the spec forbids permanent
// deletion before the 60-day window expires — the sweep job and any
// explicit operator-triggered deletion both route through this helper.
export async function permanentlyDeleteWorkspace(args: PermanentlyDeleteWorkspaceArgs): Promise<void> {
  const db = getDb();
  const now = args.now ?? new Date();
  const existingRows = await db.select().from(workspace).where(eq(workspace.id, args.workspaceId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new WorkspaceNotFoundError();
  }
  if (!isPastRestorationWindow(existing, now)) {
    // Callers should have checked the window already; refusing here is
    // a belt-and-suspenders guard that matches the spec's "only after
    // the 60-day restoration window elapses" language.
    throw new Error("Cannot permanently delete workspace before the restoration window elapses");
  }
  await db.delete(workspace).where(eq(workspace.id, args.workspaceId));
}

// Sweep every archived workspace whose restoration window has elapsed
// and permanently delete it. Intended to be called from a scheduled
// job. Returns the number of workspaces deleted so the scheduler can
// log progress or emit metrics.
export async function sweepExpiredArchivedWorkspaces(options: { now?: Date } = {}): Promise<{ deleted: number }> {
  const db = getDb();
  const now = options.now ?? new Date();

  const expired = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(and(isNotNull(workspace.archivedAt), isNotNull(workspace.scheduledDeleteAt), lte(workspace.scheduledDeleteAt, now)));

  let deleted = 0;
  for (const row of expired) {
    await permanentlyDeleteWorkspace({ workspaceId: row.id, now });
    deleted += 1;
  }
  return { deleted };
}
