import { headers } from "next/headers";
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

// Private transcript library page, re-homed inside `(workspace-shell)`
// by `add-workspace-app-shell`. The page no longer wraps itself in a
// `<main>` element — `SidebarInset` is the page's `<main>`, the
// breadcrumb band sits above this content, and the page only renders a
// width-constrained content container so typography matches the
// previous layout.
//
// The "← Workspace overview" back-link the pre-shell version carried
// is dropped because the breadcrumb root crumb already links to the
// workspace overview from every page in the shell.
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
  if (auth.status === "closed") {
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
        return <ArchivedWorkspaceNotice />;
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Transcripts</h1>
        <p className="text-sm text-muted-foreground">Browse and open the meeting transcripts in this workspace.</p>
      </header>
      <TranscriptLibraryView workspaceSlug={slug} initial={initial} />
    </div>
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

function ArchivedWorkspaceNotice() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Workspace archived</h1>
      <p className="text-muted-foreground">This workspace is archived. Its transcripts are not available until an admin restores the workspace.</p>
    </div>
  );
}
