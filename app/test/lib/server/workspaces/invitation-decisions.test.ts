import { describe, expect, test } from "vitest";

import {
  classifyInvitationValidity,
  computeInvitationExpiry,
  evaluateAcceptInvitation,
  evaluateInvitationAdminPreconditions,
  evaluateIssueInvitation,
  INVITATION_TTL_MS,
  type WorkspaceShape,
} from "@/lib/server/workspaces/invitation-decisions";

const TEAM_ACTIVE: WorkspaceShape = { type: "team", archivedAt: null };
const TEAM_ARCHIVED: WorkspaceShape = { type: "team", archivedAt: new Date("2026-01-01T00:00:00Z") };
const PERSONAL: WorkspaceShape = { type: "personal", archivedAt: null };
const NOW = new Date("2026-04-17T12:00:00Z");

describe("computeInvitationExpiry", () => {
  test("adds exactly 7 days to the reference moment", () => {
    const expected = new Date(NOW.getTime() + INVITATION_TTL_MS);
    expect(computeInvitationExpiry(NOW).toISOString()).toBe(expected.toISOString());
  });

  test("exposes the 7-day TTL as a constant", () => {
    expect(INVITATION_TTL_MS).toBe(1000 * 60 * 60 * 24 * 7);
  });
});

describe("evaluateInvitationAdminPreconditions", () => {
  test("refuses invitations into personal workspaces", () => {
    expect(evaluateInvitationAdminPreconditions({ workspace: PERSONAL, caller: { role: "admin" } })).toEqual({ kind: "refused", reason: "personal_workspace" });
  });

  test("refuses invitations into archived workspaces", () => {
    expect(evaluateInvitationAdminPreconditions({ workspace: TEAM_ARCHIVED, caller: { role: "admin" } })).toEqual({
      kind: "refused",
      reason: "workspace_archived",
    });
  });

  test("refuses non-admin callers", () => {
    expect(evaluateInvitationAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: "member" } })).toEqual({
      kind: "refused",
      reason: "not_admin_caller",
    });
    expect(evaluateInvitationAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: null } })).toEqual({ kind: "refused", reason: "not_admin_caller" });
  });

  test("allows admins on active team workspaces", () => {
    expect(evaluateInvitationAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: "admin" } })).toEqual({ kind: "allowed" });
  });
});

describe("evaluateIssueInvitation", () => {
  test("refuses when the target email is already a member", () => {
    expect(
      evaluateIssueInvitation({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetAlreadyMember: true,
      }),
    ).toEqual({ kind: "refused", reason: "target_already_member" });
  });

  test("allows issuing to a non-member", () => {
    expect(
      evaluateIssueInvitation({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetAlreadyMember: false,
      }),
    ).toEqual({ kind: "allowed" });
  });

  test("inherits admin-precondition refusals", () => {
    expect(
      evaluateIssueInvitation({
        workspace: PERSONAL,
        caller: { role: "admin" },
        targetAlreadyMember: false,
      }),
    ).toEqual({ kind: "refused", reason: "personal_workspace" });
  });
});

describe("classifyInvitationValidity", () => {
  test("pending invitations within the window are valid", () => {
    const result = classifyInvitationValidity({ status: "pending", email: "ada@example.com", expiresAt: new Date(NOW.getTime() + 60_000) }, NOW);
    expect(result).toEqual({ kind: "valid" });
  });

  test("pending invitations past the expiry collapse to expired", () => {
    const result = classifyInvitationValidity({ status: "pending", email: "ada@example.com", expiresAt: new Date(NOW.getTime() - 1) }, NOW);
    expect(result).toEqual({ kind: "invalid", reason: "expired" });
  });

  test("revoked, accepted, superseded, and expired statuses each map to their own reason", () => {
    const base = { email: "ada@example.com", expiresAt: new Date(NOW.getTime() + 60_000) };
    expect(classifyInvitationValidity({ ...base, status: "revoked" }, NOW)).toEqual({ kind: "invalid", reason: "revoked" });
    expect(classifyInvitationValidity({ ...base, status: "accepted" }, NOW)).toEqual({ kind: "invalid", reason: "consumed" });
    expect(classifyInvitationValidity({ ...base, status: "superseded" }, NOW)).toEqual({ kind: "invalid", reason: "superseded" });
    expect(classifyInvitationValidity({ ...base, status: "expired" }, NOW)).toEqual({ kind: "invalid", reason: "expired" });
  });
});

describe("evaluateAcceptInvitation", () => {
  const pendingRow = { status: "pending" as const, email: "ada@example.com", expiresAt: new Date(NOW.getTime() + 60_000) };

  test("refuses when the invitation row or workspace is missing", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: null,
        workspace: TEAM_ACTIVE,
        acceptingUserEmail: "ada@example.com",
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "invalid_link" });

    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: null,
        acceptingUserEmail: "ada@example.com",
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "invalid_link" });
  });

  test("collapses every lifecycle-invalid row to a single invalid_link refusal", () => {
    const expiredRow = { ...pendingRow, expiresAt: new Date(NOW.getTime() - 1) };
    const revokedRow = { ...pendingRow, status: "revoked" as const };
    const supersededRow = { ...pendingRow, status: "superseded" as const };
    const acceptedRow = { ...pendingRow, status: "accepted" as const };
    for (const invitation of [expiredRow, revokedRow, supersededRow, acceptedRow]) {
      expect(
        evaluateAcceptInvitation({
          invitation,
          workspace: TEAM_ACTIVE,
          acceptingUserEmail: pendingRow.email,
          alreadyMember: false,
          now: NOW,
        }),
      ).toEqual({ kind: "refused", reason: "invalid_link" });
    }
  });

  test("refuses acceptance on archived workspaces", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: TEAM_ARCHIVED,
        acceptingUserEmail: pendingRow.email,
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("refuses acceptance when there is no signed-in account", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: TEAM_ACTIVE,
        acceptingUserEmail: null,
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "email_mismatch" });
  });

  test("refuses acceptance when the signed-in email differs from the invited email", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: TEAM_ACTIVE,
        acceptingUserEmail: "mallory@example.com",
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "email_mismatch" });
  });

  test("refuses when the accepting user is already a member", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: TEAM_ACTIVE,
        acceptingUserEmail: pendingRow.email,
        alreadyMember: true,
        now: NOW,
      }),
    ).toEqual({ kind: "refused", reason: "already_a_member" });
  });

  test("allows acceptance when the signed-in email matches the pending invitation", () => {
    expect(
      evaluateAcceptInvitation({
        invitation: pendingRow,
        workspace: TEAM_ACTIVE,
        acceptingUserEmail: pendingRow.email,
        alreadyMember: false,
        now: NOW,
      }),
    ).toEqual({ kind: "allowed" });
  });
});
