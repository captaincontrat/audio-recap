import "server-only";

import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { StatusReadRefusedError } from "./errors";
import { findTranscriptForWorkspace } from "./transcripts";

export type StatusReadInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
};

// Narrow post-submit status read. The spec explicitly scopes this to
// the transcript's workspace and requires it to honor the
// active-workspace gate from `add-workspace-archival-lifecycle`. Broader
// library/detail read surfaces are owned by `add-transcript-management`.
export async function readTranscriptStatus(inputs: StatusReadInputs): Promise<TranscriptRow> {
  const context = await resolveContextOrRefuse(inputs);

  if (!isWorkspaceActive(context.workspace)) {
    throw new StatusReadRefusedError("workspace_archived");
  }

  const row = await findTranscriptForWorkspace(inputs.transcriptId, context.workspace.id);
  if (!row) {
    throw new StatusReadRefusedError("not_found");
  }
  return row;
}

async function resolveContextOrRefuse(inputs: StatusReadInputs) {
  try {
    return await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new StatusReadRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new StatusReadRefusedError("access_denied");
    }
    throw error;
  }
}

// Render the transcript row into the shape exposed by the post-submit
// status endpoint. Keeps raw fields (failure code, markdown blobs) off
// the narrow status surface so it does not turn into the durable
// library/detail read contract owned by later changes.
export type TranscriptStatusView = {
  id: string;
  workspaceId: string;
  status: TranscriptRow["status"];
  sourceMediaKind: TranscriptRow["sourceMediaKind"];
  submittedWithNotes: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  title: string | null;
  hasRecap: boolean;
  failure: { code: TranscriptRow["failureCode"]; summary: string | null } | null;
};

export function toStatusView(row: TranscriptRow): TranscriptStatusView {
  const failure = row.failureCode
    ? {
        code: row.failureCode,
        summary: row.failureSummary,
      }
    : null;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    sourceMediaKind: row.sourceMediaKind,
    submittedWithNotes: row.submittedWithNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    title: row.status === "completed" ? row.title : null,
    hasRecap: row.status === "completed" && row.recapMarkdown.length > 0,
    failure,
  };
}

export function statusReadRefusalToHttpStatus(reason: StatusReadRefusedError["reason"]): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "workspace_archived":
      return 409;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled status read refusal reason: ${String(exhaustive)}`);
    }
  }
}
