import { describe, expect, test } from "vitest";

import { RESUME_RECONNECT_WINDOW_MS, SESSION_EXPIRY_MS } from "@/lib/server/transcripts/edit-sessions/constants";
import {
  canRoleEditMarkdown,
  evaluateAutosave,
  evaluateEnterSession,
  evaluateResumeSession,
  sessionExpirySeconds,
} from "@/lib/server/transcripts/edit-sessions/session-decisions";

// These tests are the source of truth for the role-based entry rules,
// same-tab resume window, conflict detection, and autosave expiry
// behavior described in the `transcript-edit-sessions` spec.

const TAB_A = "tab_aaaaaaaaaaaaaaaaaaaa";
const TAB_B = "tab_bbbbbbbbbbbbbbbbbbbb";
const TOKEN_A = "lock_aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TOKEN_B = "lock_bbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const USER_A = "user_a";
const USER_B = "user_b";
const NOW = 1_700_000_000_000;

describe("canRoleEditMarkdown", () => {
  test("allows workspace members and admins", () => {
    expect(canRoleEditMarkdown("admin")).toBe(true);
    expect(canRoleEditMarkdown("member")).toBe(true);
  });

  test("refuses read-only members", () => {
    expect(canRoleEditMarkdown("read_only")).toBe(false);
  });
});

describe("evaluateEnterSession", () => {
  test("archived workspaces are refused before the role check", () => {
    const decision = evaluateEnterSession({
      role: "member",
      workspaceActive: false,
      activeSession: null,
      requestingTabId: TAB_A,
    });
    expect(decision).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("read-only callers are refused with role_not_authorized", () => {
    const decision = evaluateEnterSession({
      role: "read_only",
      workspaceActive: true,
      activeSession: null,
      requestingTabId: TAB_A,
    });
    expect(decision).toEqual({ kind: "refused", reason: "role_not_authorized" });
  });

  test("a fresh tab is accepted when no lock is held", () => {
    const decision = evaluateEnterSession({
      role: "admin",
      workspaceActive: true,
      activeSession: null,
      requestingTabId: TAB_A,
    });
    expect(decision).toEqual({ kind: "accepted" });
  });

  test("same tab re-entry is routed to the resume path", () => {
    const decision = evaluateEnterSession({
      role: "member",
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
    });
    expect(decision).toEqual({ kind: "resume", tabId: TAB_A });
  });

  test("a second tab from the same user is refused with already_locked", () => {
    const decision = evaluateEnterSession({
      role: "member",
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_B,
    });
    expect(decision).toEqual({ kind: "refused", reason: "already_locked" });
  });

  test("a second user is refused with already_locked", () => {
    const decision = evaluateEnterSession({
      role: "admin",
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_B,
    });
    expect(decision).toEqual({ kind: "refused", reason: "already_locked" });
  });
});

describe("evaluateResumeSession", () => {
  test("archived workspaces refuse resume outright", () => {
    const decision = evaluateResumeSession({
      workspaceActive: false,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      lastHeartbeatAt: NOW,
      now: NOW + 1_000,
    });
    expect(decision).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("a missing lock collapses to session_expired", () => {
    const decision = evaluateResumeSession({
      workspaceActive: true,
      activeSession: null,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      lastHeartbeatAt: null,
      now: NOW,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("a lock held by another user surfaces as session_expired", () => {
    const decision = evaluateResumeSession({
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
      requestingUserId: USER_B,
      lastHeartbeatAt: NOW,
      now: NOW + 500,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("a different tab from the same user surfaces as already_locked", () => {
    const decision = evaluateResumeSession({
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_B,
      requestingUserId: USER_A,
      lastHeartbeatAt: NOW,
      now: NOW + 500,
    });
    expect(decision).toEqual({ kind: "refused", reason: "already_locked" });
  });

  test("a missing heartbeat collapses to session_expired", () => {
    const decision = evaluateResumeSession({
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      lastHeartbeatAt: null,
      now: NOW,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("the reconnect window is honored to the millisecond", () => {
    const justBeforeExpiry = evaluateResumeSession({
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      lastHeartbeatAt: NOW,
      now: NOW + RESUME_RECONNECT_WINDOW_MS,
    });
    expect(justBeforeExpiry).toEqual({ kind: "resumed" });

    const pastExpiry = evaluateResumeSession({
      workspaceActive: true,
      activeSession: { tabId: TAB_A, userId: USER_A },
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      lastHeartbeatAt: NOW,
      now: NOW + RESUME_RECONNECT_WINDOW_MS + 1,
    });
    expect(pastExpiry).toEqual({ kind: "refused", reason: "session_expired" });
  });
});

describe("evaluateAutosave", () => {
  const baseSession = {
    tabId: TAB_A,
    userId: USER_A,
    lockToken: TOKEN_A,
    lastHeartbeatAt: NOW,
  };

  test("archived workspaces refuse autosave", () => {
    const decision = evaluateAutosave({
      workspaceActive: false,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: NOW + 1_000,
    });
    expect(decision).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("missing session collapses to session_expired", () => {
    const decision = evaluateAutosave({
      workspaceActive: true,
      activeSession: null,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: NOW,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("a token mismatch is treated as expired", () => {
    const decision = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_B,
      now: NOW + 1_000,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("a tab mismatch is treated as expired", () => {
    const decision = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_B,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: NOW + 1_000,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("a user mismatch is treated as expired", () => {
    const decision = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_B,
      requestingLockToken: TOKEN_A,
      now: NOW + 1_000,
    });
    expect(decision).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("the 20 minute expiry window is honored to the millisecond", () => {
    const accepted = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: NOW + SESSION_EXPIRY_MS,
    });
    expect(accepted.kind).toBe("accepted");

    const expired = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: NOW + SESSION_EXPIRY_MS + 1,
    });
    expect(expired).toEqual({ kind: "refused", reason: "session_expired" });
  });

  test("accepted responses echo the new heartbeat moment", () => {
    const at = NOW + 1_234;
    const decision = evaluateAutosave({
      workspaceActive: true,
      activeSession: baseSession,
      requestingTabId: TAB_A,
      requestingUserId: USER_A,
      requestingLockToken: TOKEN_A,
      now: at,
    });
    expect(decision).toEqual({ kind: "accepted", nextHeartbeatAt: at });
  });
});

describe("sessionExpirySeconds", () => {
  test("rounds up to a whole number of seconds", () => {
    expect(sessionExpirySeconds()).toBe(Math.ceil(SESSION_EXPIRY_MS / 1_000));
    expect(Number.isInteger(sessionExpirySeconds())).toBe(true);
  });
});
