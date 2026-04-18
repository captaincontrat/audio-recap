import Link from "next/link";

// Dedicated not-found surface for the transcript detail route. Covers
// both missing transcripts and transcripts in a different workspace -
// the private-transcript-library spec collapses both to the same
// "transcript is unavailable" response so callers cannot probe record
// existence across workspaces.
//
// Adapted by `add-workspace-app-shell`: the wrapper drops `<main>` and
// `min-h-svh` because `SidebarInset` already owns the page frame. The
// "Return to dashboard" link still works because `/dashboard` redirects
// to the user's last-active workspace landing.
export default function TranscriptDetailNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Transcript not found</h1>
      <p className="text-muted-foreground">This transcript is unavailable. It may have been removed, or it may belong to a different workspace.</p>
      <div>
        <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
