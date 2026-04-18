import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { type TranscriptRow, transcript, workspace } from "@/lib/server/db/schema";

// Drizzle-backed reads and writes for share-state management. The
// service layer (`service.ts`) resolves the workspace, checks the
// role, and evaluates the completed-status precondition before
// calling these helpers. The queries trust the workspace id they
// receive and always re-scope writes to the `(id, workspace_id)`
// pair so a caller that forgets to scope cannot leak mutations
// across workspaces.

export type FindTranscriptForShareArgs = {
  transcriptId: string;
  workspaceId: string;
};

// Minimal projection the service needs to evaluate share-management
// preconditions: current status, whether a stable `publicShareId`
// has already been assigned, the active secret, and the last
// share-management timestamp. Returns null when the transcript
// does not live in the given workspace so the service collapses
// cross-workspace lookups to the same not-found refusal.
export type ShareAuthorizationView = {
  id: string;
  workspaceId: string;
  status: TranscriptRow["status"];
  isPubliclyShared: boolean;
  publicShareId: string | null;
  shareSecretId: string | null;
  shareUpdatedAt: Date | null;
};

export async function findTranscriptForShare(args: FindTranscriptForShareArgs): Promise<ShareAuthorizationView | null> {
  const rows = await getDb()
    .select({
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      status: transcript.status,
      isPubliclyShared: transcript.isPubliclyShared,
      publicShareId: transcript.publicShareId,
      shareSecretId: transcript.shareSecretId,
      shareUpdatedAt: transcript.shareUpdatedAt,
    })
    .from(transcript)
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

// Minimal projection the public `/share/:id/:secret` resolver
// needs. It is looked up by the stable `publicShareId` alone — the
// service then cross-checks the URL secret against `shareSecretId`
// — and also exposes the workspace archival timestamps so the
// resolver can enforce the active-workspace and post-restore
// suppression rules without a second query. Returns null when no
// transcript has that public share handle. The `workspaceId` is
// intentionally _not_ surfaced to the caller beyond internal use
// (the public projection that eventually reaches the browser never
// exposes it), but it travels through this view so the resolver
// can keep logs rich while the rendered response stays minimal.
export type PublicShareLookupView = {
  id: string;
  workspaceId: string;
  status: TranscriptRow["status"];
  title: string;
  customTitle: string | null;
  recapMarkdown: string;
  transcriptMarkdown: string;
  isPubliclyShared: boolean;
  publicShareId: string;
  shareSecretId: string | null;
  shareUpdatedAt: Date | null;
  workspaceArchivedAt: Date | null;
  workspaceScheduledDeleteAt: Date | null;
  workspaceRestoredAt: Date | null;
};

export type FindTranscriptByPublicShareIdArgs = {
  publicShareId: string;
};

export async function findTranscriptByPublicShareId(args: FindTranscriptByPublicShareIdArgs): Promise<PublicShareLookupView | null> {
  const rows = await getDb()
    .select({
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      status: transcript.status,
      title: transcript.title,
      customTitle: transcript.customTitle,
      recapMarkdown: transcript.recapMarkdown,
      transcriptMarkdown: transcript.transcriptMarkdown,
      isPubliclyShared: transcript.isPubliclyShared,
      publicShareId: transcript.publicShareId,
      shareSecretId: transcript.shareSecretId,
      shareUpdatedAt: transcript.shareUpdatedAt,
      workspaceArchivedAt: workspace.archivedAt,
      workspaceScheduledDeleteAt: workspace.scheduledDeleteAt,
      workspaceRestoredAt: workspace.restoredAt,
    })
    .from(transcript)
    .innerJoin(workspace, eq(workspace.id, transcript.workspaceId))
    .where(and(eq(transcript.publicShareId, args.publicShareId), isNotNull(transcript.publicShareId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Type-narrow the nullable `publicShareId` projection: the
  // `isNotNull` predicate above guarantees a non-null value in
  // every returned row, but Drizzle's inferred type still carries
  // the nullable column shape, so we tighten it here.
  if (row.publicShareId === null) return null;
  return { ...row, publicShareId: row.publicShareId };
}

export type ApplyShareUpdateArgs = {
  transcriptId: string;
  workspaceId: string;
  values: {
    isPubliclyShared: boolean;
    publicShareId: string | null;
    shareSecretId: string | null;
  };
  now: Date;
};

// Apply a share-state mutation and bump `shareUpdatedAt` to `now` so
// the archival lifecycle can detect whether a share was touched
// after a restore. `updatedAt` is _not_ modified here: share
// management is a metadata-only action and should not reorder the
// library's "recently updated" sort. Returns the updated row so the
// service layer can flow the fresh projection straight back to
// callers.
export async function applyShareUpdate(args: ApplyShareUpdateArgs): Promise<TranscriptRow | null> {
  const rows = await getDb()
    .update(transcript)
    .set({
      isPubliclyShared: args.values.isPubliclyShared,
      publicShareId: args.values.publicShareId,
      shareSecretId: args.values.shareSecretId,
      shareUpdatedAt: args.now,
    })
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .returning();
  return rows[0] ?? null;
}
