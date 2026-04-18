// Dedicated loading surface for the transcript detail route. Streamed
// by Next.js while the server component awaits the detail payload,
// keeping this state visually distinct from the "not found" and
// "fetch error" states required by the spec.
export default function TranscriptDetailLoading() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-3">
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted/60" />
      </div>
    </main>
  );
}
