// Dedicated error classes for workspace foundation invariants. Callers can
// match on `instanceof` (route handlers) or on the `.code` literal (API
// response serialisers) to map the failure to the right HTTP or UI state.

export class WorkspaceNotFoundError extends Error {
  readonly code = "workspace_not_found" as const;
  constructor(message = "Workspace not found") {
    super(message);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceAccessDeniedError extends Error {
  readonly code = "workspace_access_denied" as const;
  constructor(message = "You do not have access to this workspace") {
    super(message);
    this.name = "WorkspaceAccessDeniedError";
  }
}

export class PersonalWorkspaceViolationError extends Error {
  readonly code = "personal_workspace_violation" as const;
  constructor(message = "Personal workspaces cannot be left or deleted") {
    super(message);
    this.name = "PersonalWorkspaceViolationError";
  }
}

export class LastEligibleAdminError extends Error {
  readonly code = "last_eligible_admin" as const;
  constructor(message = "Active team workspaces must retain at least one eligible active admin") {
    super(message);
    this.name = "LastEligibleAdminError";
  }
}

// Surface error raised when a downstream capability (private transcript
// library, transcript export, invitation acceptance, public share
// resolution, transcript autosave) is invoked on an archived workspace.
// Gating happens through `archival-gates.ts`; this class exists so API
// response shims can map the lockout to a stable HTTP/UI state instead
// of depending on a generic workspace error.
export class WorkspaceArchivedError extends Error {
  readonly code = "workspace_archived" as const;
  constructor(message = "This workspace is archived") {
    super(message);
    this.name = "WorkspaceArchivedError";
  }
}

// Raised when the archive action itself is refused — either because the
// workspace is not eligible (personal workspace) or because it still has
// upload or non-terminal audio-processing work in progress. `reason`
// carries a stable identifier so UI code can branch on the specific
// refusal without parsing the message.
export type ArchivalEligibilityRefusalReason = "personal_workspace" | "upload_in_progress" | "processing_in_progress";

export class ArchivalEligibilityError extends Error {
  readonly code = "archival_not_eligible" as const;
  readonly reason: ArchivalEligibilityRefusalReason;
  constructor(reason: ArchivalEligibilityRefusalReason, message?: string) {
    super(message ?? defaultArchivalEligibilityMessage(reason));
    this.name = "ArchivalEligibilityError";
    this.reason = reason;
  }
}

function defaultArchivalEligibilityMessage(reason: ArchivalEligibilityRefusalReason): string {
  switch (reason) {
    case "personal_workspace":
      return "Personal workspaces cannot be archived";
    case "upload_in_progress":
      return "An upload is still in progress for this workspace";
    case "processing_in_progress":
      return "Audio processing work is still in progress for this workspace";
  }
}

// Generic "this invitation link is not valid" error. Kept deliberately
// neutral because the `workspace-membership-and-invitations` spec
// requires expired, revoked, superseded, consumed, and not-found
// tokens to collapse to the same outward behavior so acceptance never
// leaks invitation lifecycle state to anonymous callers.
export class InvalidInvitationError extends Error {
  readonly code = "invitation_invalid" as const;
  constructor(message = "This invitation link is no longer valid") {
    super(message);
    this.name = "InvalidInvitationError";
  }
}

// Raised when acceptance is attempted by an account whose email does
// not match the invited normalized email. Distinct from
// `InvalidInvitationError` because the invited person can still
// recover by signing into (or creating) the account that matches the
// invited email address.
export class InvitationEmailMismatchError extends Error {
  readonly code = "invitation_email_mismatch" as const;
  constructor(message = "This invitation is addressed to a different email address") {
    super(message);
    this.name = "InvitationEmailMismatchError";
  }
}

// Raised when an admin attempts to invite a user that already has a
// membership. Distinct from `InvalidInvitationError` because the issue
// is on the issuance side and an admin may want to use the role-change
// flow instead.
export class InvitationTargetAlreadyMemberError extends Error {
  readonly code = "invitation_target_already_member" as const;
  constructor(message = "This account is already a member of the workspace") {
    super(message);
    this.name = "InvitationTargetAlreadyMemberError";
  }
}
