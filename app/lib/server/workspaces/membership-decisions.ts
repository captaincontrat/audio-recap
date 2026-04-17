import type { WorkspaceRole, WorkspaceType } from "@/lib/server/db/schema";
import { type AdminAccountRow, wouldViolateLastEligibleAdminInvariant } from "./invariants";

// Pure decision helpers for the admin-managed membership flows from the
// `workspace-membership-and-invitations` capability. They encode the
// spec's refusals (non-admin caller, personal workspace target, last
// eligible active admin protection, archived workspace) without touching
// the database, so each refusal branch can be unit-tested exhaustively.
//
// The DB-touching service composes these helpers with real rows before
// writing membership mutations.

export type MembershipMutationKind = "add" | "remove" | "change_role";

// Stable refusal identifiers surfaced to callers. The DB service maps
// these to the dedicated error classes in `errors.ts` so route handlers
// can branch on `instanceof` or on the stable `.code` property. Keeping
// them as a literal union here means TypeScript's exhaustive switch
// catches any missing branch as the rule set evolves.
export type MembershipMutationRefusalReason =
  | "not_admin_caller"
  | "personal_workspace"
  | "workspace_archived"
  | "last_eligible_admin"
  | "target_not_a_member"
  | "role_unchanged";

export type MembershipMutationOutcome = { kind: "allowed" } | { kind: "refused"; reason: MembershipMutationRefusalReason };

export type WorkspaceShape = {
  type: WorkspaceType;
  archivedAt: Date | null;
};

export type CallerContext = {
  role: WorkspaceRole | null;
};

// Shared precondition check: admin-only mutations always refuse on
// personal workspaces, archived workspaces, and non-admin callers. The
// order matches the precedence the spec cares about: workspace-type
// refusals happen before role checks so the error surface stays
// consistent whether the caller is an admin of a different workspace
// or not a member at all.
export function evaluateAdminPreconditions(args: { workspace: WorkspaceShape; caller: CallerContext }): MembershipMutationOutcome {
  if (args.workspace.type === "personal") {
    return { kind: "refused", reason: "personal_workspace" };
  }
  if (args.workspace.archivedAt !== null) {
    return { kind: "refused", reason: "workspace_archived" };
  }
  if (args.caller.role !== "admin") {
    return { kind: "refused", reason: "not_admin_caller" };
  }
  return { kind: "allowed" };
}

export type AddMembershipInputs = {
  workspace: WorkspaceShape;
  caller: CallerContext;
};

export function evaluateAddMembership(inputs: AddMembershipInputs): MembershipMutationOutcome {
  return evaluateAdminPreconditions({ workspace: inputs.workspace, caller: inputs.caller });
}

export type RemoveMembershipInputs = {
  workspace: WorkspaceShape;
  caller: CallerContext;
  targetMembership: { id: string; userExists: boolean } | null;
  adminMemberships: readonly AdminAccountRow[];
};

// Removing a member refuses if:
// - preconditions fail (non-admin, personal, archived)
// - the target membership does not exist
// - removing it would leave the workspace with no eligible active admin
export function evaluateRemoveMembership(inputs: RemoveMembershipInputs): MembershipMutationOutcome {
  const preconditions = evaluateAdminPreconditions({ workspace: inputs.workspace, caller: inputs.caller });
  if (preconditions.kind === "refused") {
    return preconditions;
  }
  if (!inputs.targetMembership) {
    return { kind: "refused", reason: "target_not_a_member" };
  }
  if (
    wouldViolateLastEligibleAdminInvariant(inputs.adminMemberships, {
      membershipId: inputs.targetMembership.id,
      userExistsAfter: false,
    })
  ) {
    return { kind: "refused", reason: "last_eligible_admin" };
  }
  return { kind: "allowed" };
}

export type ChangeRoleInputs = {
  workspace: WorkspaceShape;
  caller: CallerContext;
  targetMembership: { id: string; currentRole: WorkspaceRole } | null;
  nextRole: WorkspaceRole;
  adminMemberships: readonly AdminAccountRow[];
};

// Changing a role refuses if:
// - preconditions fail
// - target membership is missing
// - the role wouldn't actually change (kept as a dedicated reason so the
//   UI can skip the "updated" toast for no-op writes)
// - downgrading away from `admin` would violate the admin invariant
export function evaluateChangeRole(inputs: ChangeRoleInputs): MembershipMutationOutcome {
  const preconditions = evaluateAdminPreconditions({ workspace: inputs.workspace, caller: inputs.caller });
  if (preconditions.kind === "refused") {
    return preconditions;
  }
  if (!inputs.targetMembership) {
    return { kind: "refused", reason: "target_not_a_member" };
  }
  if (inputs.targetMembership.currentRole === inputs.nextRole) {
    return { kind: "refused", reason: "role_unchanged" };
  }
  if (
    wouldViolateLastEligibleAdminInvariant(inputs.adminMemberships, {
      membershipId: inputs.targetMembership.id,
      roleAfter: inputs.nextRole,
    })
  ) {
    return { kind: "refused", reason: "last_eligible_admin" };
  }
  return { kind: "allowed" };
}
