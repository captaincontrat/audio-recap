"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  autosaveEditSession,
  type EditSessionContext,
  EditSessionNetworkError,
  EditSessionRefusedError,
  enterEditSession,
  exitEditSession,
  resumeEditSession,
} from "./client";
import { AUTOSAVE_DEBOUNCE_MS, RESUME_RECONNECT_WINDOW_MS } from "./constants";
import { clearStoredTabSessionId, ensureTabSessionId, readStoredTabSessionId } from "./tab-identity";

// React hook that owns the client side of the edit session state
// machine. It keeps the `TranscriptDetailView` component focused on
// rendering by offering five high-level operations:
//
//   - `enter()`            - acquire the lock (tries same-tab resume
//                            first when a prior tab id is present)
//   - `setDraft()`         - record a change to the markdown fields;
//                            schedules an autosave after the debounce
//   - `saveNow()`          - flush any pending autosave immediately
//   - `exit()`             - release the lock and tear the hook down
//   - `errorDismiss()`     - let the UI clear transient error state
//
// The hook is deliberately non-optimistic about "unsaved drafts" - the
// spec forbids recovering local changes after a lock loss, so the
// client holds the only copy of an in-flight edit in memory and drops
// it if the server refuses the save. Refuses are surfaced as an
// `EditSessionRefusedError` with a stable `reason` the UI can map to
// explicit messages (the spec calls out the "your session expired"
// text).

export type EditDraft = {
  transcriptMarkdown: string;
  recapMarkdown: string;
};

export type EditSessionStatus =
  | { kind: "idle" }
  | { kind: "entering"; isResume: boolean }
  | { kind: "editing"; session: EditSessionContext; savedAt: number | null; pending: boolean }
  | { kind: "saving"; session: EditSessionContext; savedAt: number | null }
  | { kind: "exited"; reason: "user" | "expired" | "lost" | "archived" }
  | { kind: "error"; stage: "enter" | "autosave" | "exit"; message: string; reason?: string };

type Options = {
  workspaceSlug: string;
  transcriptId: string;
  canEdit: boolean;
  autosaveDebounceMs?: number;
};

type HookReturn = {
  status: EditSessionStatus;
  draft: EditDraft | null;
  enter(): Promise<void>;
  tryResume(): Promise<boolean>;
  setDraft(next: Partial<EditDraft>): void;
  saveNow(): Promise<void>;
  exit(): Promise<void>;
  dismissError(): void;
};

export function useEditSession(options: Options): HookReturn {
  const { workspaceSlug, transcriptId, canEdit } = options;
  const debounceMs = options.autosaveDebounceMs ?? AUTOSAVE_DEBOUNCE_MS;

  const [status, setStatus] = useState<EditSessionStatus>({ kind: "idle" });
  const [draft, setDraft] = useState<EditDraft | null>(null);

  // Refs keep the latest values available to the debounced save
  // callback without re-scheduling the debounce every keystroke.
  const sessionRef = useRef<EditSessionContext | null>(null);
  const draftRef = useRef<EditDraft | null>(null);
  const lastSavedRef = useRef<EditDraft | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const inFlightSaveRef = useRef(false);

  useEffect(
    () => () => {
      unmountedRef.current = true;
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    },
    [],
  );

  const transitionToExited = useCallback(
    (reason: EditSessionStatus extends { kind: "exited" } ? never : "user" | "expired" | "lost" | "archived") => {
      sessionRef.current = null;
      lastSavedRef.current = null;
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      clearStoredTabSessionId(transcriptId);
      if (!unmountedRef.current) {
        setStatus({ kind: "exited", reason });
        setDraft(null);
      }
    },
    [transcriptId],
  );

  const handleRefusal = useCallback(
    (error: EditSessionRefusedError, stage: "enter" | "autosave" | "exit") => {
      if (error.reason === "session_expired") {
        transitionToExited("expired");
        return;
      }
      if (error.reason === "workspace_archived") {
        transitionToExited("archived");
        return;
      }
      if (!unmountedRef.current) {
        setStatus({ kind: "error", stage, message: error.message, reason: error.reason });
      }
    },
    [transitionToExited],
  );

  const performAutosave = useCallback(async () => {
    const session = sessionRef.current;
    const pendingDraft = draftRef.current;
    const lastSaved = lastSavedRef.current;
    if (!session || !pendingDraft) return;
    if (inFlightSaveRef.current) return;

    const patch: Partial<Record<"transcriptMarkdown" | "recapMarkdown", string>> = {};
    if (!lastSaved || lastSaved.transcriptMarkdown !== pendingDraft.transcriptMarkdown) {
      patch.transcriptMarkdown = pendingDraft.transcriptMarkdown;
    }
    if (!lastSaved || lastSaved.recapMarkdown !== pendingDraft.recapMarkdown) {
      patch.recapMarkdown = pendingDraft.recapMarkdown;
    }
    if (Object.keys(patch).length === 0) return;

    inFlightSaveRef.current = true;
    if (!unmountedRef.current) {
      setStatus({ kind: "saving", session, savedAt: lastSaved ? Date.now() : null });
    }
    try {
      const next = await autosaveEditSession({
        workspaceSlug,
        transcriptId,
        tabId: sessionTabId(session),
        lockToken: session.lockToken,
        patch,
      });
      sessionRef.current = next;
      lastSavedRef.current = { ...pendingDraft };
      if (!unmountedRef.current) {
        setStatus({ kind: "editing", session: next, savedAt: Date.now(), pending: false });
      }
    } catch (err) {
      if (err instanceof EditSessionRefusedError) {
        handleRefusal(err, "autosave");
      } else if (err instanceof EditSessionNetworkError) {
        if (!unmountedRef.current) {
          setStatus({ kind: "error", stage: "autosave", message: err.message, reason: err.code });
        }
      } else {
        if (!unmountedRef.current) {
          setStatus({ kind: "error", stage: "autosave", message: "Unexpected error while saving" });
        }
      }
    } finally {
      inFlightSaveRef.current = false;
    }
  }, [handleRefusal, transcriptId, workspaceSlug]);

  const scheduleAutosave = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = setTimeout(() => {
      pendingTimeoutRef.current = null;
      void performAutosave();
    }, debounceMs);
  }, [debounceMs, performAutosave]);

  const acceptSession = useCallback((session: EditSessionContext) => {
    sessionRef.current = session;
    const seedDraft: EditDraft = {
      transcriptMarkdown: session.transcript.transcriptMarkdown,
      recapMarkdown: session.transcript.recapMarkdown,
    };
    draftRef.current = seedDraft;
    lastSavedRef.current = { ...seedDraft };
    if (!unmountedRef.current) {
      setDraft(seedDraft);
      setStatus({ kind: "editing", session, savedAt: null, pending: false });
    }
  }, []);

  const enter = useCallback(async () => {
    if (!canEdit) {
      setStatus({ kind: "error", stage: "enter", message: "You do not have permission to edit this transcript.", reason: "role_not_authorized" });
      return;
    }
    if (sessionRef.current) return;

    const storedTabId = readStoredTabSessionId(transcriptId);
    const tabId = ensureTabSessionId(transcriptId);
    const isResume = storedTabId === tabId;
    setStatus({ kind: "entering", isResume });

    try {
      const session = isResume
        ? await attemptResumeThenFreshEnter({ workspaceSlug, transcriptId, tabId })
        : await enterEditSession({ workspaceSlug, transcriptId, tabId });
      acceptSession(session);
    } catch (err) {
      if (err instanceof EditSessionRefusedError) {
        handleRefusal(err, "enter");
      } else if (err instanceof EditSessionNetworkError) {
        if (!unmountedRef.current) {
          setStatus({ kind: "error", stage: "enter", message: err.message, reason: err.code });
        }
      } else {
        if (!unmountedRef.current) {
          setStatus({ kind: "error", stage: "enter", message: "Unexpected error while opening the edit session." });
        }
      }
    }
  }, [acceptSession, canEdit, handleRefusal, transcriptId, workspaceSlug]);

  // Passive resume-on-mount: if the tab already has a stored identity
  // from an earlier session we ask the server to resume *before*
  // prompting the user to click "Edit". Returns `true` when the resume
  // succeeded and the hook is back in `editing`, `false` otherwise
  // (missing identity, expired lock, different tab). Callers keep the
  // user on the read-only view when this returns `false`.
  const tryResume = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (sessionRef.current) return true;
    const storedTabId = readStoredTabSessionId(transcriptId);
    if (!storedTabId) return false;

    setStatus({ kind: "entering", isResume: true });
    try {
      const session = await resumeEditSession({ workspaceSlug, transcriptId, tabId: storedTabId });
      acceptSession(session);
      return true;
    } catch (err) {
      if (err instanceof EditSessionRefusedError) {
        // A non-resumable refusal (window elapsed, different user,
        // archived workspace, etc.) leaves the hook in `idle` so the
        // UI stays on the read-only view rather than showing an error
        // the user cannot act on. Explicit entry via the "Edit"
        // button will surface any hard refusal through
        // `handleRefusal` next time.
        if (err.reason === "session_expired" || err.reason === "already_locked" || err.reason === "not_found" || err.reason === "access_denied") {
          clearStoredTabSessionId(transcriptId);
          if (!unmountedRef.current) {
            setStatus({ kind: "idle" });
          }
          return false;
        }
        handleRefusal(err, "enter");
        return false;
      }
      if (!unmountedRef.current) {
        setStatus({ kind: "idle" });
      }
      return false;
    }
  }, [acceptSession, canEdit, handleRefusal, transcriptId, workspaceSlug]);

  const setDraftField = useCallback(
    (next: Partial<EditDraft>) => {
      const current = draftRef.current;
      if (!current) return;
      const merged: EditDraft = {
        transcriptMarkdown: next.transcriptMarkdown ?? current.transcriptMarkdown,
        recapMarkdown: next.recapMarkdown ?? current.recapMarkdown,
      };
      draftRef.current = merged;
      if (!unmountedRef.current) {
        setDraft(merged);
        const session = sessionRef.current;
        if (session) {
          setStatus({ kind: "editing", session, savedAt: lastSavedRef.current ? Date.now() : null, pending: true });
        }
      }
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const saveNow = useCallback(async () => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    await performAutosave();
  }, [performAutosave]);

  const exit = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      transitionToExited("user");
      return;
    }
    // Flush any pending save first so the final content is on disk
    // before we drop the lock. If the flush fails we still try the
    // release so a stuck lock eventually hits the TTL instead of the
    // release path.
    try {
      await saveNow();
    } catch {
      // Ignore - error is already reflected in `status`.
    }
    try {
      await exitEditSession({ workspaceSlug, transcriptId, lockToken: session.lockToken });
    } catch (err) {
      if (err instanceof EditSessionRefusedError) {
        handleRefusal(err, "exit");
        return;
      }
      // Best-effort release; TTL will pick up the slack. The UI still
      // returns to read-only mode because the user asked to exit.
    }
    transitionToExited("user");
  }, [handleRefusal, saveNow, transcriptId, transitionToExited, workspaceSlug]);

  const dismissError = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      setStatus({ kind: "editing", session, savedAt: lastSavedRef.current ? Date.now() : null, pending: false });
      return;
    }
    setStatus({ kind: "idle" });
  }, []);

  return {
    status,
    draft,
    enter,
    tryResume,
    setDraft: setDraftField,
    saveNow,
    exit,
    dismissError,
  };
}

// Helper around the `attempt resume → fall back to fresh enter` flow
// the spec requires. If the server replies that the earlier session
// is gone (`already_locked` from another tab or `session_expired`
// because the TTL ran out), we clear the stored tab id and ask the
// caller to retry - but keeping this inside the hook means the UI
// does not see a transient refusal flicker.
async function attemptResumeThenFreshEnter(args: { workspaceSlug: string; transcriptId: string; tabId: string }): Promise<EditSessionContext> {
  try {
    return await resumeEditSession(args);
  } catch (err) {
    if (err instanceof EditSessionRefusedError && err.reason === "session_expired") {
      // The server confirms there is no live session to resume.
      // Clear the tab id so the fresh enter issues a new one and
      // acquires from scratch.
      clearStoredTabSessionId(args.transcriptId);
      const freshTabId = ensureTabSessionId(args.transcriptId);
      return await enterEditSession({ ...args, tabId: freshTabId });
    }
    throw err;
  }
}

// Extract the tab id the session was opened with. We carry it on the
// `sessionStorage` key directly so the hook does not need to remember
// it in its own state; reading it here keeps the autosave path short
// even when the session ref is the only source of truth for the lock
// token.
function sessionTabId(session: EditSessionContext): string {
  return readStoredTabSessionId(session.transcriptId) ?? ensureTabSessionId(session.transcriptId);
}

export const __internal = { RESUME_RECONNECT_WINDOW_MS };
