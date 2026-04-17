import { describe, expect, test } from "vitest";

import {
  assertAutosaveAllowed,
  assertInvitationAcceptanceAllowed,
  assertPublicShareResolvable,
  assertTranscriptExportAllowed,
  assertTranscriptLibraryAccessible,
  canResumeEditSession,
} from "@/lib/server/workspaces/archival-gates";
import { computeScheduledDeleteAt, type WorkspaceArchivalTimestamps } from "@/lib/server/workspaces/archival-state";
import { WorkspaceArchivedError } from "@/lib/server/workspaces/errors";

function active(): WorkspaceArchivalTimestamps {
  return { archivedAt: null, scheduledDeleteAt: null, restoredAt: null };
}

function archived(): WorkspaceArchivalTimestamps {
  const archivedAt = new Date("2026-01-01T00:00:00.000Z");
  return {
    archivedAt,
    scheduledDeleteAt: computeScheduledDeleteAt(archivedAt),
    restoredAt: null,
  };
}

describe("archival-gates", () => {
  test("transcript library access is refused for archived workspaces", () => {
    expect(() => assertTranscriptLibraryAccessible(archived())).toThrow(WorkspaceArchivedError);
  });

  test("transcript library access passes for active workspaces", () => {
    expect(() => assertTranscriptLibraryAccessible(active())).not.toThrow();
  });

  test("authenticated export is refused for archived workspaces", () => {
    expect(() => assertTranscriptExportAllowed(archived())).toThrow(WorkspaceArchivedError);
  });

  test("invitation acceptance is refused for archived workspaces", () => {
    expect(() => assertInvitationAcceptanceAllowed(archived())).toThrow(WorkspaceArchivedError);
  });

  test("public share resolution is refused for archived workspaces", () => {
    expect(() => assertPublicShareResolvable(archived())).toThrow(WorkspaceArchivedError);
  });

  test("autosave attempts are rejected for archived workspaces", () => {
    expect(() => assertAutosaveAllowed(archived())).toThrow(WorkspaceArchivedError);
  });

  test("same-tab edit-session resume is refused for archived workspaces", () => {
    expect(canResumeEditSession(archived())).toBe(false);
    expect(canResumeEditSession(active())).toBe(true);
  });

  test("the refusal carries the stable workspace_archived code for API shims", () => {
    try {
      assertTranscriptLibraryAccessible(archived());
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceArchivedError);
      expect((error as WorkspaceArchivedError).code).toBe("workspace_archived");
    }
  });
});
