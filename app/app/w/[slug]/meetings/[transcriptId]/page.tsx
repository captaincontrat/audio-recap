import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TranscriptStatusView } from "@/components/features/meetings/transcript-status-view";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { readTranscriptStatus, StatusReadRefusedError, toStatusView, type TranscriptStatusView as TranscriptStatusPayload } from "@/lib/server/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meeting status",
};

export default async function MeetingStatusPage({ params }: { params: Promise<{ slug: string; transcriptId: string }> }) {
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

  const { slug, transcriptId } = await params;

  let view: TranscriptStatusPayload;
  try {
    const row = await readTranscriptStatus({
      workspaceSlug: slug,
      userId: auth.context.user.id,
      transcriptId,
    });
    view = toStatusView(row);
  } catch (error) {
    if (error instanceof StatusReadRefusedError) {
      if (error.reason === "not_found" || error.reason === "access_denied") {
        notFound();
      }
      if (error.reason === "workspace_archived") {
        return (
          <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6 text-sm">
            <h1 className="text-xl font-semibold">Workspace archived</h1>
            <p className="text-muted-foreground">This workspace is archived. Transcript status is unavailable until it is restored.</p>
            <div>
              <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
                Return to dashboard
              </Link>
            </div>
          </main>
        );
      }
    }
    throw error;
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link href={`/w/${encodeURIComponent(slug)}/meetings/new`} className="text-xs text-muted-foreground hover:underline">
          ← Submit another meeting
        </Link>
        <h1 className="text-2xl font-semibold">Meeting status</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>Transcript</dt>
          <dd className="font-mono text-foreground">{view.id}</dd>
          <dt>Submitted</dt>
          <dd>{new Date(view.createdAt).toLocaleString()}</dd>
          {view.completedAt ? (
            <>
              <dt>Completed</dt>
              <dd>{new Date(view.completedAt).toLocaleString()}</dd>
            </>
          ) : null}
          <dt>Source</dt>
          <dd>{view.sourceMediaKind === "video" ? "Video" : "Audio"}</dd>
          <dt>Notes</dt>
          <dd>{view.submittedWithNotes ? "Provided" : "None"}</dd>
        </dl>
      </header>
      <TranscriptStatusView workspaceSlug={slug} transcriptId={transcriptId} initial={view} />
    </main>
  );
}
