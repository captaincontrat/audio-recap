"use client";

// Workspace-scoped React surface over the upload-manager store.
//
// The provider is mounted once inside the shared shell layout and
// fixes the "current workspace" for all consumers. Hooks here only
// expose items for that workspace and only allow actions that are
// allowed in that workspace (archived workspaces and read-only
// members get `canSubmit = false`, which the entry points use to
// disable themselves).
//
// State lives in the module-level singleton from `./store`, so a
// brief layout re-mount during a route transition does not lose
// in-flight items.

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import { getUploadManagerStore } from "./store";
import type { UploadManagerItem, UploadManagerStore } from "./store";

type UploadManagerProviderProps = {
  workspaceSlug: string;
  // True only when the current member can create transcripts in
  // an active workspace. Read-only members and archived workspaces
  // resolve to false; the shell entry points consult this to grey
  // themselves out without needing to re-read workspace context.
  canSubmit: boolean;
  children: React.ReactNode;
};

type UploadManagerContextValue = {
  workspaceSlug: string;
  canSubmit: boolean;
  store: UploadManagerStore;
};

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

export function UploadManagerProvider({ workspaceSlug, canSubmit, children }: UploadManagerProviderProps): React.ReactElement {
  const store = getUploadManagerStore();
  const value = useMemo<UploadManagerContextValue>(() => ({ workspaceSlug, canSubmit, store }), [workspaceSlug, canSubmit, store]);
  return <UploadManagerContext.Provider value={value}>{children}</UploadManagerContext.Provider>;
}

function useUploadManagerContext(): UploadManagerContextValue {
  const value = useContext(UploadManagerContext);
  if (!value) {
    throw new Error("UploadManagerProvider must wrap workspace shell consumers before they can read upload manager state");
  }
  return value;
}

export function useUploadManagerWorkspaceSlug(): string {
  return useUploadManagerContext().workspaceSlug;
}

export function useUploadManagerCanSubmit(): boolean {
  return useUploadManagerContext().canSubmit;
}

// Subscribe to the current workspace's items. The snapshot is the
// only thing that re-renders when other workspaces mutate, so it is
// safe to mount this hook in tray cells without measurement noise.
export function useUploadManagerItems(): UploadManagerItem[] {
  const { workspaceSlug, store } = useUploadManagerContext();
  return useSyncExternalStore(
    (listener) => store.subscribe(workspaceSlug, listener),
    () => store.getSnapshot(workspaceSlug),
    () => store.getServerSnapshot(),
  );
}

export function useUploadManagerStore(): UploadManagerStore {
  return useUploadManagerContext().store;
}
