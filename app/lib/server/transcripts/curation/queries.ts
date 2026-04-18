import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { type TranscriptRow, transcript } from "@/lib/server/db/schema";

import type { CurationPatchValues } from "./validation";

// Drizzle-backed writes scoped to one workspace. The service layer
// (`patch-service.ts`, `delete-service.ts`) resolves the workspace
// context, checks role, and honors the active-workspace gate before
// calling these helpers. These helpers trust the workspace id they are
// handed and enforce the `(id, workspace_id)` predicate on every write
// so cross-workspace mutations cannot leak even if a future caller
// forgets the scope check.

export type FindForCurationArgs = {
  transcriptId: string;
  workspaceId: string;
};

// Minimal projection used by delete authorization. The creator FK is
// pulled so the service can enforce the member/creator rule without
// loading the full transcript row. Returns `null` when the transcript
// does not exist or belongs to another workspace so the service can
// collapse both cases into the same `not_found` refusal.
export type CurationAuthorizationView = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
};

export async function findTranscriptForCuration(args: FindForCurationArgs): Promise<CurationAuthorizationView | null> {
  const rows = await getDb()
    .select({
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      createdByUserId: transcript.createdByUserId,
    })
    .from(transcript)
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export type ApplyCurationPatchArgs = {
  transcriptId: string;
  workspaceId: string;
  values: CurationPatchValues;
  now: Date;
};

// Apply a validated curation patch. Only the columns present in
// `values` are written; the `updatedAt` timestamp is always bumped so
// the "recently updated" library sort reflects the curation change.
// Returns the updated row or `null` when the `(id, workspace)` pair
// no longer resolves (transcript was deleted or moved between the
// caller's read and write).
export async function applyCurationPatch(args: ApplyCurationPatchArgs): Promise<TranscriptRow | null> {
  const updateSet = buildCurationUpdateSet(args.values, args.now);

  const rows = await getDb()
    .update(transcript)
    .set(updateSet)
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .returning();
  return rows[0] ?? null;
}

// Build the Drizzle `set(...)` payload for a curation patch. Kept as a
// dedicated helper so the "tags and tagSortKey are written together"
// invariant is explicit. When the caller passes a `tags` value, the
// derived sort key travels with it; callers cannot set one without the
// other by construction.
export function buildCurationUpdateSet(values: CurationPatchValues, now: Date): Record<string, unknown> {
  const updateSet: Record<string, unknown> = { updatedAt: now };
  if (Object.hasOwn(values, "customTitle")) {
    updateSet.customTitle = values.customTitle;
  }
  if (values.tags !== undefined) {
    updateSet.tags = values.tags;
    updateSet.tagSortKey = values.tagSortKey ?? null;
  }
  if (values.isImportant !== undefined) {
    updateSet.isImportant = values.isImportant;
  }
  return updateSet;
}

export type DeleteTranscriptArgs = {
  transcriptId: string;
  workspaceId: string;
};

// Permanently remove a transcript record from the workspace. The
// `(id, workspace)` predicate guarantees cross-workspace requests
// never delete records they do not own even if a caller bypasses the
// service layer. Returns true when a row was deleted, false when no
// matching row existed.
export async function deleteTranscriptInWorkspace(args: DeleteTranscriptArgs): Promise<boolean> {
  const rows = await getDb()
    .delete(transcript)
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .returning({ id: transcript.id });
  return rows.length > 0;
}
