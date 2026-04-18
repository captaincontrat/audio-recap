import "server-only";

import { and, arrayContains, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { type TranscriptRow, transcript } from "@/lib/server/db/schema";
import type { CursorPayload } from "./cursor";
import { encodeCursor } from "./cursor";
import { buildTagSortKey } from "./curation/validation";
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
  // `add-transcript-curation-controls` adds important-state and
  // tag-list membership filters. `important === null` skips the
  // filter; `tags.length === 0` skips the tag filter.
  const importantFilter = options.important === null ? undefined : eq(transcript.isImportant, options.important);
  const tagsFilter = options.tags.length === 0 ? undefined : arrayContains(transcript.tags, options.tags);
  // `add-public-transcript-sharing` adds a shared/unshared filter:
  // `null` skips the filter; `true` restricts to publicly shared
  // records; `false` restricts to unshared records.
  const sharedFilter = options.shared === null ? undefined : eq(transcript.isPubliclyShared, options.shared);
  const keysetFilter = options.cursor ? buildKeysetFilter(options.sort, options.cursor) : undefined;

  const where = and(base, searchFilter, statusFilter, importantFilter, tagsFilter, sharedFilter, keysetFilter);

  const rows: TranscriptSummaryRow[] = await getDb()
    .select({
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      status: transcript.status,
      title: transcript.title,
      customTitle: transcript.customTitle,
      tags: transcript.tags,
      isImportant: transcript.isImportant,
      isPubliclyShared: transcript.isPubliclyShared,
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

// Case-insensitive effective-title expression. The curation change
// (`add-transcript-curation-controls`) owns the `customTitle ?? title`
// rule; this expression collapses the coalesce + lower-case through a
// single SQL projection so the sort, the cursor predicate, and the
// covering index (`transcript_workspace_title_ci_idx`) all agree on the
// same shape.
const effectiveTitleSql = sql`lower(coalesce(${transcript.customTitle}, ${transcript.title}))`;

function buildSearchFilter(search: string) {
  const pattern = `%${escapeSearchForIlike(search)}%`;
  return or(
    ilike(transcript.title, pattern),
    ilike(transcript.customTitle, pattern),
    ilike(transcript.transcriptMarkdown, pattern),
    ilike(transcript.recapMarkdown, pattern),
  );
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
        ? sql`(${effectiveTitleSql}, ${transcript.id}) > (${cursor.value}, ${cursor.id})`
        : sql`(${effectiveTitleSql}, ${transcript.id}) < (${cursor.value}, ${cursor.id})`;
    }
    case "important_created":
      return buildImportantCreatedKeysetFilter(sort, cursor);
    case "tag_sort_key":
      return buildTagSortKeysetFilter(sort, cursor);
    case "shared_created":
      return buildSharedCreatedKeysetFilter(sort, cursor);
    default: {
      const exhaustive: never = cursor.column;
      throw new Error(`Unhandled cursor column: ${String(exhaustive)}`);
    }
  }
}

// The `important` composite sorts order rows primarily by
// `isImportant` (with important-first descending and important-last
// ascending), then by `createdAt`, and finally by `id` as the
// tiebreaker. The cursor carries the boundary `(flag|createdAt)` pair
// as a string and the keyset predicate seeks strictly past that
// boundary.
function buildImportantCreatedKeysetFilter(sort: LibrarySortOption, cursor: CursorPayload) {
  const parsed = parseImportantCreatedCursor(cursor.value);
  if (!parsed) {
    throw new Error("Invalid important_created cursor payload");
  }
  const { important, createdAt } = parsed;
  const at = new Date(createdAt);
  if (sort === "important_first") {
    // `(is_important desc, created_at desc, id desc)`.
    // Use boolean DESC trick: map `is_important` to an integer so we
    // can compare it with Postgres's row-tuple comparison semantics.
    // `true` is greater than `false`; DESC means "strictly less than
    // the boundary" in tuple comparison, the `int4` cast keeps the
    // operator stable.
    return sql`(${transcript.isImportant}::int, ${transcript.createdAt}, ${transcript.id}) < (${important ? 1 : 0}, ${at.toISOString()}::timestamptz, ${cursor.id})`;
  }
  // `important_last`: ascending composite, "strictly greater than".
  return sql`(${transcript.isImportant}::int, ${transcript.createdAt}, ${transcript.id}) > (${important ? 1 : 0}, ${at.toISOString()}::timestamptz, ${cursor.id})`;
}

// Symmetric to `important_created`: the composite cursor carries the
// boundary `(sharedFlag, createdAt)` plus the trailing id as the
// tiebreaker. `shared_first` orders shared-before-unshared and
// recent-before-older; `unshared_first` flips to unshared-before-
// shared and older-before-recent so the two sorts are exact
// reverses.
function buildSharedCreatedKeysetFilter(sort: LibrarySortOption, cursor: CursorPayload) {
  const parsed = parseSharedCreatedCursor(cursor.value);
  if (!parsed) {
    throw new Error("Invalid shared_created cursor payload");
  }
  const { shared, createdAt } = parsed;
  const at = new Date(createdAt);
  if (sort === "shared_first") {
    return sql`(${transcript.isPubliclyShared}::int, ${transcript.createdAt}, ${transcript.id}) < (${shared ? 1 : 0}, ${at.toISOString()}::timestamptz, ${cursor.id})`;
  }
  return sql`(${transcript.isPubliclyShared}::int, ${transcript.createdAt}, ${transcript.id}) > (${shared ? 1 : 0}, ${at.toISOString()}::timestamptz, ${cursor.id})`;
}

// Tag-list sorts need to place untagged (NULL tag_sort_key) records
// consistently: untagged AFTER tagged for `tag_list_asc`, BEFORE
// tagged for `tag_list_desc`. PostgreSQL's default NULLS-LAST (asc) /
// NULLS-FIRST (desc) gives the right ordering for the primary column,
// but keyset pagination on a nullable column can't use raw tuple
// comparison without extra care. The approach: split the boundary
// into two cases based on whether the cursor is on a tagged or
// untagged row.
function buildTagSortKeysetFilter(sort: LibrarySortOption, cursor: CursorPayload) {
  const parsed = parseTagSortCursor(cursor.value);
  if (!parsed) {
    throw new Error("Invalid tag_sort_key cursor payload");
  }
  const { tagged, key } = parsed;
  if (sort === "tag_list_asc") {
    if (tagged) {
      // Past this tagged row: next row is either a greater tagged row
      // (same or greater key, later id) OR an untagged row (NULL is
      // after all tagged rows for NULLS-LAST).
      return or(sql`(${transcript.tagSortKey}, ${transcript.id}) > (${key}, ${cursor.id})`, isNull(transcript.tagSortKey));
    }
    // Cursor sits on an untagged row: only further untagged rows
    // with id greater than the boundary remain.
    return and(isNull(transcript.tagSortKey), sql`${transcript.id} > ${cursor.id}`);
  }
  // `tag_list_desc`: reverse. Untagged rows come first (NULLS-FIRST),
  // sorted by id DESC, then tagged rows sorted by (key DESC, id DESC).
  if (!tagged) {
    // Cursor on an untagged row: next is either another untagged row
    // with a smaller id (DESC iteration), or any tagged row.
    return or(and(isNull(transcript.tagSortKey), sql`${transcript.id} < ${cursor.id}`), isNotNull(transcript.tagSortKey));
  }
  // Cursor on a tagged row: only tagged rows strictly "less than" the
  // boundary (descending) remain.
  return and(isNotNull(transcript.tagSortKey), sql`(${transcript.tagSortKey}, ${transcript.id}) < (${key}, ${cursor.id})`);
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
      return [asc(effectiveTitleSql), asc(transcript.id)];
    case "title_desc":
      return [desc(effectiveTitleSql), desc(transcript.id)];
    case "important_first":
      // Important records first (desc), then most recently created,
      // then id as the tiebreaker for stable keyset pagination.
      return [desc(transcript.isImportant), desc(transcript.createdAt), desc(transcript.id)];
    case "important_last":
      // Non-important first (asc). Keep the same `createdAt` /
      // `id` secondary ordering so keyset pagination lines up with
      // the composite cursor.
      return [asc(transcript.isImportant), asc(transcript.createdAt), asc(transcript.id)];
    case "tag_list_asc":
      // Postgres default for ASC is NULLS-LAST which matches
      // "untagged after tagged" per spec. Tiebreaker on id for
      // stable keyset pagination.
      return [asc(transcript.tagSortKey), asc(transcript.id)];
    case "tag_list_desc":
      // DESC default is NULLS-FIRST which matches "untagged before
      // tagged" per spec.
      return [desc(transcript.tagSortKey), desc(transcript.id)];
    case "shared_first":
      // Shared records first (desc), then most recently created,
      // then id as the tiebreaker for stable keyset pagination.
      return [desc(transcript.isPubliclyShared), desc(transcript.createdAt), desc(transcript.id)];
    case "unshared_first":
      return [asc(transcript.isPubliclyShared), asc(transcript.createdAt), asc(transcript.id)];
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
      return effectiveTitleFor(row);
    case "important_first":
    case "important_last":
      // Composite `${flag}|${iso}` where flag is `1` or `0` so the
      // cursor encodes enough boundary information to resume the
      // keyset seek across the is_important boundary.
      return `${row.isImportant ? "1" : "0"}|${row.createdAt.toISOString()}`;
    case "tag_list_asc":
    case "tag_list_desc": {
      // Derive the same sort key the repository persists so the
      // cursor boundary exactly matches the ORDER BY column.
      const key = buildTagSortKey(row.tags);
      return key === null ? "u|" : `t|${key}`;
    }
    case "shared_first":
    case "unshared_first":
      // Composite `${flag}|${iso}` where flag is `1` or `0`. Mirrors
      // the `important_created` payload shape so the decoder can
      // branch on column and share the parsing pattern.
      return `${row.isPubliclyShared ? "1" : "0"}|${row.createdAt.toISOString()}`;
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}

// Mirror the SQL `lower(coalesce(custom_title, title))` projection so
// cursor values stay in sync with the order-by clause. A null
// `customTitle` collapses to the processing title, matching the
// covering index expression.
function effectiveTitleFor(row: TranscriptSummaryRow): string {
  const override = row.customTitle;
  const source = override != null ? override : row.title;
  return source.toLowerCase();
}

// Parse `${flag}|${iso}` (flag is `1` or `0`) into a typed boundary
// pair. Returns null for malformed payloads so `buildKeysetFilter`
// can surface a clear error rather than silently producing a bad
// SQL predicate.
function parseImportantCreatedCursor(value: string): { important: boolean; createdAt: string } | null {
  const sep = value.indexOf("|");
  if (sep < 0) return null;
  const flag = value.slice(0, sep);
  const createdAt = value.slice(sep + 1);
  if (flag !== "1" && flag !== "0") return null;
  if (createdAt.length === 0) return null;
  return { important: flag === "1", createdAt };
}

// Parse `${flag}|${key}` (flag is `t` for tagged, `u` for untagged)
// into a typed boundary pair. Untagged rows carry an empty key.
function parseTagSortCursor(value: string): { tagged: boolean; key: string } | null {
  const sep = value.indexOf("|");
  if (sep < 0) return null;
  const flag = value.slice(0, sep);
  const key = value.slice(sep + 1);
  if (flag !== "t" && flag !== "u") return null;
  if (flag === "t" && key.length === 0) return null;
  return { tagged: flag === "t", key };
}

// Parse `${flag}|${iso}` (flag is `1` or `0`) into a typed boundary
// pair for the shared-state composite sort. Mirrors
// `parseImportantCreatedCursor`; kept as a separate helper so the
// cursor column namespace (`shared_created` vs `important_created`)
// stays strict.
function parseSharedCreatedCursor(value: string): { shared: boolean; createdAt: string } | null {
  const sep = value.indexOf("|");
  if (sep < 0) return null;
  const flag = value.slice(0, sep);
  const createdAt = value.slice(sep + 1);
  if (flag !== "1" && flag !== "0") return null;
  if (createdAt.length === 0) return null;
  return { shared: flag === "1", createdAt };
}
