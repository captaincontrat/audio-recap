import "server-only";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { type TranscriptRow, transcript } from "@/lib/server/db/schema";
import type { CursorPayload } from "./cursor";
import { encodeCursor } from "./cursor";
import type { TranscriptSummaryRow } from "./projections";
import { type TranscriptLibraryItem, toLibraryItem } from "./projections";
import type { LibraryQueryOptions } from "./query-options";
import { escapeSearchForIlike } from "./query-options";
import type { LibrarySortOption } from "./sort-options";
import { isAscendingSort, sortColumnFor } from "./sort-options";

// Drizzle-backed queries scoped to one workspace. The service layer
// (`library-read.ts`, `detail-read.ts`) is responsible for resolving
// the workspace context, checking membership, and honoring the
// active-workspace gate before calling these helpers. These functions
// trust the workspace id they are handed.

export type ListTranscriptsForWorkspaceArgs = {
  workspaceId: string;
  options: LibraryQueryOptions;
};

export type ListTranscriptsForWorkspaceResult = {
  items: TranscriptLibraryItem[];
  nextCursor: string | null;
};

// Run the library query with keyset pagination. We fetch `limit + 1`
// rows so the service can detect whether more results exist without a
// second count query. The helper returns projected `TranscriptLibraryItem`
// values so the route never has access to the raw `transcriptMarkdown`
// column for the library surface.
export async function listTranscriptsForWorkspace(args: ListTranscriptsForWorkspaceArgs): Promise<ListTranscriptsForWorkspaceResult> {
  const { workspaceId, options } = args;

  const base = eq(transcript.workspaceId, workspaceId);
  const searchFilter = options.search ? buildSearchFilter(options.search) : undefined;
  const statusFilter = options.status ? eq(transcript.status, options.status) : undefined;
  const keysetFilter = options.cursor ? buildKeysetFilter(options.sort, options.cursor) : undefined;

  const where = and(base, searchFilter, statusFilter, keysetFilter);

  const rows: TranscriptSummaryRow[] = await getDb()
    .select({
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      status: transcript.status,
      title: transcript.title,
      sourceMediaKind: transcript.sourceMediaKind,
      submittedWithNotes: transcript.submittedWithNotes,
      createdAt: transcript.createdAt,
      updatedAt: transcript.updatedAt,
      completedAt: transcript.completedAt,
    })
    .from(transcript)
    .where(where)
    .orderBy(...orderByFor(options.sort))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows;
  const items = pageRows.map(toLibraryItem);

  const nextCursor = hasMore ? buildNextCursor(options.sort, pageRows[pageRows.length - 1]) : null;

  return { items, nextCursor };
}

// Detail fetch scoped to a single workspace. Returns null when the
// transcript does not exist or belongs to a different workspace so the
// service layer can translate both cases into the same not-found
// refusal and keep cross-workspace records hidden.
export async function findTranscriptDetailForWorkspace(args: { transcriptId: string; workspaceId: string }): Promise<TranscriptRow | null> {
  const rows = await getDb()
    .select()
    .from(transcript)
    .where(and(eq(transcript.id, args.transcriptId), eq(transcript.workspaceId, args.workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

function buildSearchFilter(search: string) {
  const pattern = `%${escapeSearchForIlike(search)}%`;
  return or(ilike(transcript.title, pattern), ilike(transcript.transcriptMarkdown, pattern), ilike(transcript.recapMarkdown, pattern));
}

function buildKeysetFilter(sort: LibrarySortOption, cursor: CursorPayload) {
  const ascending = isAscendingSort(sort);
  switch (cursor.column) {
    case "created_at": {
      const at = new Date(cursor.value);
      return ascending
        ? sql`(${transcript.createdAt}, ${transcript.id}) > (${at.toISOString()}::timestamptz, ${cursor.id})`
        : sql`(${transcript.createdAt}, ${transcript.id}) < (${at.toISOString()}::timestamptz, ${cursor.id})`;
    }
    case "updated_at": {
      const at = new Date(cursor.value);
      return ascending
        ? sql`(${transcript.updatedAt}, ${transcript.id}) > (${at.toISOString()}::timestamptz, ${cursor.id})`
        : sql`(${transcript.updatedAt}, ${transcript.id}) < (${at.toISOString()}::timestamptz, ${cursor.id})`;
    }
    case "title": {
      return ascending
        ? sql`(lower(${transcript.title}), ${transcript.id}) > (${cursor.value}, ${cursor.id})`
        : sql`(lower(${transcript.title}), ${transcript.id}) < (${cursor.value}, ${cursor.id})`;
    }
    default: {
      const exhaustive: never = cursor.column;
      throw new Error(`Unhandled cursor column: ${String(exhaustive)}`);
    }
  }
}

function orderByFor(sort: LibrarySortOption) {
  switch (sort) {
    case "newest_first":
      return [desc(transcript.createdAt), desc(transcript.id)];
    case "oldest_first":
      return [asc(transcript.createdAt), asc(transcript.id)];
    case "recently_updated":
      return [desc(transcript.updatedAt), desc(transcript.id)];
    case "title_asc":
      return [asc(sql`lower(${transcript.title})`), asc(transcript.id)];
    case "title_desc":
      return [desc(sql`lower(${transcript.title})`), desc(transcript.id)];
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}

function buildNextCursor(sort: LibrarySortOption, lastRow: TranscriptSummaryRow): string {
  const column = sortColumnFor(sort);
  const value = boundaryValueFor(sort, lastRow);
  return encodeCursor({ column, value, id: lastRow.id });
}

function boundaryValueFor(sort: LibrarySortOption, row: TranscriptSummaryRow): string {
  switch (sort) {
    case "newest_first":
    case "oldest_first":
      return row.createdAt.toISOString();
    case "recently_updated":
      return row.updatedAt.toISOString();
    case "title_asc":
    case "title_desc":
      return row.title.toLowerCase();
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}
