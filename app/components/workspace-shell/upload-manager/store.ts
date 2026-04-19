"use client";

// Workspace-keyed client store backing the shell's upload manager.
// Items live in a module-level singleton — not in React state — so
// they survive cross-workspace navigation that re-mounts the
// per-slug shell layout. Each item carries two layers of state per
// the design:
//   - local submission phase: `draft`, `normalizing`, `preparing`,
//     `uploading`, `finalizing`, `local_error`. The `draft` phase
//     is the drop-then-confirm handoff itself; `normalizing` is the
//     browser-side Mediabunny conversion to MP3 (potentially
//     long-running on large videos), and `preparing` covers the
//     short post-conversion `prepare` request that signs upload
//     URLs.
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

export type LocalSubmissionPhase = "draft" | "normalizing" | "preparing" | "uploading" | "finalizing" | "local_error";

// Local phases during which the user may still cancel the
// submission before any bytes leave the browser. Once the upload
// (`uploading`) starts, the cancel affordance is removed per the
// design — the conversion has already produced an MP3 and the
// presigned PUT is already in flight.
export const CANCELLABLE_LOCAL_PHASES: ReadonlySet<LocalSubmissionPhase> = new Set<LocalSubmissionPhase>(["normalizing", "preparing"]);

export function isCancellableLocalPhase(phase: LocalSubmissionPhase): boolean {
  return CANCELLABLE_LOCAL_PHASES.has(phase);
}

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
  // Determinate progress (`[0, 1]`) for the `normalizing` local phase
  // when Mediabunny emits it. `null` means "no progress reported yet"
  // — the tray and the dedicated form fall back to indeterminate
  // copy ("Converting to MP3…") in that case rather than hiding the
  // phase entirely. Resets to `null` when the phase advances.
  normalizationProgress: number | null;
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
  // Per-item AbortController held only while a submission is
  // mid-flight. The submission runner registers the controller before
  // calling `submitMeeting()`, the tray and the dedicated form trigger
  // `cancelInFlight(id)` when the user clicks Cancel during a
  // cancellable local phase, and the runner clears the entry on
  // success/failure. Holding the controller in the store (rather than
  // in a per-item React ref) lets the cancel UI live anywhere — the
  // tray, the dedicated form's footer button, future shortcuts —
  // without re-plumbing a callback through every consumer.
  private inFlightAborts = new Map<string, AbortController>();
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
      normalizationProgress: null,
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
  // `submitMeeting()` — it walks `normalizing` → `preparing` →
  // `uploading` → `finalizing` and finally moves the item onto the
  // server phase once a transcript id exists. We initialize at
  // `normalizing` because the runner immediately fires
  // `onNormalizing` as the first phase callback; setting it eagerly
  // here also guarantees the tray never shows a "between phases"
  // gap even if the very first microtask hasn't run yet.
  beginSubmission(id: string): UploadManagerItem | null {
    let result: UploadManagerItem | null = null;
    this.patchItem(id, (item) => {
      if (item.localPhase !== "draft") return item;
      const next: UploadManagerItem = {
        ...item,
        localPhase: "normalizing",
        normalizationProgress: null,
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
      // Reset the normalization progress when leaving the
      // `normalizing` phase so a stale `0.42` does not bleed into
      // the next phase's UI; we keep it intact while we're still in
      // `normalizing` so `setNormalizationProgress` can replace it.
      const normalizationProgress = phase === "normalizing" ? item.normalizationProgress : null;
      return { ...item, localPhase: phase, normalizationProgress, updatedAt: Date.now() };
    });
  }

  // Update the determinate progress reported by Mediabunny for the
  // `normalizing` phase. Silently no-ops outside that phase so a
  // late progress tick fired right before a phase advance cannot
  // resurrect a stale bar.
  setNormalizationProgress(id: string, progress: number): void {
    this.patchItem(id, (item) => {
      if (item.localPhase !== "normalizing") return item;
      // Clamp into [0, 1] defensively. Mediabunny's docs say the
      // value is in this range, but we never want a buggy provider
      // tick to push the bar past 100% or below 0%.
      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
      if (item.normalizationProgress === clamped) return item;
      return { ...item, normalizationProgress: clamped, updatedAt: Date.now() };
    });
  }

  setLocalError(id: string, errorCode: string, errorMessage: string): void {
    this.patchItem(id, (item) => ({
      ...item,
      localPhase: "local_error",
      errorCode,
      errorMessage,
      normalizationProgress: null,
      file: null,
      updatedAt: Date.now(),
    }));
  }

  // Register the AbortController owned by the submission runner so
  // any cancel affordance (tray Cancel button, dedicated form Cancel
  // button, future shortcuts) can abort the in-flight submission
  // without holding a direct reference to the runner.
  registerInFlightAbort(id: string, controller: AbortController): void {
    this.inFlightAborts.set(id, controller);
  }

  // Drop the registered controller without aborting it. Called by
  // the runner on success and on non-cancel failure paths so we do
  // not leak controllers across submissions.
  clearInFlightAbort(id: string): void {
    this.inFlightAborts.delete(id);
  }

  // Trigger the registered controller's `abort()`. Safe to call when
  // no controller is registered (e.g. the user clicked Cancel after
  // the runner already finished). Does NOT remove the item — the
  // runner's catch path is responsible for store cleanup so error
  // and cancellation outcomes flow through one place.
  cancelInFlight(id: string): void {
    const controller = this.inFlightAborts.get(id);
    if (controller) {
      controller.abort();
    }
  }

  // Drop a cancelled item from the tray entirely so the UI returns
  // to a non-error state (no `local_error` row, no failure copy).
  // The runner calls this only after a confirmed `AbortError` —
  // every other failure path goes through `setLocalError`.
  removeCancelledItem(id: string): void {
    this.inFlightAborts.delete(id);
    this.removeItem(id);
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
      normalizationProgress: null,
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
        normalizationProgress: null,
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
        normalizationProgress: null,
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
    this.inFlightAborts.clear();
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
