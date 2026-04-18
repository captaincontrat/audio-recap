// Generic unavailable surface for the public share route. The
// `add-public-transcript-sharing` spec requires that every failure
// mode of the public resolver (nonexistent share id, wrong secret,
// disabled share, rotated out, deleted transcript, archived
// workspace) collapse to the same visitor-facing presentation so the
// public surface never reveals which condition caused the failure.
// The copy is intentionally brief and does not link back into any
// workspace surface: an anonymous viewer that stumbled onto a stale
// link has no workspace to return to.
export default function PublicShareNotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">This transcript isn't available</h1>
      <p className="text-muted-foreground">The link you opened is no longer active, or the transcript has been removed.</p>
    </main>
  );
}
