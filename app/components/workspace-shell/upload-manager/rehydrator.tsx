"use client";

// Mount-time rehydrator. Receives the workspace's non-terminal
// transcripts as a server-resolved prop and merges them into the
// upload-manager store on mount. After merging, every rehydrated
// item that is still non-terminal is registered with the polling
// controller so the same polling contract that the dedicated status
// page uses keeps the tray fresh.
//
// The rehydrator renders nothing — it is a side-effect-only client
// component the shell mounts above the page content. Putting it
// inside the `UploadManagerProvider` lets it use the same store
// hooks as the rest of the upload-manager surface.

import { useEffect, useRef } from "react";

import { getUploadStatusPollingController } from "./polling";
import { useUploadManagerStore, useUploadManagerWorkspaceSlug } from "./provider";
import { isTerminalServerPhase, type RehydratedTranscriptStatus } from "./store";

type Props = {
  rehydrated: RehydratedTranscriptStatus[];
};

export function UploadManagerRehydrator({ rehydrated }: Props): null {
  const store = useUploadManagerStore();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const previousSlug = useRef<string | null>(null);

  useEffect(() => {
    // Re-merge whenever the slug changes. In practice the shell
    // layout re-mounts on cross-workspace navigation so this is
    // mostly for the very first render, but the slug guard keeps
    // the effect honest.
    if (previousSlug.current === workspaceSlug && rehydrated.length === 0) return;
    previousSlug.current = workspaceSlug;
    store.mergeRehydrated(workspaceSlug, rehydrated);
    const controller = getUploadStatusPollingController(store);
    for (const incoming of rehydrated) {
      if (isTerminalServerPhase(incoming.status)) continue;
      controller.ensurePolling({ workspaceSlug, transcriptId: incoming.id });
    }
  }, [rehydrated, store, workspaceSlug]);

  return null;
}
