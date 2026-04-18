import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The module mocks live at the top of the file so Vitest hoists them
// before the first import of `use-edit-session` below. Each test
// resets the mocks and the sessionStorage tab-identity store so state
// does not leak between cases.
vi.mock("@/lib/client/edit-sessions/client", () => ({
  EditSessionNetworkError: class EditSessionNetworkError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "EditSessionNetworkError";
    }
  },
  EditSessionRefusedError: class EditSessionRefusedError extends Error {
    readonly reason: string;
    readonly status: number;
    constructor(reason: string, status: number, message: string) {
      super(message);
      this.reason = reason;
      this.status = status;
      this.name = "EditSessionRefusedError";
    }
  },
  enterEditSession: vi.fn(),
  resumeEditSession: vi.fn(),
  autosaveEditSession: vi.fn(),
  exitEditSession: vi.fn(),
}));

import * as client from "@/lib/client/edit-sessions/client";
import { clearStoredTabSessionId, ensureTabSessionId } from "@/lib/client/edit-sessions/tab-identity";
import { useEditSession } from "@/lib/client/edit-sessions/use-edit-session";

const { EditSessionRefusedError, EditSessionNetworkError } = client;

type Mocked = typeof client & {
  enterEditSession: ReturnType<typeof vi.fn>;
  resumeEditSession: ReturnType<typeof vi.fn>;
  autosaveEditSession: ReturnType<typeof vi.fn>;
  exitEditSession: ReturnType<typeof vi.fn>;
};
const mocks = client as Mocked;

const SLUG = "ws-slug";
const TRANSCRIPT = "transcript-one";

// Real-time helper; the hook's autosave debounce uses `setTimeout`, so
// we stick with real timers and tiny debounce windows rather than fake
// timers (which do not interleave cleanly with `@testing-library`'s
// `waitFor`).
async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function makeContext(overrides: Partial<client.EditSessionContext> = {}): client.EditSessionContext {
  return {
    transcriptId: TRANSCRIPT,
    lockToken: "lock_test_token",
    expiresAt: new Date("2026-01-01T00:20:00Z").toISOString(),
    reconnectWindowMs: 10_000,
    transcript: {
      id: TRANSCRIPT,
      workspaceId: "workspace-id",
      transcriptMarkdown: "initial transcript",
      recapMarkdown: "initial recap",
      updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    },
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.enterEditSession.mockReset();
  mocks.resumeEditSession.mockReset();
  mocks.autosaveEditSession.mockReset();
  mocks.exitEditSession.mockReset();
});

afterEach(() => {
  clearStoredTabSessionId(TRANSCRIPT);
});

describe("useEditSession", () => {
  test("role-gated UI: read-only callers see a permission error on enter", async () => {
    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: false }));

    await act(async () => {
      await result.current.enter();
    });

    expect(mocks.enterEditSession).not.toHaveBeenCalled();
    expect(result.current.status).toMatchObject({ kind: "error", stage: "enter", reason: "role_not_authorized" });
  });

  test("fresh enter populates the draft from the server response", async () => {
    const ctx = makeContext();
    mocks.enterEditSession.mockResolvedValueOnce(ctx);

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });

    expect(mocks.enterEditSession).toHaveBeenCalledWith(expect.objectContaining({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT }));
    expect(result.current.status.kind).toBe("editing");
    expect(result.current.draft).toEqual({ transcriptMarkdown: "initial transcript", recapMarkdown: "initial recap" });
  });

  test("a server already_locked refusal surfaces the reason on enter", async () => {
    mocks.enterEditSession.mockRejectedValueOnce(new EditSessionRefusedError("already_locked", 409, "busy"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });

    expect(result.current.status).toMatchObject({ kind: "error", stage: "enter", reason: "already_locked" });
  });

  test("a network error during enter is reported with the code", async () => {
    mocks.enterEditSession.mockRejectedValueOnce(new EditSessionNetworkError("network_error", "offline"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });

    expect(result.current.status).toMatchObject({ kind: "error", stage: "enter", reason: "network_error" });
  });

  test("tryResume uses the stored tab id and transitions to editing on success", async () => {
    ensureTabSessionId(TRANSCRIPT);
    const ctx = makeContext({
      transcript: { ...makeContext().transcript, transcriptMarkdown: "resumed", recapMarkdown: "resumed recap" },
    });
    mocks.resumeEditSession.mockResolvedValueOnce(ctx);

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    let resumed = false;
    await act(async () => {
      resumed = await result.current.tryResume();
    });

    expect(resumed).toBe(true);
    expect(mocks.resumeEditSession).toHaveBeenCalled();
    expect(result.current.status.kind).toBe("editing");
    expect(result.current.draft?.transcriptMarkdown).toBe("resumed");
  });

  test("tryResume returns false and stays idle when no tab id is stored", async () => {
    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    let resumed = true;
    await act(async () => {
      resumed = await result.current.tryResume();
    });
    expect(resumed).toBe(false);
    expect(mocks.resumeEditSession).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  test("tryResume falls back to idle on session_expired and clears the stored identity", async () => {
    ensureTabSessionId(TRANSCRIPT);
    mocks.resumeEditSession.mockRejectedValueOnce(new EditSessionRefusedError("session_expired", 410, "stale"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    let resumed = true;
    await act(async () => {
      resumed = await result.current.tryResume();
    });
    expect(resumed).toBe(false);
    expect(result.current.status).toEqual({ kind: "idle" });
    expect(window.sessionStorage.getItem(`transcript-edit-session:tab:${TRANSCRIPT}`)).toBeNull();
  });

  test("setDraft triggers autosave after the debounce window and renews the session", async () => {
    const ctx = makeContext();
    mocks.enterEditSession.mockResolvedValueOnce(ctx);
    const renewed = makeContext({ lockToken: "lock_renewed_token" });
    mocks.autosaveEditSession.mockResolvedValueOnce(renewed);

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true, autosaveDebounceMs: 5 }));

    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.status.kind).toBe("editing");

    act(() => {
      result.current.setDraft({ recapMarkdown: "edited recap" });
    });
    expect(mocks.autosaveEditSession).not.toHaveBeenCalled();

    await act(async () => {
      await wait(25);
    });

    expect(mocks.autosaveEditSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSlug: SLUG,
        transcriptId: TRANSCRIPT,
        lockToken: ctx.lockToken,
        patch: { recapMarkdown: "edited recap" },
      }),
    );
    await waitFor(() => {
      expect(result.current.status.kind).toBe("editing");
    });
    if (result.current.status.kind === "editing") {
      expect(result.current.status.session.lockToken).toBe("lock_renewed_token");
      expect(result.current.status.pending).toBe(false);
    }
  });

  test("a session_expired autosave forces the hook into the exited state", async () => {
    mocks.enterEditSession.mockResolvedValueOnce(makeContext());
    mocks.autosaveEditSession.mockRejectedValueOnce(new EditSessionRefusedError("session_expired", 410, "expired"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true, autosaveDebounceMs: 5 }));

    await act(async () => {
      await result.current.enter();
    });

    act(() => {
      result.current.setDraft({ transcriptMarkdown: "late edit" });
    });

    await act(async () => {
      await wait(25);
    });

    await waitFor(() => {
      expect(result.current.status.kind).toBe("exited");
    });
    if (result.current.status.kind === "exited") {
      expect(result.current.status.reason).toBe("expired");
    }
    expect(result.current.draft).toBeNull();
  });

  test("exit releases the lock and transitions to the user-exited state", async () => {
    const ctx = makeContext();
    mocks.enterEditSession.mockResolvedValueOnce(ctx);
    mocks.exitEditSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));

    await act(async () => {
      await result.current.enter();
    });

    await act(async () => {
      await result.current.exit();
    });

    expect(mocks.exitEditSession).toHaveBeenCalledWith(expect.objectContaining({ lockToken: ctx.lockToken }));
    expect(result.current.status).toEqual({ kind: "exited", reason: "user" });
  });

  test("exit before any entry still lands on exited", async () => {
    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.exit();
    });
    expect(mocks.exitEditSession).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "exited", reason: "user" });
  });

  test("dismissError returns to editing when a session is still held", async () => {
    const ctx = makeContext();
    mocks.enterEditSession.mockResolvedValueOnce(ctx);
    mocks.autosaveEditSession.mockRejectedValueOnce(new EditSessionNetworkError("network_error", "offline"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true, autosaveDebounceMs: 5 }));

    await act(async () => {
      await result.current.enter();
    });
    act(() => {
      result.current.setDraft({ recapMarkdown: "next" });
    });
    await act(async () => {
      await wait(25);
    });
    await waitFor(() => {
      expect(result.current.status.kind).toBe("error");
    });

    act(() => {
      result.current.dismissError();
    });
    expect(result.current.status.kind).toBe("editing");
  });

  test("setDraft before entry is a no-op", () => {
    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    act(() => {
      result.current.setDraft({ recapMarkdown: "ignored" });
    });
    expect(result.current.draft).toBeNull();
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  test("enter after a stored tab id takes the resume-then-fresh-enter fallback", async () => {
    // Pre-populate the tab identity as if a previous tryResume failed
    // silently; calling enter() directly should resume under the same
    // identity, then fall back to a fresh enter when the server
    // confirms the earlier session is gone.
    const tabId = ensureTabSessionId(TRANSCRIPT);
    mocks.resumeEditSession.mockRejectedValueOnce(new EditSessionRefusedError("session_expired", 410, "gone"));
    const ctx = makeContext();
    mocks.enterEditSession.mockResolvedValueOnce(ctx);

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });

    expect(mocks.resumeEditSession).toHaveBeenCalledWith(expect.objectContaining({ tabId }));
    expect(mocks.enterEditSession).toHaveBeenCalled();
    expect(result.current.status.kind).toBe("editing");
  });

  test("enter with a stored tab id propagates non-expired refusals verbatim", async () => {
    ensureTabSessionId(TRANSCRIPT);
    mocks.resumeEditSession.mockRejectedValueOnce(new EditSessionRefusedError("already_locked", 409, "busy"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });

    expect(mocks.enterEditSession).not.toHaveBeenCalled();
    expect(result.current.status).toMatchObject({ kind: "error", stage: "enter", reason: "already_locked" });
  });

  test("dismissError transitions to idle when no session is held", async () => {
    mocks.enterEditSession.mockRejectedValueOnce(new EditSessionRefusedError("already_locked", 409, "busy"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.status.kind).toBe("error");

    act(() => {
      result.current.dismissError();
    });
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  test("exit handles an unexpected server refusal and still tears down", async () => {
    mocks.enterEditSession.mockResolvedValueOnce(makeContext());
    mocks.exitEditSession.mockRejectedValueOnce(new EditSessionRefusedError("workspace_archived", 409, "archived"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });
    await act(async () => {
      await result.current.exit();
    });

    await waitFor(() => {
      expect(result.current.status.kind).toBe("exited");
    });
    if (result.current.status.kind === "exited") {
      expect(result.current.status.reason).toBe("archived");
    }
  });

  test("exit swallows unexpected non-refusal errors from the release call", async () => {
    mocks.enterEditSession.mockResolvedValueOnce(makeContext());
    mocks.exitEditSession.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true }));
    await act(async () => {
      await result.current.enter();
    });
    await act(async () => {
      await result.current.exit();
    });

    expect(result.current.status).toEqual({ kind: "exited", reason: "user" });
  });

  test("workspace_archived during autosave exits with the archived reason", async () => {
    mocks.enterEditSession.mockResolvedValueOnce(makeContext());
    mocks.autosaveEditSession.mockRejectedValueOnce(new EditSessionRefusedError("workspace_archived", 409, "archived"));

    const { result } = renderHook(() => useEditSession({ workspaceSlug: SLUG, transcriptId: TRANSCRIPT, canEdit: true, autosaveDebounceMs: 5 }));

    await act(async () => {
      await result.current.enter();
    });
    act(() => {
      result.current.setDraft({ transcriptMarkdown: "change" });
    });
    await act(async () => {
      await wait(25);
    });

    await waitFor(() => {
      expect(result.current.status.kind).toBe("exited");
    });
    if (result.current.status.kind === "exited") {
      expect(result.current.status.reason).toBe("archived");
    }
  });
});
