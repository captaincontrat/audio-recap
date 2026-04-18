import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { transcript, type TranscriptStatus } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { ACTIVE_WORK_STATUSES } from "@/lib/server/transcripts/queries";

// The minimal row shape `toUploadManagerRehydrationItem` projects
// from. Declared separately from `TranscriptRow` so the projection
// can be unit-tested without depending on the full ORM row.
export type UploadManagerRehydrationRow = {
  id: string;
  status: TranscriptStatus;
  title: string;
  failureSummary: string | null;
  sourceMediaKind: "audio" | "video";
  createdAt: Date;
  updatedAt: Date;
};

// Server-side helper that produces the upload-manager rehydration
// snapshot: the workspace's non-terminal transcripts (plus
// recently-failed ones that need to stay pinned in the tray) in the
// minimal projection the client tray consumes.
//
// Mirrors the read-gate convention used by `readTranscriptStatus`
// and `readTranscriptLibrary`:
//   - workspace not found → empty result (the route's own 404 still
//     fires; the rehydration list just doesn't seed the tray)
//   - access denied → empty result (same reason — the workspace's
//     own gate already redirected the request)
//   - workspace archived → empty result (the shell does not allow
//     new submissions in an archived workspace and stale in-flight
//     work would only confuse the tray)
//
// Failures here MUST NOT block the shell from rendering. The layout
// catches them and falls back to an empty list so a transient DB
// error never prevents the user from seeing the rest of the shell.

const REHYDRATION_LIMIT = 50;

export type UploadManagerRehydrationItem = {
  id: string;
  status: TranscriptStatus;
  title: string | null;
  failureSummary: string | null;
  sourceMediaKind: "audio" | "video";
  createdAt: string;
  updatedAt: string;
};

export type ListUploadManagerRehydrationItemsArgs = {
  workspaceSlug: string;
  userId: string;
};

// Pure projection from a transcript row to the rehydration item the
// client tray consumes. Mirrors the title-visibility rule in
// `toStatusView`: the worker-supplied title only becomes meaningful
// once the transcript reaches `completed`. In-flight rows hold a
// placeholder title (filename or empty string) that the tray would
// otherwise mistake for a finished label, so we project it to `null`
// and let the tray render its own in-flight copy.
export function toUploadManagerRehydrationItem(row: UploadManagerRehydrationRow): UploadManagerRehydrationItem {
  return {
    id: row.id,
    status: row.status,
    title: row.status === "completed" ? row.title : null,
    failureSummary: row.failureSummary,
    sourceMediaKind: row.sourceMediaKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listUploadManagerRehydrationItems(args: ListUploadManagerRehydrationItemsArgs): Promise<UploadManagerRehydrationItem[]> {
  let workspaceId: string;
  let archived: boolean;
  try {
    const context = await resolveWorkspaceContextFromSlug({ slug: args.workspaceSlug, userId: args.userId });
    workspaceId = context.workspace.id;
    archived = !isWorkspaceActive(context.workspace);
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError || error instanceof WorkspaceAccessDeniedError) {
      return [];
    }
    throw error;
  }
  if (archived) {
    return [];
  }

  const rows: UploadManagerRehydrationRow[] = await getDb()
    .select({
      id: transcript.id,
      status: transcript.status,
      title: transcript.title,
      failureSummary: transcript.failureSummary,
      sourceMediaKind: transcript.sourceMediaKind,
      createdAt: transcript.createdAt,
      updatedAt: transcript.updatedAt,
    })
    .from(transcript)
    .where(and(eq(transcript.workspaceId, workspaceId), inArray(transcript.status, ACTIVE_WORK_STATUSES)))
    .orderBy(desc(transcript.updatedAt), desc(transcript.id))
    .limit(REHYDRATION_LIMIT);

  return rows.map(toUploadManagerRehydrationItem);
}
