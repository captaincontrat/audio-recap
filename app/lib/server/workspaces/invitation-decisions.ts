import type { WorkspaceInvitationStatus, WorkspaceRole, WorkspaceType } from "@/lib/server/db/schema";

// Pure decision helpers for invitation lifecycle. Every lifecycle rule
// from the `workspace-membership-and-invitations` spec collapses to one
// of the refusals defined here, so unit tests can cover every branch
// without touching the database. The DB service in `invitations.ts`
// composes these helpers with real rows before mutating state.

// Invitation expiration window from the spec. Kept as a constant so the
// decision module owns the policy and the DB service merely reads it.
export const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function computeInvitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

// Single reason code for every "this link is not valid right now"
// branch. The spec requires expired, revoked, superseded, consumed, and
// not-found tokens to collapse to the same generic behavior so nothing
// leaks internal invitation state. Code consumers inspect the reason
// only for logging, never for user-facing differentiation.
export type GenericInvalidInvitationReason = "not_found" | "expired" | "revoked" | "consumed" | "superseded";

export type InvitationIssueRefusalReason = "not_admin_caller" | "personal_workspace" | "workspace_archived" | "target_already_member";

export type InvitationMutationOutcome = { kind: "allowed" } | { kind: "refused"; reason: InvitationIssueRefusalReason };

export type InvitationAcceptanceRefusalReason = "invalid_link" | "workspace_archived" | "email_mismatch" | "already_a_member";

export type InvitationAcceptanceOutcome = { kind: "allowed" } | { kind: "refused"; reason: InvitationAcceptanceRefusalReason };

export type WorkspaceShape = {
  type: WorkspaceType;
  archivedAt: Date | null;
};

export type CallerContext = {
  role: WorkspaceRole | null;
};

export type InvitationRowShape = {
  status: WorkspaceInvitationStatus;
  expiresAt: Date;
  email: string;
};

// Shared pre-checks for admin-managed invitation actions (issue,
// resend, revoke). Refusal precedence matches the membership-admin
// module so route surfaces stay consistent.
export function evaluateInvitationAdminPreconditions(args: { workspace: WorkspaceShape; caller: CallerContext }): InvitationMutationOutcome {
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

export type IssueInvitationInputs = {
  workspace: WorkspaceShape;
  caller: CallerContext;
  targetAlreadyMember: boolean;
};

export function evaluateIssueInvitation(inputs: IssueInvitationInputs): InvitationMutationOutcome {
  const pre = evaluateInvitationAdminPreconditions({ workspace: inputs.workspace, caller: inputs.caller });
  if (pre.kind === "refused") {
    return pre;
  }
  if (inputs.targetAlreadyMember) {
    return { kind: "refused", reason: "target_already_member" };
  }
  return { kind: "allowed" };
}

// Map a row's stored status and expiry to a generic-invalid reason.
// Callers use this when a token lookup returns a row but the row
// shouldn't grant access — every branch funnels to the same generic
// unavailable behavior the spec mandates.
export function classifyInvitationValidity(
  row: InvitationRowShape,
  now: Date,
): { kind: "valid" } | { kind: "invalid"; reason: GenericInvalidInvitationReason } {
  switch (row.status) {
    case "revoked":
      return { kind: "invalid", reason: "revoked" };
    case "accepted":
      return { kind: "invalid", reason: "consumed" };
    case "superseded":
      return { kind: "invalid", reason: "superseded" };
    case "expired":
      return { kind: "invalid", reason: "expired" };
    case "pending":
      if (row.expiresAt <= now) {
        return { kind: "invalid", reason: "expired" };
      }
      return { kind: "valid" };
  }
}

export type AcceptInvitationInputs = {
  invitation: InvitationRowShape | null;
  workspace: WorkspaceShape | null;
  acceptingUserEmail: string | null;
  alreadyMember: boolean;
  now: Date;
};

// Acceptance is allowed only when:
// - the invitation row exists and is currently pending+fresh
// - the owning workspace is still active
// - the accepting account's email matches the invitation email
// - the accepting account is not already a member (idempotent
//   no-op reporting via a dedicated refusal reason keeps the UI clean)
//
// Everything else collapses to `invalid_link` so the rule
// "expired/revoked/superseded/consumed all look the same" holds even
// without touching the DB service.
export function evaluateAcceptInvitation(inputs: AcceptInvitationInputs): InvitationAcceptanceOutcome {
  if (!inputs.invitation || !inputs.workspace) {
    return { kind: "refused", reason: "invalid_link" };
  }
  const validity = classifyInvitationValidity(inputs.invitation, inputs.now);
  if (validity.kind === "invalid") {
    return { kind: "refused", reason: "invalid_link" };
  }
  if (inputs.workspace.archivedAt !== null) {
    return { kind: "refused", reason: "workspace_archived" };
  }
  if (inputs.acceptingUserEmail === null) {
    return { kind: "refused", reason: "email_mismatch" };
  }
  if (inputs.acceptingUserEmail !== inputs.invitation.email) {
    return { kind: "refused", reason: "email_mismatch" };
  }
  if (inputs.alreadyMember) {
    return { kind: "refused", reason: "already_a_member" };
  }
  return { kind: "allowed" };
}
