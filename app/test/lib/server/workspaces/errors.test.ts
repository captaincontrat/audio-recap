import { describe, expect, test } from "vitest";

import { LastEligibleAdminError, PersonalWorkspaceViolationError, WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";

describe("workspace error classes", () => {
  test("WorkspaceNotFoundError exposes a machine-readable code and default message", () => {
    const err = new WorkspaceNotFoundError();
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("workspace_not_found");
    expect(err.name).toBe("WorkspaceNotFoundError");
    expect(err.message).toBe("Workspace not found");
  });

  test("WorkspaceAccessDeniedError accepts a custom message", () => {
    const err = new WorkspaceAccessDeniedError("Access denied to acme");
    expect(err.code).toBe("workspace_access_denied");
    expect(err.name).toBe("WorkspaceAccessDeniedError");
    expect(err.message).toBe("Access denied to acme");
  });

  test("PersonalWorkspaceViolationError defaults to a safe generic message", () => {
    const err = new PersonalWorkspaceViolationError();
    expect(err.code).toBe("personal_workspace_violation");
    expect(err.name).toBe("PersonalWorkspaceViolationError");
    expect(err.message).toContain("Personal workspace");
  });

  test("LastEligibleAdminError defaults to the invariant explanation", () => {
    const err = new LastEligibleAdminError();
    expect(err.code).toBe("last_eligible_admin");
    expect(err.name).toBe("LastEligibleAdminError");
    expect(err.message).toMatch(/admin/i);
  });
});
