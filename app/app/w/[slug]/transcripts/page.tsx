import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  type InitialLibraryState,
  type LibraryImportantFilter,
  type LibrarySharedFilter,
  type LibrarySort,
  type LibraryStatusFilter,
  TranscriptLibraryView,
} from "@/components/features/transcripts/transcript-library-view";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { LibraryReadRefusedError, readTranscriptLibrary } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transcripts",
};

// Entry point for the private transcript library in the current
// workspace. Server-side renders the first page so the library shows
// up immediately without a client-side loading flash, then hands the
// page state to the interactive view that owns search, sort, status
// filter, and "Load more" interactions.
export default async function TranscriptLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requestHeaders = await headers();
  const auth = await evaluateProtectedRoute(requestHeaders);
  if (auth.status === "unauthenticated") {
    redirect(`${auth.redirectTo}?from=/dashboard`);
  }
  if (auth.status === "unverified") {
    redirect(auth.redirectTo);
  }

  const { slug } = await params;
  const rawSearchParams = await searchParams;

  const query = {
    search: firstString(rawSearchParams.search),
    sort: firstString(rawSearchParams.sort),
    status: firstString(rawSearchParams.status),
    cursor: firstString(rawSearchParams.cursor),
    limit: firstString(rawSearchParams.limit),
    important: firstString(rawSearchParams.important),
    shared: firstString(rawSearchParams.shared),
    tags: allStrings(rawSearchParams.tags),
  };

  let initial: InitialLibraryState;
  try {
    const result = await readTranscriptLibrary({
      workspaceSlug: slug,
      userId: auth.context.user.id,
      query,
    });
    initial = {
      items: result.items,
      nextCursor: result.nextCursor,
      search: result.options.search ?? "",
      sort: result.options.sort as LibrarySort,
      status: (result.options.status ?? "") as LibraryStatusFilter,
      important: importantQueryToFilter(result.options.important),
      shared: sharedQueryToFilter(result.options.shared),
      tags: result.options.tags,
    };
  } catch (error) {
    if (error instanceof LibraryReadRefusedError) {
      if (error.reason === "not_found" || error.reason === "access_denied") {
        notFound();
      }
      if (error.reason === "workspace_archived") {
        return <ArchivedWorkspaceNotice slug={slug} />;
      }
      if (error.reason === "invalid_query") {
        // Bad query params from the URL shouldn't crash the library;
        // reset to defaults and let the user re-apply filters inside
        // the client view.
        redirect(`/w/${encodeURIComponent(slug)}/transcripts`);
      }
    }
    throw error;
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Transcripts</h1>
          <Link href={`/w/${encodeURIComponent(slug)}/meetings/new`} className="text-xs text-primary underline-offset-4 hover:underline">
            Submit a meeting
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">Browse and open the meeting transcripts in this workspace.</p>
      </header>
      <TranscriptLibraryView workspaceSlug={slug} initial={initial} />
    </main>
  );
}

function firstString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

// Produce a flat string[] from either a repeated `tags=a&tags=b`
// search param or a single comma-separated `tags=a,b` value. Returns
// `null` so the parser can distinguish "no filter" from an empty list.
function allStrings(value: string | string[] | undefined): string[] | null {
  if (value == null) return null;
  const list = Array.isArray(value) ? value : [value];
  const flattened = list.flatMap((entry) =>
    entry
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return flattened.length === 0 ? null : flattened;
}

function importantQueryToFilter(value: boolean | null): LibraryImportantFilter {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

// Mirror of `importantQueryToFilter` for the public-sharing filter.
// The server parses `shared=true` / `shared=false` into a nullable
// boolean; the client select control uses string literals so we
// translate here.
function sharedQueryToFilter(value: boolean | null): LibrarySharedFilter {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function ArchivedWorkspaceNotice({ slug }: { slug: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Workspace archived</h1>
      <p className="text-muted-foreground">This workspace is archived. Its transcripts are not available until an admin restores the workspace.</p>
      <div>
        <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
