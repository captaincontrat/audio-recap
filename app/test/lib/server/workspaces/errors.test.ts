import { describe, expect, test } from "vitest";

import {
  ArchivalEligibilityError,
  LastEligibleAdminError,
  PersonalWorkspaceViolationError,
  WorkspaceAccessDeniedError,
  WorkspaceArchivedError,
  WorkspaceNotFoundError,
} from "@/lib/server/workspaces/errors";

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

  test("WorkspaceArchivedError exposes a stable machine-readable code", () => {
    const err = new WorkspaceArchivedError();
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("workspace_archived");
    expect(err.name).toBe("WorkspaceArchivedError");
    expect(err.message).toMatch(/archived/i);
  });

  test("WorkspaceArchivedError lets callers supply a surface-specific message", () => {
    const err = new WorkspaceArchivedError("Exports are unavailable while the workspace is archived");
    expect(err.message).toBe("Exports are unavailable while the workspace is archived");
  });

  test("ArchivalEligibilityError carries the refusal reason for personal workspaces", () => {
    const err = new ArchivalEligibilityError("personal_workspace");
    expect(err.code).toBe("archival_not_eligible");
    expect(err.name).toBe("ArchivalEligibilityError");
    expect(err.reason).toBe("personal_workspace");
    expect(err.message).toMatch(/personal/i);
  });

  test("ArchivalEligibilityError defaults to a reason-specific message for uploads", () => {
    const err = new ArchivalEligibilityError("upload_in_progress");
    expect(err.reason).toBe("upload_in_progress");
    expect(err.message).toMatch(/upload/i);
  });

  test("ArchivalEligibilityError defaults to a reason-specific message for processing", () => {
    const err = new ArchivalEligibilityError("processing_in_progress");
    expect(err.reason).toBe("processing_in_progress");
    expect(err.message).toMatch(/processing/i);
  });

  test("ArchivalEligibilityError accepts an explicit message override", () => {
    const err = new ArchivalEligibilityError("upload_in_progress", "Retry after the upload finishes");
    expect(err.message).toBe("Retry after the upload finishes");
    expect(err.reason).toBe("upload_in_progress");
  });
});
