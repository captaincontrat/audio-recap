import { type APIRequestContext, expect } from "@playwright/test";

import type { TranscriptFailureCode, TranscriptSourceMediaKind, TranscriptStatus, WorkspaceRole } from "@/lib/server/db/schema";

export type SeedTranscriptSpec = {
  id?: string;
  status?: TranscriptStatus;
  title?: string;
  customTitle?: string | null;
  transcriptMarkdown?: string;
  recapMarkdown?: string;
  tags?: string[];
  tagSortKey?: string | null;
  isImportant?: boolean;
  sourceMediaKind?: TranscriptSourceMediaKind;
  originalDurationSec?: number | null;
  submittedWithNotes?: boolean;
  failureCode?: TranscriptFailureCode | null;
  failureSummary?: string | null;
  createdByUserEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

export type SeedTranscriptsArgs = {
  workspaceSlug: string;
  userEmail: string;
  membershipRole?: WorkspaceRole;
  archiveWorkspace?: boolean;
  transcripts: SeedTranscriptSpec[];
};

export async function seedTranscripts(request: APIRequestContext, args: SeedTranscriptsArgs): Promise<{ workspaceId: string; transcripts: { id: string }[] }> {
  const response = await request.post("/api/test/transcripts/seed", {
    headers: { "content-type": "application/json" },
    data: args,
  });
  expect(response.ok(), `seed failed: ${response.status()} ${await response.text()}`).toBe(true);
  const body = (await response.json()) as {
    ok: boolean;
    workspaceId: string;
    transcripts: { id: string }[];
  };
  return { workspaceId: body.workspaceId, transcripts: body.transcripts };
}

export type LibraryApiResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  items?: Array<{
    id: string;
    workspaceId: string;
    status: TranscriptStatus;
    displayTitle: string;
    tags: string[];
    isImportant: boolean;
    sourceMediaKind: TranscriptSourceMediaKind;
    submittedWithNotes: boolean;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
  nextCursor?: string | null;
  pageSize?: number;
  defaultPageSize?: number;
};

export type DetailApiResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  transcript?: {
    id: string;
    workspaceId: string;
    status: TranscriptStatus;
    displayTitle: string;
    customTitle: string | null;
    tags: string[];
    isImportant: boolean;
    transcriptMarkdown: string;
    recapMarkdown: string;
    sourceMediaKind: TranscriptSourceMediaKind;
    originalDurationSec: number | null;
    submittedWithNotes: boolean;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    failure: { code: "validation_failed" | "processing_failed"; summary: string | null } | null;
  };
};
