import { describe, expect, test } from "vitest";

import type { AdminAccountRow } from "@/lib/server/workspaces/invariants";
import {
  evaluateAddMembership,
  evaluateAdminPreconditions,
  evaluateChangeRole,
  evaluateRemoveMembership,
  type WorkspaceShape,
} from "@/lib/server/workspaces/membership-decisions";

const TEAM_ACTIVE: WorkspaceShape = { type: "team", archivedAt: null };
const TEAM_ARCHIVED: WorkspaceShape = { type: "team", archivedAt: new Date("2026-01-01T00:00:00Z") };
const PERSONAL: WorkspaceShape = { type: "personal", archivedAt: null };

function admin(partial: Partial<AdminAccountRow> & { membershipId: string }): AdminAccountRow {
  return {
    userId: `u_${partial.membershipId}`,
    role: "admin",
    userExists: true,
    closedAt: null,
    ...partial,
  };
}

describe("evaluateAdminPreconditions", () => {
  test("refuses personal workspaces even when the caller is an admin", () => {
    expect(evaluateAdminPreconditions({ workspace: PERSONAL, caller: { role: "admin" } })).toEqual({ kind: "refused", reason: "personal_workspace" });
  });

  test("refuses archived team workspaces with a personal-workspace-independent reason", () => {
    expect(evaluateAdminPreconditions({ workspace: TEAM_ARCHIVED, caller: { role: "admin" } })).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("refuses non-admin callers on active team workspaces", () => {
    expect(evaluateAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: "member" } })).toEqual({ kind: "refused", reason: "not_admin_caller" });
    expect(evaluateAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: "read_only" } })).toEqual({ kind: "refused", reason: "not_admin_caller" });
    expect(evaluateAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: null } })).toEqual({ kind: "refused", reason: "not_admin_caller" });
  });

  test("allows admins of active team workspaces", () => {
    expect(evaluateAdminPreconditions({ workspace: TEAM_ACTIVE, caller: { role: "admin" } })).toEqual({ kind: "allowed" });
  });
});

describe("evaluateAddMembership", () => {
  test("delegates to the admin preconditions for refusal branches", () => {
    expect(evaluateAddMembership({ workspace: PERSONAL, caller: { role: "admin" } })).toEqual({ kind: "refused", reason: "personal_workspace" });
  });

  test("allows an admin to add a member to an active team workspace", () => {
    expect(evaluateAddMembership({ workspace: TEAM_ACTIVE, caller: { role: "admin" } })).toEqual({ kind: "allowed" });
  });
});

describe("evaluateRemoveMembership", () => {
  test("refuses when the target membership is missing", () => {
    expect(
      evaluateRemoveMembership({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: null,
        adminMemberships: [],
      }),
    ).toEqual({ kind: "refused", reason: "target_not_a_member" });
  });

  test("refuses to remove the last eligible active admin", () => {
    const admins = [admin({ membershipId: "m1" })];
    expect(
      evaluateRemoveMembership({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m1", userExists: true },
        adminMemberships: admins,
      }),
    ).toEqual({ kind: "refused", reason: "last_eligible_admin" });
  });

  test("allows removing a non-admin when admins remain", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2" })];
    expect(
      evaluateRemoveMembership({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m2", userExists: true },
        adminMemberships: admins,
      }),
    ).toEqual({ kind: "allowed" });
  });

  test("refuses non-admin callers before checking membership or invariants", () => {
    expect(
      evaluateRemoveMembership({
        workspace: TEAM_ACTIVE,
        caller: { role: "member" },
        targetMembership: { id: "m1", userExists: true },
        adminMemberships: [],
      }),
    ).toEqual({ kind: "refused", reason: "not_admin_caller" });
  });
});

describe("evaluateChangeRole", () => {
  test("refuses when the target membership is missing", () => {
    expect(
      evaluateChangeRole({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: null,
        nextRole: "admin",
        adminMemberships: [],
      }),
    ).toEqual({ kind: "refused", reason: "target_not_a_member" });
  });

  test("refuses when the role would not change", () => {
    expect(
      evaluateChangeRole({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m1", currentRole: "member" },
        nextRole: "member",
        adminMemberships: [],
      }),
    ).toEqual({ kind: "refused", reason: "role_unchanged" });
  });

  test("refuses downgrading the only eligible admin", () => {
    const admins = [admin({ membershipId: "m1" })];
    expect(
      evaluateChangeRole({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m1", currentRole: "admin" },
        nextRole: "member",
        adminMemberships: admins,
      }),
    ).toEqual({ kind: "refused", reason: "last_eligible_admin" });
  });

  test("allows downgrading one of several admins", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2" })];
    expect(
      evaluateChangeRole({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m1", currentRole: "admin" },
        nextRole: "member",
        adminMemberships: admins,
      }),
    ).toEqual({ kind: "allowed" });
  });

  test("refuses on archived workspaces before checking role transition", () => {
    expect(
      evaluateChangeRole({
        workspace: TEAM_ARCHIVED,
        caller: { role: "admin" },
        targetMembership: { id: "m1", currentRole: "member" },
        nextRole: "admin",
        adminMemberships: [],
      }),
    ).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("allows promoting a member to admin", () => {
    expect(
      evaluateChangeRole({
        workspace: TEAM_ACTIVE,
        caller: { role: "admin" },
        targetMembership: { id: "m1", currentRole: "member" },
        nextRole: "admin",
        adminMemberships: [admin({ membershipId: "other" })],
      }),
    ).toEqual({ kind: "allowed" });
  });
});
