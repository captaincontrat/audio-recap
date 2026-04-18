import "server-only";

import type { WorkspaceRole } from "@/lib/server/db/schema";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { findTranscriptDetailForWorkspace } from "../queries";

import { RESUME_RECONNECT_WINDOW_MS, SESSION_EXPIRY_MS } from "./constants";
import { SessionRefusedError } from "./errors";
import { acquireLock, inspectLock, releaseLock, renewLock, type StoredLock } from "./locks";
import { type MarkdownSavePatch, persistMarkdownSave } from "./persistence";
import { evaluateAutosave, evaluateEnterSession, evaluateResumeSession } from "./session-decisions";

// Service layer composing the pure decision logic with the Redis lock
// primitives and the transcript persistence helpers. API handlers call
// through here; tests that want to exercise pure rules import the
// decision functions directly.

export type EditSessionContext = {
  transcriptId: string;
  lockToken: string;
  expiresAt: string;
  reconnectWindowMs: number;
  transcript: {
    id: string;
    workspaceId: string;
    transcriptMarkdown: string;
    recapMarkdown: string;
    updatedAt: string;
  };
};

export type EnterSessionInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  tabId: string;
  now?: Date;
};

// Enter a fresh edit session, or resume an existing one when the
// client presents the same tab identity. Callers MUST pass a
// tab-scoped identity that survives a same-tab reload - the server
// uses it to tell "accidental refresh" apart from "second concurrent
// tab attempting to bypass the one-session rule".
export async function enterEditSession(inputs: EnterSessionInputs): Promise<EditSessionContext> {
  const now = inputs.now ?? new Date();
  const { workspaceRow, role } = await resolveWorkspace(inputs);

  const transcriptRow = await findTranscriptDetailForWorkspace({ transcriptId: inputs.transcriptId, workspaceId: workspaceRow.id });
  if (!transcriptRow) {
    throw new SessionRefusedError("not_found");
  }

  const existing = await inspectLock(inputs.transcriptId);
  const decision = evaluateEnterSession({
    role,
    workspaceActive: isWorkspaceActive(workspaceRow),
    activeSession: existing ? { tabId: existing.tabId, userId: existing.userId } : null,
    requestingTabId: inputs.tabId,
  });

  switch (decision.kind) {
    case "accepted": {
      const acquired = await acquireLock({
        transcriptId: inputs.transcriptId,
        workspaceId: workspaceRow.id,
        userId: inputs.userId,
        tabId: inputs.tabId,
        now: now.getTime(),
      });
      if (acquired.kind === "conflict") {
        // Concurrent acquire - report the same refusal the decision
        // logic would have reached if we had read the lock a moment
        // later.
        throw new SessionRefusedError("already_locked");
      }
      return toContext(acquired.lock, transcriptRow);
    }
    case "resume": {
      // Same-tab re-entry without going through the explicit resume
      // endpoint: renew the heartbeat so the 10-second window stays
      // open and hand back the existing lock token.
      const renewed = await renewLock({ transcriptId: inputs.transcriptId, lockToken: existing?.lockToken ?? "", now: now.getTime() });
      if (!renewed) {
        throw new SessionRefusedError("session_expired");
      }
      return toContext(renewed, transcriptRow);
    }
    case "refused": {
      throw new SessionRefusedError(decision.reason);
    }
    default: {
      const exhaustive: never = decision;
      throw new Error(`Unhandled enter-session decision: ${String(exhaustive)}`);
    }
  }
}

export type ResumeSessionInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  tabId: string;
  now?: Date;
};

// Resume a previously acquired edit session from a same-tab browser
// reload. Returns the updated session context (including the freshly
// heart-beaten expiry) alongside the last successfully saved
// transcript + recap markdown so the editor can reload the canonical
// content instead of trusting stale client state.
export async function resumeEditSession(inputs: ResumeSessionInputs): Promise<EditSessionContext> {
  const now = inputs.now ?? new Date();
  const { workspaceRow } = await resolveWorkspace(inputs);

  const transcriptRow = await findTranscriptDetailForWorkspace({ transcriptId: inputs.transcriptId, workspaceId: workspaceRow.id });
  if (!transcriptRow) {
    throw new SessionRefusedError("not_found");
  }

  const existing = await inspectLock(inputs.transcriptId);
  const decision = evaluateResumeSession({
    workspaceActive: isWorkspaceActive(workspaceRow),
    activeSession: existing ? { tabId: existing.tabId, userId: existing.userId } : null,
    requestingTabId: inputs.tabId,
    requestingUserId: inputs.userId,
    lastHeartbeatAt: existing?.lastHeartbeatAt ?? null,
    now: now.getTime(),
  });

  if (decision.kind === "refused") {
    throw new SessionRefusedError(decision.reason);
  }

  // `existing` is non-null when the decision resolved to "resumed"
  // because the decision logic guards on it above. The renew call
  // still protects against a concurrent caller that invalidated the
  // lock between `inspectLock` and here.
  const renewed = await renewLock({ transcriptId: inputs.transcriptId, lockToken: existing?.lockToken ?? "", now: now.getTime() });
  if (!renewed) {
    throw new SessionRefusedError("session_expired");
  }
  return toContext(renewed, transcriptRow);
}

export type AutosaveInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  tabId: string;
  lockToken: string;
  patch: MarkdownSavePatch;
  now?: Date;
};

export type AutosaveResult = EditSessionContext;

// Apply an autosave. Validates the session is still alive, persists
// the markdown patch, and renews the lock so the 20-minute expiry
// window is measured from this successful save. Callers can react to
// a `session_expired` refusal by exiting edit mode and showing the
// explicit expired-session message required by the spec.
export async function autosaveMarkdown(inputs: AutosaveInputs): Promise<AutosaveResult> {
  const now = inputs.now ?? new Date();
  const { workspaceRow } = await resolveWorkspace(inputs);

  const existing = await inspectLock(inputs.transcriptId);
  const decision = evaluateAutosave({
    workspaceActive: isWorkspaceActive(workspaceRow),
    activeSession: existing
      ? { tabId: existing.tabId, userId: existing.userId, lockToken: existing.lockToken, lastHeartbeatAt: existing.lastHeartbeatAt }
      : null,
    requestingTabId: inputs.tabId,
    requestingUserId: inputs.userId,
    requestingLockToken: inputs.lockToken,
    now: now.getTime(),
  });
  if (decision.kind === "refused") {
    throw new SessionRefusedError(decision.reason);
  }

  const saved = await persistMarkdownSave({
    transcriptId: inputs.transcriptId,
    workspaceId: workspaceRow.id,
    patch: inputs.patch,
    now,
  });
  if (!saved) {
    // The transcript disappeared or belongs to a different
    // workspace. Release the lock so follow-up autosaves from the
    // same tab do not keep hitting this path.
    await releaseLock({ transcriptId: inputs.transcriptId, force: true });
    throw new SessionRefusedError("not_found");
  }

  const renewed = await renewLock({ transcriptId: inputs.transcriptId, lockToken: inputs.lockToken, now: now.getTime() });
  if (!renewed) {
    // A concurrent release (e.g. archive side effect) happened
    // between the save and the renew. Report the expiry so the
    // client exits edit mode.
    throw new SessionRefusedError("session_expired");
  }
  return toContext(renewed, saved);
}

export type ExitSessionInputs = {
  workspaceSlug: string;
  userId: string;
  transcriptId: string;
  lockToken: string;
};

// Release a lock explicitly when the user leaves edit mode. Errors
// are swallowed so the client's "I am done" signal is best-effort -
// the TTL will clear any stragglers.
export async function exitEditSession(inputs: ExitSessionInputs): Promise<void> {
  try {
    await resolveWorkspace(inputs);
  } catch (error) {
    if (error instanceof SessionRefusedError && (error.reason === "access_denied" || error.reason === "not_found" || error.reason === "workspace_archived")) {
      // Still release the lock optimistically - the caller cannot
      // tell whether they should have access, but if they previously
      // held a valid token we should not hold their lock hostage.
    } else {
      throw error;
    }
  }
  await releaseLock({ transcriptId: inputs.transcriptId, lockToken: inputs.lockToken });
}

type WorkspaceResolution = { workspaceRow: Awaited<ReturnType<typeof resolveWorkspaceContextFromSlug>>["workspace"]; role: WorkspaceRole };

async function resolveWorkspace(inputs: { workspaceSlug: string; userId: string }): Promise<WorkspaceResolution> {
  try {
    const context = await resolveWorkspaceContextFromSlug({ slug: inputs.workspaceSlug, userId: inputs.userId });
    return { workspaceRow: context.workspace, role: context.role };
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new SessionRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new SessionRefusedError("access_denied");
    }
    throw error;
  }
}

function toContext(
  lock: StoredLock,
  transcript: {
    id: string;
    workspaceId: string;
    transcriptMarkdown: string;
    recapMarkdown: string;
    updatedAt: Date;
  },
): EditSessionContext {
  const expiresAt = new Date(lock.lastHeartbeatAt + SESSION_EXPIRY_MS).toISOString();
  return {
    transcriptId: lock.transcriptId,
    lockToken: lock.lockToken,
    expiresAt,
    reconnectWindowMs: RESUME_RECONNECT_WINDOW_MS,
    transcript: {
      id: transcript.id,
      workspaceId: transcript.workspaceId,
      transcriptMarkdown: transcript.transcriptMarkdown,
      recapMarkdown: transcript.recapMarkdown,
      updatedAt: transcript.updatedAt.toISOString(),
    },
  };
}
