"use client";

import { createContext, useContext } from "react";

// Fed once per shell mount from the server `count(*)` against the
// workspace transcript table. The shell caches the value here so the
// sidebar nav badge does not refetch on every intra-shell navigation
// (see `add-workspace-app-shell` design — "Source the transcripts
// count from the existing workspace transcript library read"). The
// number is a density cue, not a live counter.
const TranscriptsCountContext = createContext<number | null>(null);

export function TranscriptsCountProvider({ value, children }: { value: number; children: React.ReactNode }) {
  return <TranscriptsCountContext.Provider value={value}>{children}</TranscriptsCountContext.Provider>;
}

// Returns `null` outside the shell so consumers can render a fallback
// (e.g. omit the badge) without throwing.
export function useTranscriptsCount(): number | null {
  return useContext(TranscriptsCountContext);
}
