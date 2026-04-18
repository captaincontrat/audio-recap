"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Dedicated error surface for the transcript library route. Covers
// recoverable fetch errors that happen during server rendering or
// hydration; `reset` re-renders the route segment so the user can
// retry without a full page reload, satisfying the spec's
// "recoverable library fetch error with retry" requirement.
//
// Adapted by `add-workspace-app-shell`: the wrapper drops `<main>` and
// `min-h-svh` because `SidebarInset` already owns the page frame.
export default function TranscriptLibraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[transcripts.library] render failed", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Could not load transcripts</h1>
      <p className="text-muted-foreground">Something went wrong while loading the transcript library. Retrying may resolve transient errors.</p>
      <div>
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
