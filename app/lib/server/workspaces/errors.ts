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
