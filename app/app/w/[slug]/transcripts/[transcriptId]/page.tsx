import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TranscriptDetailView, type DetailView } from "@/components/features/transcripts/transcript-detail-view";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import type { WorkspaceRole } from "@/lib/server/db/schema";
import { DetailReadRefusedError, readTranscriptDetailWithRole, toDetailView } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transcript",
};

// Private transcript detail page for the current workspace. The read
// service enforces active-workspace and workspace-scoping rules so a
// transcript in a different workspace returns the same `notFound()`
// response as a missing one. Unexpected errors fall through to
// Next.js's error boundary (which also satisfies the
// "recoverable fetch error with retry" requirement for the server
// render path by allowing the user to refresh). The client component
// owns the post-hydration refresh + error state for content that
// arrives after initial load.
export default async function TranscriptDetailPage({ params }: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const requestHeaders = await headers();
  const auth = await evaluateProtectedRoute(requestHeaders);
  if (auth.status === "unauthenticated") {
    redirect(`${auth.redirectTo}?from=/dashboard`);
  }
  if (auth.status === "unverified") {
    redirect(auth.redirectTo);
  }

  const { slug, transcriptId } = await params;

  let initial: DetailView;
  let role: WorkspaceRole;
  try {
    const result = await readTranscriptDetailWithRole({ workspaceSlug: slug, userId: auth.context.user.id, transcriptId });
    initial = toDetailView(result.row);
    role = result.role;
  } catch (error) {
    if (error instanceof DetailReadRefusedError) {
      if (error.reason === "not_found" || error.reason === "access_denied") {
        notFound();
      }
      if (error.reason === "workspace_archived") {
        return <ArchivedWorkspaceNotice slug={slug} />;
      }
    }
    throw error;
  }

  const canEditMarkdown = role === "admin" || role === "member";

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`/w/${encodeURIComponent(slug)}/transcripts`} className="hover:underline">
          ← All transcripts
        </Link>
      </nav>
      <TranscriptDetailView workspaceSlug={slug} transcriptId={transcriptId} initial={initial} canEditMarkdown={canEditMarkdown} />
    </main>
  );
}

function ArchivedWorkspaceNotice({ slug }: { slug: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Workspace archived</h1>
      <p className="text-muted-foreground">This workspace is archived. Its transcripts are not available until an admin restores the workspace.</p>
      <div>
        <Link href={`/w/${encodeURIComponent(slug)}`} className="text-primary underline-offset-4 hover:underline">
          Return to workspace
        </Link>
      </div>
    </main>
  );
}
