import type { TranscriptRow, TranscriptSourceMediaKind, TranscriptStatus } from "@/lib/server/db/schema";
import { deriveDisplayTitle } from "./display-title";

// Shape shared between the library list items and other summary-only
// surfaces. The library intentionally does NOT carry markdown content
// so the list payload stays small and paginable. `recapPreview` is an
// optional short derived string callers can compute from the first
// line of the recap for card UIs.
//
// Curation fields (`customTitle`, `tags`, `isImportant`) are included in
// the summary projection so the library surface can render the effective
// title and the tag / important state without a second fetch. The
// `customTitle` column is never exposed to consumers directly — they
// should always read `displayTitle`, which collapses the
// `customTitle ?? title` rule through `deriveDisplayTitle`.

export type TranscriptSummaryRow = Pick<
  TranscriptRow,
  | "id"
  | "workspaceId"
  | "status"
  | "title"
  | "customTitle"
  | "tags"
  | "isImportant"
  | "sourceMediaKind"
  | "submittedWithNotes"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
>;

export type TranscriptLibraryItem = {
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
};

// Build a library item from either a full transcript row or the narrow
// summary projection the list query pulls from Postgres. The projection
// name is what flows across the API boundary, so it avoids surface-area
// fields like `transcriptMarkdown` that must stay off the library view.
export function toLibraryItem(row: TranscriptSummaryRow): TranscriptLibraryItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    displayTitle: deriveDisplayTitle({ title: row.title, customTitle: row.customTitle }),
    tags: row.tags,
    isImportant: row.isImportant,
    sourceMediaKind: row.sourceMediaKind,
    submittedWithNotes: row.submittedWithNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

// The detail view is the full durable read contract: `displayTitle`,
// canonical markdown strings, processing status, and privacy-safe
// metadata. No raw provider payloads, no original filename, no transient
// input references. Failure metadata mirrors the post-submit status
// shape so the frontend can reuse the failure-summary helpers.
//
// The detail view also exposes the curation state so the metadata panel
// (rename, tags, important toggle) can render directly off this payload.
// `customTitle` is intentionally exposed on the detail view so the
// rename control can pre-fill the current override; library cards read
// only `displayTitle` to keep the "stable read-side title contract"
// centralized.

export type TranscriptDetailView = {
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
  failure: { code: TranscriptRow["failureCode"]; summary: string | null } | null;
};

export function toDetailView(row: TranscriptRow): TranscriptDetailView {
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
    displayTitle: deriveDisplayTitle({ title: row.title, customTitle: row.customTitle }),
    customTitle: row.customTitle,
    tags: row.tags,
    isImportant: row.isImportant,
    transcriptMarkdown: row.transcriptMarkdown,
    recapMarkdown: row.recapMarkdown,
    sourceMediaKind: row.sourceMediaKind,
    originalDurationSec: row.originalDurationSec,
    submittedWithNotes: row.submittedWithNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    failure,
  };
}
