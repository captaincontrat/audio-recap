"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Mirrors the summary projection shape returned by
// `toLibraryItem` on the server. Kept local so the client bundle does
// not import server-only modules. `add-transcript-curation-controls`
// adds the `tags` / `isImportant` fields used by the card chips and
// the tag / important filter controls. `add-public-transcript-sharing`
// adds the `isPubliclyShared` flag the library uses to badge shared
// records and to drive the shared-first sort + filter controls.
export type LibraryItem = {
  id: string;
  workspaceId: string;
  status: "queued" | "preprocessing" | "transcribing" | "generating_recap" | "generating_title" | "finalizing" | "retrying" | "completed" | "failed";
  displayTitle: string;
  tags: string[];
  isImportant: boolean;
  isPubliclyShared: boolean;
  sourceMediaKind: "audio" | "video";
  submittedWithNotes: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

// Sort vocabulary extended by `add-transcript-curation-controls` and
// `add-public-transcript-sharing`. Keep in lockstep with the
// server-side `LIBRARY_SORT_OPTIONS` union.
export type LibrarySort =
  | "newest_first"
  | "oldest_first"
  | "recently_updated"
  | "title_asc"
  | "title_desc"
  | "important_first"
  | "important_last"
  | "tag_list_asc"
  | "tag_list_desc"
  | "shared_first"
  | "unshared_first";

export type LibraryStatusFilter =
  | ""
  | "queued"
  | "preprocessing"
  | "transcribing"
  | "generating_recap"
  | "generating_title"
  | "finalizing"
  | "retrying"
  | "completed"
  | "failed";

// `""` means "no filter". `"true"` / `"false"` restrict the library
// to records with that important state. The server parses the URL
// form (`important=true`); this type mirrors the select-control
// vocabulary.
export type LibraryImportantFilter = "" | "true" | "false";

// `""` means "no filter". `"true"` / `"false"` restrict the library
// to publicly-shared or non-shared transcripts respectively. Mirrors
// the server-side `LibrarySharedFilter` type; the select vocabulary
// below feeds directly into the URL query parameter the server reads.
export type LibrarySharedFilter = "" | "true" | "false";

export type InitialLibraryState = {
  items: LibraryItem[];
  nextCursor: string | null;
  search: string;
  sort: LibrarySort;
  status: LibraryStatusFilter;
  important: LibraryImportantFilter;
  shared: LibrarySharedFilter;
  tags: string[];
};

type Props = {
  workspaceSlug: string;
  initial: InitialLibraryState;
};

type FetchState = { kind: "idle" } | { kind: "loading" } | { kind: "loading_more" } | { kind: "error"; message: string; retry: "reload" | "load_more" };

const SEARCH_DEBOUNCE_MS = 300;

// Full-page library view. Owns the query controls (search, sort,
// status filter, important filter, tag filter), the accumulated item
// list, the `nextCursor` for the "Load more" interaction, and the
// distinct loading/empty/no-results/error states the spec calls out.
export function TranscriptLibraryView({ workspaceSlug, initial }: Props) {
  const [items, setItems] = useState<LibraryItem[]>(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);

  const [searchInput, setSearchInput] = useState<string>(initial.search);
  const [search, setSearch] = useState<string>(initial.search);
  const [sort, setSort] = useState<LibrarySort>(initial.sort);
  const [status, setStatus] = useState<LibraryStatusFilter>(initial.status);
  const [important, setImportant] = useState<LibraryImportantFilter>(initial.important);
  const [shared, setShared] = useState<LibrarySharedFilter>(initial.shared);
  const [tagFilter, setTagFilter] = useState<string[]>(initial.tags);

  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });

  // Track whether the current state reflects the server's initial
  // payload. Any time the user changes a control we reset pagination
  // and re-fetch; the initial mount must skip that reset so the
  // server-rendered first page stays on screen until the user acts.
  const hasHydratedControlsRef = useRef(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Signature that triggers a pagination reset. Tag filter joins the
  // sorted tag list so a different order of the same tags is a no-op.
  const fetchSignature = useMemo(
    () => `${search}|${sort}|${status}|${important}|${shared}|${[...tagFilter].sort().join(",")}`,
    [search, sort, status, important, shared, tagFilter],
  );

  useEffect(() => {
    if (!hasHydratedControlsRef.current) {
      hasHydratedControlsRef.current = true;
      return;
    }

    let cancelled = false;
    setFetchState({ kind: "loading" });
    (async () => {
      try {
        const page = await fetchLibraryPage({ workspaceSlug, search, sort, status, important, shared, tags: tagFilter, cursor: null });
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setFetchState({ kind: "idle" });
      } catch (err) {
        if (cancelled) return;
        setFetchState({
          kind: "error",
          message: err instanceof LibraryFetchError ? err.message : "Something went wrong while loading transcripts.",
          retry: "reload",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, search, sort, status, important, shared, tagFilter]);

  async function handleLoadMore() {
    if (!nextCursor || fetchState.kind === "loading" || fetchState.kind === "loading_more") return;
    setFetchState({ kind: "loading_more" });
    try {
      const page = await fetchLibraryPage({ workspaceSlug, search, sort, status, important, shared, tags: tagFilter, cursor: nextCursor });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setFetchState({ kind: "idle" });
    } catch (err) {
      setFetchState({
        kind: "error",
        message: err instanceof LibraryFetchError ? err.message : "Could not load the next page of transcripts.",
        retry: "load_more",
      });
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>) {
    setSort(event.target.value as LibrarySort);
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatus(event.target.value as LibraryStatusFilter);
  }

  function handleImportantChange(event: ChangeEvent<HTMLSelectElement>) {
    setImportant(event.target.value as LibraryImportantFilter);
  }

  function handleSharedChange(event: ChangeEvent<HTMLSelectElement>) {
    setShared(event.target.value as LibrarySharedFilter);
  }

  function handleTagFilterChange(next: string[]) {
    setTagFilter(next);
  }

  function handleRetry() {
    if (fetchState.kind !== "error") return;
    if (fetchState.retry === "load_more") {
      handleLoadMore();
      return;
    }
    const signature = fetchSignature;
    setFetchState({ kind: "loading" });
    (async () => {
      try {
        const page = await fetchLibraryPage({ workspaceSlug, search, sort, status, important, shared, tags: tagFilter, cursor: null });
        if (signature !== fetchSignature) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setFetchState({ kind: "idle" });
      } catch (err) {
        setFetchState({
          kind: "error",
          message: err instanceof LibraryFetchError ? err.message : "Something went wrong while loading transcripts.",
          retry: "reload",
        });
      }
    })();
  }

  const isSearching = search.length > 0 || status !== "" || important !== "" || shared !== "" || tagFilter.length > 0;
  const showInitialLoading = fetchState.kind === "loading" && items.length === 0;
  const showReloadError = fetchState.kind === "error" && fetchState.retry === "reload" && items.length === 0;
  const showListErrorBanner = fetchState.kind === "error" && fetchState.retry === "reload" && items.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <LibraryControls
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        sort={sort}
        onSortChange={handleSortChange}
        status={status}
        onStatusChange={handleStatusChange}
        important={important}
        onImportantChange={handleImportantChange}
        shared={shared}
        onSharedChange={handleSharedChange}
        tagFilter={tagFilter}
        onTagFilterChange={handleTagFilterChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {showListErrorBanner ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <p>{fetchState.message}</p>
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {showInitialLoading ? (
        <LibraryLoadingState />
      ) : showReloadError ? (
        <LibraryErrorState message={fetchState.message} onRetry={handleRetry} />
      ) : items.length === 0 ? (
        isSearching ? (
          <LibraryNoResultsState />
        ) : (
          <LibraryEmptyState workspaceSlug={workspaceSlug} />
        )
      ) : (
        <LibraryItemList items={items} workspaceSlug={workspaceSlug} />
      )}

      {items.length > 0 && nextCursor ? (
        <div className="flex flex-col items-center gap-2">
          <Button type="button" onClick={handleLoadMore} disabled={fetchState.kind === "loading" || fetchState.kind === "loading_more"}>
            {fetchState.kind === "loading_more" ? "Loading…" : "Load more"}
          </Button>
          {fetchState.kind === "error" && fetchState.retry === "load_more" ? (
            <p role="alert" className="text-xs text-destructive">
              {fetchState.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function LibraryControls({
  searchInput,
  setSearchInput,
  sort,
  onSortChange,
  status,
  onStatusChange,
  important,
  onImportantChange,
  shared,
  onSharedChange,
  tagFilter,
  onTagFilterChange,
  onSearchSubmit,
}: {
  searchInput: string;
  setSearchInput: (next: string) => void;
  sort: LibrarySort;
  onSortChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  status: LibraryStatusFilter;
  onStatusChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  important: LibraryImportantFilter;
  onImportantChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  shared: LibrarySharedFilter;
  onSharedChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  tagFilter: string[];
  onTagFilterChange: (next: string[]) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSearchSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <Label htmlFor="library-search">Search transcripts</Label>
          <Input
            id="library-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search titles, recaps, and transcripts"
            type="search"
          />
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="library-sort">Sort</Label>
          <select
            id="library-sort"
            value={sort}
            onChange={onSortChange}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="newest_first">Newest first</option>
            <option value="oldest_first">Oldest first</option>
            <option value="recently_updated">Recently updated</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
            <option value="important_first">Important first</option>
            <option value="important_last">Important last</option>
            <option value="tag_list_asc">Tags A–Z</option>
            <option value="tag_list_desc">Tags Z–A</option>
            <option value="shared_first">Shared first</option>
            <option value="unshared_first">Unshared first</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="library-status">Status</Label>
          <select
            id="library-status"
            value={status}
            onChange={onStatusChange}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="preprocessing">Preprocessing</option>
            <option value="transcribing">Transcribing</option>
            <option value="generating_recap">Writing recap</option>
            <option value="generating_title">Titling</option>
            <option value="finalizing">Finalizing</option>
            <option value="retrying">Retrying</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="library-important">Important</Label>
          <select
            id="library-important"
            value={important}
            onChange={onImportantChange}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="">All transcripts</option>
            <option value="true">Important only</option>
            <option value="false">Not important</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="library-shared">Shared</Label>
          <select
            id="library-shared"
            value={shared}
            onChange={onSharedChange}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="">All transcripts</option>
            <option value="true">Publicly shared</option>
            <option value="false">Not shared</option>
          </select>
        </div>
      </div>
      <TagFilterEditor value={tagFilter} onChange={onTagFilterChange} />
    </form>
  );
}

function TagFilterEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState<string>("");

  function addTag(raw: string) {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) return;
    if (value.some((tag) => tag.toLowerCase() === normalized)) {
      setInput("");
      return;
    }
    onChange([...value, normalized]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((entry) => entry !== tag));
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="library-tag-filter">Filter by tags</Label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background p-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm px-0.5 text-muted-foreground hover:bg-muted-foreground/10"
              aria-label={`Remove tag filter ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="library-tag-filter"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(input);
            } else if (event.key === "Backspace" && input.length === 0 && value.length > 0) {
              removeTag(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? "Filter by tag (press Enter)" : ""}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function LibraryItemList({ items, workspaceSlug }: { items: LibraryItem[]; workspaceSlug: string }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Transcript library">
      {items.map((item) => (
        <li key={item.id}>
          <LibraryItemCard item={item} workspaceSlug={workspaceSlug} />
        </li>
      ))}
    </ul>
  );
}

function LibraryItemCard({ item, workspaceSlug }: { item: LibraryItem; workspaceSlug: string }) {
  const createdAt = new Date(item.createdAt);
  const updatedAt = new Date(item.updatedAt);
  const href = `/w/${encodeURIComponent(workspaceSlug)}/transcripts/${encodeURIComponent(item.id)}`;
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-md border border-border/70 bg-background p-4 transition-colors hover:border-border hover:bg-muted/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{item.displayTitle}</span>
        <div className="flex items-center gap-2">
          {item.isPubliclyShared ? <SharedBadge /> : null}
          {item.isImportant ? <ImportantBadge /> : null}
          <StatusBadge status={item.status} />
        </div>
      </div>
      {item.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Tags">
          {item.tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center rounded-sm border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <dt>Created</dt>
        <dd>{createdAt.toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{updatedAt.toLocaleString()}</dd>
        <dt>Source</dt>
        <dd>{item.sourceMediaKind === "video" ? "Video" : "Audio"}</dd>
      </dl>
    </Link>
  );
}

// Small decorative badge that echoes the detail-view
// `ImportantBadge`. Kept local to this file so each library card can
// render the marker without importing from the detail component and
// dragging its broader surface. The visible "Important" text is the
// accessible name so screen readers do not need an explicit label.
function ImportantBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
      Important
    </span>
  );
}

// Visible badge that surfaces the public-sharing flag on library
// cards. Sibling to the detail view's `SharedBadge`; we render it
// here too so workspace members scanning the library can identify
// the records that carry a public URL without opening each one.
function SharedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300"
      title="This transcript is publicly shared."
    >
      Shared
    </span>
  );
}

function StatusBadge({ status }: { status: LibraryItem["status"] }) {
  const tone = statusTone(status);
  const label = statusLabel(status);
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", tone)}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}

function statusTone(status: LibraryItem["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "border-destructive/40 bg-destructive/5 text-destructive";
    case "retrying":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border/70 bg-muted text-muted-foreground";
  }
}

function statusLabel(status: LibraryItem["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "preprocessing":
      return "Preprocessing";
    case "transcribing":
      return "Transcribing";
    case "generating_recap":
      return "Writing recap";
    case "generating_title":
      return "Titling";
    case "finalizing":
      return "Finalizing";
    case "retrying":
      return "Retrying";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled transcript status: ${String(exhaustive)}`);
    }
  }
}

function LibraryLoadingState() {
  return (
    <div className="flex items-center justify-center rounded-md border border-border/60 bg-muted/20 p-8 text-sm text-muted-foreground">
      Loading transcripts…
    </div>
  );
}

function LibraryEmptyState({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border/60 bg-muted/10 p-8 text-center text-sm">
      <p className="font-medium text-foreground">No transcripts yet</p>
      <p className="text-xs text-muted-foreground">Submit a meeting to generate its first transcript. Completed transcripts will appear here.</p>
      <Link href={`/w/${encodeURIComponent(workspaceSlug)}/meetings/new`} className="text-xs text-primary underline-offset-4 hover:underline">
        Submit a meeting
      </Link>
    </div>
  );
}

function LibraryNoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border/60 bg-muted/10 p-8 text-center text-sm">
      <p className="font-medium text-foreground">No transcripts match these filters</p>
      <p className="text-xs text-muted-foreground">Try a different search term or clear the status filter.</p>
    </div>
  );
}

function LibraryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
    >
      <p className="font-medium text-destructive">Could not load transcripts</p>
      <p className="text-xs text-destructive">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

class LibraryFetchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LibraryFetchError";
  }
}

type FetchLibraryArgs = {
  workspaceSlug: string;
  search: string;
  sort: LibrarySort;
  status: LibraryStatusFilter;
  important: LibraryImportantFilter;
  shared: LibrarySharedFilter;
  tags: string[];
  cursor: string | null;
};

async function fetchLibraryPage(args: FetchLibraryArgs): Promise<{ items: LibraryItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (args.search.length > 0) params.set("search", args.search);
  params.set("sort", args.sort);
  if (args.status !== "") params.set("status", args.status);
  if (args.important !== "") params.set("important", args.important);
  if (args.shared !== "") params.set("shared", args.shared);
  for (const tag of args.tags) params.append("tags", tag);
  if (args.cursor) params.set("cursor", args.cursor);
  const url = `/api/workspaces/${encodeURIComponent(args.workspaceSlug)}/transcripts?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin" });
  } catch (err) {
    throw new LibraryFetchError("network_error", err instanceof Error ? err.message : "Network request failed");
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; items: LibraryItem[]; nextCursor: string | null }
    | { ok: false; code: string; message: string }
    | null;

  if (!payload) {
    throw new LibraryFetchError("empty_response", "The server returned an empty response.");
  }
  if (payload.ok === false) {
    throw new LibraryFetchError(payload.code, payload.message);
  }
  return { items: payload.items, nextCursor: payload.nextCursor };
}
