"use client";

// Polling controller for transcripts that the upload manager is
// currently following. Polling is owned at the module level — not
// inside a React effect — because submissions and rehydrated items
// must keep ticking even when the user navigates between workspace
// pages and the tray temporarily unmounts.
//
// The controller is intentionally narrow: callers ask `ensurePolling`
// with a `(workspaceSlug, transcriptId)` pair, and the controller
// guarantees one in-flight loop per transcript id, retries on
// transient errors, stops on terminal status, and refreshes the
// store via `updateServerStatus`. There is no per-call cancellation
// because the spec does not let users cancel an in-flight transcript
// from the tray (dismissal only applies to terminal items).

import { isTerminalServerPhase, type ServerProcessingPhase, type UploadManagerStore } from "./store";

const DEFAULT_POLL_INTERVAL_MS = 4_000;

type PollEntry = {
  workspaceSlug: string;
  intervalId: ReturnType<typeof setInterval> | null;
};

type StatusResponseBody =
  | {
      ok: true;
      transcript: {
        id: string;
        status: ServerProcessingPhase;
        title: string | null;
        failure: { code: string | null; summary: string | null } | null;
      };
    }
  | { ok: false; code: string; message: string };

class PollingController {
  private readonly entries = new Map<string, PollEntry>();
  private readonly store: UploadManagerStore;
  private readonly intervalMs: number;
  private readonly fetcher: typeof fetch;

  constructor(store: UploadManagerStore, options?: { intervalMs?: number; fetcher?: typeof fetch }) {
    this.store = store;
    this.intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.fetcher = options?.fetcher ?? ((input, init) => fetch(input, init));
  }

  // Begin polling the given transcript if we are not already. Safe
  // to call repeatedly — duplicate calls collapse into the first
  // entry. Calling for an already-terminal transcript is a no-op:
  // the first tick stops itself when it sees the terminal phase.
  ensurePolling(args: { workspaceSlug: string; transcriptId: string }): void {
    if (this.entries.has(args.transcriptId)) return;
    const entry: PollEntry = { workspaceSlug: args.workspaceSlug, intervalId: null };
    this.entries.set(args.transcriptId, entry);
    void this.tick(args.transcriptId);
    entry.intervalId = setInterval(() => {
      void this.tick(args.transcriptId);
    }, this.intervalMs);
  }

  // Hard-stop polling for a transcript. Called automatically when
  // the worker reports a terminal status; tests use it to assert the
  // controller cleans up after itself.
  stop(transcriptId: string): void {
    const entry = this.entries.get(transcriptId);
    if (!entry) return;
    if (entry.intervalId !== null) {
      clearInterval(entry.intervalId);
    }
    this.entries.delete(transcriptId);
  }

  // Test-only escape hatch matching the store's reset.
  __resetForTests(): void {
    for (const entry of this.entries.values()) {
      if (entry.intervalId !== null) {
        clearInterval(entry.intervalId);
      }
    }
    this.entries.clear();
  }

  private async tick(transcriptId: string): Promise<void> {
    const entry = this.entries.get(transcriptId);
    if (!entry) return;
    const url = `/api/workspaces/${encodeURIComponent(entry.workspaceSlug)}/meetings/${encodeURIComponent(transcriptId)}/status`;
    let payload: StatusResponseBody | null = null;
    try {
      const response = await this.fetcher(url, { credentials: "same-origin" });
      payload = (await response.json().catch(() => null)) as StatusResponseBody | null;
    } catch {
      payload = null;
    }
    if (!payload) {
      // Network or parse error — keep the loop ticking so the next
      // interval retries. The store still shows the last known phase.
      return;
    }
    if (payload.ok === false) {
      // The server refused the read (workspace archived, access
      // denied, not found). We cannot recover from these by retrying,
      // so stop the loop to avoid hammering the API. The tray keeps
      // the last known phase.
      this.stop(transcriptId);
      return;
    }
    this.store.updateServerStatus(transcriptId, {
      phase: payload.transcript.status,
      title: payload.transcript.title,
      failureSummary: payload.transcript.failure?.summary ?? null,
    });
    if (isTerminalServerPhase(payload.transcript.status)) {
      this.stop(transcriptId);
    }
  }
}

let SINGLETON: PollingController | null = null;

export function getUploadStatusPollingController(store: UploadManagerStore): PollingController {
  if (!SINGLETON) {
    SINGLETON = new PollingController(store);
  }
  return SINGLETON;
}

// Test-only: replace the singleton with a controller built from the
// supplied options. Tests reset both the store and the controller
// before/after each case so polling intervals never leak.
export function __setUploadStatusPollingControllerForTests(controller: PollingController | null): void {
  if (SINGLETON) {
    SINGLETON.__resetForTests();
  }
  SINGLETON = controller;
}

export { PollingController };
