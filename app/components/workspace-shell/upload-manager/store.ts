"use client";

// Workspace-keyed client store backing the shell's upload manager.
// Items live in a module-level singleton — not in React state — so
// they survive cross-workspace navigation that re-mounts the
// per-slug shell layout. Each item carries two layers of state per
// the design:
//   - local submission phase: `draft`, `preparing`, `uploading`,
//     `finalizing`, `local_error`. The `draft` phase is the
//     drop-then-confirm handoff itself.
//   - server transcript-processing phase: `queued`, `preprocessing`,
//     `transcribing`, `generating_recap`, `generating_title`,
//     `finalizing`, `retrying`, `completed`, `failed`.
//
// Items created in the current browser session begin with a local
// phase and transition to a server phase as soon as
// `submitMeeting()` returns a transcript id. Items rehydrated from
// the workspace's non-terminal transcripts on shell mount start
// directly in a server phase. Both kinds are merged by transcript id
// so the tray never shows two rows for the same record.
//
// Reads are scoped: every accessor takes a `workspaceSlug` so
// consumers inside the shell only ever see items for the current
// workspace, even though items for other workspaces remain in the
// singleton.

export type LocalSubmissionPhase = "draft" | "preparing" | "uploading" | "finalizing" | "local_error";

export type ServerProcessingPhase =
  | "queued"
  | "preprocessing"
  | "transcribing"
  | "generating_recap"
  | "generating_title"
  | "finalizing"
  | "retrying"
  | "completed"
  | "failed";

const TERMINAL_SERVER_PHASES: ReadonlySet<ServerProcessingPhase> = new Set<ServerProcessingPhase>(["completed", "failed"]);

export function isTerminalServerPhase(phase: ServerProcessingPhase): boolean {
  return TERMINAL_SERVER_PHASES.has(phase);
}

export type UploadManagerSource = "in_session" | "rehydrated";

// Per-item shape. `file` only ever exists for in-session items while
// they are still in a local submission phase — we drop the reference
// once the upload completes so we are not pinning blob memory for
// the rest of the session. `transcriptId` is the merge key shared
// with rehydrated items.
export type UploadManagerItem = {
  id: string;
  workspaceSlug: string;
  source: UploadManagerSource;
  file: File | null;
  fileName: string;
  fileSize: number;
  notes: string;
  transcriptId: string | null;
  localPhase: LocalSubmissionPhase | null;
  serverPhase: ServerProcessingPhase | null;
  errorCode: string | null;
  errorMessage: string | null;
  title: string | null;
  failureSummary: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RehydratedTranscriptStatus = {
  id: string;
  status: ServerProcessingPhase;
  title: string | null;
  failureSummary: string | null;
  sourceMediaKind: "audio" | "video";
  createdAt: string;
  updatedAt: string;
};

type Listener = () => void;

type WorkspaceState = {
  items: UploadManagerItem[];
};

// Internal store. Single instance per browser tab. Tests get a
// fresh instance through `__resetUploadManagerStoreForTests` so they
// do not leak items across cases.
class UploadManagerStore {
  private workspaces = new Map<string, WorkspaceState>();
  private listeners = new Map<string, Set<Listener>>();
  private readonly globalListeners = new Set<Listener>();
  private idCounter = 0;

  subscribe(workspaceSlug: string, listener: Listener): () => void {
    let bucket = this.listeners.get(workspaceSlug);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(workspaceSlug, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket?.delete(listener);
    };
  }

  // Snapshot accessor for `useSyncExternalStore`. Returns a stable
  // reference — the array identity only changes when the workspace's
  // items mutate.
  getSnapshot(workspaceSlug: string): UploadManagerItem[] {
    const state = this.workspaces.get(workspaceSlug);
    return state ? state.items : EMPTY_ITEMS;
  }

  // SSR fallback: an empty list. The store is client-only but the
  // shell renders during SSR; React's `useSyncExternalStore` insists
  // on a server snapshot.
  getServerSnapshot(): UploadManagerItem[] {
    return EMPTY_ITEMS;
  }

  // Add a fresh draft from a drop or a header upload selection.
  // Returns the new item's id so the caller can pre-focus the notes
  // input.
  addDraft(input: { workspaceSlug: string; file: File }): string {
    const id = this.allocateId("draft");
    const now = Date.now();
    const item: UploadManagerItem = {
      id,
      workspaceSlug: input.workspaceSlug,
      source: "in_session",
      file: input.file,
      fileName: input.file.name,
      fileSize: input.file.size,
      notes: "",
      transcriptId: null,
      localPhase: "draft",
      serverPhase: null,
      errorCode: null,
      errorMessage: null,
      title: null,
      failureSummary: null,
      createdAt: now,
      updatedAt: now,
    };
    this.append(input.workspaceSlug, item);
    return id;
  }

  // The draft notes input updates the item in place — we never need
  // to keep a separate "uncommitted notes" buffer.
  updateDraftNotes(id: string, notes: string): void {
    this.patchItem(id, (item) => {
      if (item.localPhase !== "draft") return item;
      return { ...item, notes, updatedAt: Date.now() };
    });
  }

  // Drop a draft from the tray without uploading anything. The store
  // also exposes this for the cancellation handler used by the local
  // "delete this row" affordance, but only `draft`-phase items are
  // valid to cancel.
  cancelDraft(id: string): void {
    const item = this.findItem(id);
    if (!item || item.localPhase !== "draft") return;
    this.removeItem(id);
  }

  // Mark a draft as having begun submission. The next phase
  // transitions are owned by the submission orchestrator that calls
  // `submitMeeting()` — it walks `preparing` → `uploading` →
  // `finalizing` and finally moves the item onto the server phase
  // once a transcript id exists.
  beginSubmission(id: string): UploadManagerItem | null {
    let result: UploadManagerItem | null = null;
    this.patchItem(id, (item) => {
      if (item.localPhase !== "draft") return item;
      const next: UploadManagerItem = {
        ...item,
        localPhase: "preparing",
        errorCode: null,
        errorMessage: null,
        updatedAt: Date.now(),
      };
      result = next;
      return next;
    });
    return result;
  }

  setLocalPhase(id: string, phase: LocalSubmissionPhase): void {
    this.patchItem(id, (item) => {
      if (item.serverPhase !== null) return item;
      return { ...item, localPhase: phase, updatedAt: Date.now() };
    });
  }

  setLocalError(id: string, errorCode: string, errorMessage: string): void {
    this.patchItem(id, (item) => ({
      ...item,
      localPhase: "local_error",
      errorCode,
      errorMessage,
      file: null,
      updatedAt: Date.now(),
    }));
  }

  // Move an item from local-phase tracking to server-phase tracking
  // once `submitMeeting()` returns a transcript id. The file blob is
  // released here so we are not pinning multi-hundred-megabyte uploads
  // in memory after the upload completes.
  attachTranscriptId(id: string, transcriptId: string, initialServerPhase: ServerProcessingPhase): void {
    this.patchItem(id, (item) => ({
      ...item,
      transcriptId,
      localPhase: null,
      serverPhase: initialServerPhase,
      file: null,
      errorCode: null,
      errorMessage: null,
      updatedAt: Date.now(),
    }));
  }

  // Update the displayed server phase from a polling response. Also
  // captures the worker-supplied title (so the tray can read like the
  // dedicated status page) and the failure summary on terminal
  // failure.
  updateServerStatus(transcriptId: string, update: { phase: ServerProcessingPhase; title: string | null; failureSummary: string | null }): void {
    this.patchItemBy(
      (item) => item.transcriptId === transcriptId,
      (item) => ({
        ...item,
        serverPhase: update.phase,
        localPhase: null,
        title: update.title ?? item.title,
        failureSummary: update.failureSummary,
        updatedAt: Date.now(),
      }),
    );
  }

  // Client-only dismissal. Spec is explicit: dismissal MUST NOT
  // delete the underlying transcript record. Only terminal items
  // (completed / failed) and `local_error` items are dismissible —
  // the in-flight phases stay pinned so the user does not lose track
  // of work that is still happening.
  dismiss(id: string): void {
    const item = this.findItem(id);
    if (!item) return;
    if (item.serverPhase !== null && !isTerminalServerPhase(item.serverPhase)) return;
    if (item.localPhase !== null && item.localPhase !== "local_error") return;
    this.removeItem(id);
  }

  // Merge a rehydration snapshot into the workspace's items.
  // Existing items keyed by transcript id are updated in place; new
  // transcript ids are appended as `rehydrated` items. In-session
  // items without a transcript id (still in local phases) are left
  // untouched so the user does not lose their drafts when rehydration
  // arrives.
  mergeRehydrated(workspaceSlug: string, rehydrated: RehydratedTranscriptStatus[]): void {
    if (rehydrated.length === 0) return;
    const state = this.ensureWorkspace(workspaceSlug);
    const indexByTranscript = new Map<string, number>();
    state.items.forEach((item, index) => {
      if (item.transcriptId) {
        indexByTranscript.set(item.transcriptId, index);
      }
    });
    const next = [...state.items];
    let mutated = false;
    for (const incoming of rehydrated) {
      const existingIndex = indexByTranscript.get(incoming.id);
      if (existingIndex !== undefined) {
        const existing = next[existingIndex]!;
        next[existingIndex] = {
          ...existing,
          serverPhase: incoming.status,
          localPhase: null,
          title: incoming.title ?? existing.title,
          failureSummary: incoming.failureSummary,
          updatedAt: Date.now(),
        };
        mutated = true;
        continue;
      }
      next.push({
        id: this.allocateId("rehydrated"),
        workspaceSlug,
        source: "rehydrated",
        file: null,
        fileName: incoming.title ?? "Meeting upload",
        fileSize: 0,
        notes: "",
        transcriptId: incoming.id,
        localPhase: null,
        serverPhase: incoming.status,
        errorCode: null,
        errorMessage: null,
        title: incoming.title,
        failureSummary: incoming.failureSummary,
        createdAt: new Date(incoming.createdAt).getTime(),
        updatedAt: new Date(incoming.updatedAt).getTime(),
      });
      mutated = true;
    }
    if (!mutated) return;
    state.items = next;
    this.notify(workspaceSlug);
  }

  findItem(id: string): UploadManagerItem | null {
    for (const state of this.workspaces.values()) {
      const found = state.items.find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  }

  // Test-only escape hatch. Production code never calls this —
  // helpers prefix it with `__` so accidental imports stand out in
  // review.
  __resetForTests(): void {
    this.workspaces.clear();
    this.listeners.clear();
    this.globalListeners.clear();
    this.idCounter = 0;
  }

  private append(workspaceSlug: string, item: UploadManagerItem): void {
    const state = this.ensureWorkspace(workspaceSlug);
    state.items = [...state.items, item];
    this.notify(workspaceSlug);
  }

  private removeItem(id: string): void {
    let removedSlug: string | null = null;
    for (const [slug, state] of this.workspaces.entries()) {
      const next = state.items.filter((item) => item.id !== id);
      if (next.length !== state.items.length) {
        state.items = next;
        removedSlug = slug;
        break;
      }
    }
    if (removedSlug) this.notify(removedSlug);
  }

  private patchItem(id: string, mutate: (item: UploadManagerItem) => UploadManagerItem): void {
    this.patchItemBy((item) => item.id === id, mutate);
  }

  private patchItemBy(predicate: (item: UploadManagerItem) => boolean, mutate: (item: UploadManagerItem) => UploadManagerItem): void {
    let mutatedSlug: string | null = null;
    for (const [slug, state] of this.workspaces.entries()) {
      const index = state.items.findIndex(predicate);
      if (index === -1) continue;
      const previous = state.items[index]!;
      const next = mutate(previous);
      if (next === previous) return;
      state.items = [...state.items.slice(0, index), next, ...state.items.slice(index + 1)];
      mutatedSlug = slug;
      break;
    }
    if (mutatedSlug) this.notify(mutatedSlug);
  }

  private ensureWorkspace(workspaceSlug: string): WorkspaceState {
    let state = this.workspaces.get(workspaceSlug);
    if (!state) {
      state = { items: [] };
      this.workspaces.set(workspaceSlug, state);
    }
    return state;
  }

  private notify(workspaceSlug: string): void {
    const bucket = this.listeners.get(workspaceSlug);
    if (bucket) {
      for (const listener of bucket) listener();
    }
  }

  private allocateId(prefix: string): string {
    this.idCounter += 1;
    return `upm_${prefix}_${this.idCounter}_${Date.now().toString(36)}`;
  }
}

const EMPTY_ITEMS: UploadManagerItem[] = Object.freeze([]) as unknown as UploadManagerItem[];

const SINGLETON = new UploadManagerStore();

export function getUploadManagerStore(): UploadManagerStore {
  return SINGLETON;
}

export type { UploadManagerStore };
