// Dedicated loading surface for the transcript library route. Next.js
// streams this while the server component awaits the first library
// page, keeping the "library data is still loading" state visually
// distinct from the "library is empty" and "library failed to load"
// states required by the private-transcript-library spec.
export default function TranscriptLibraryLoading() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-20 animate-pulse rounded-md bg-muted/60" />
        <div className="h-20 animate-pulse rounded-md bg-muted/60" />
        <div className="h-20 animate-pulse rounded-md bg-muted/60" />
      </div>
    </main>
  );
}
