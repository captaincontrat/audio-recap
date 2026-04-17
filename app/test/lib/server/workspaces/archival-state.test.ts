import { describe, expect, test } from "vitest";

import {
  computeScheduledDeleteAt,
  deriveArchivalState,
  isPastRestorationWindow,
  isShareSuppressedByRestore,
  isWorkspaceActive,
  isWorkspaceArchived,
  RESTORATION_WINDOW_DAYS,
  type WorkspaceArchivalTimestamps,
} from "@/lib/server/workspaces/archival-state";

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

function ts(overrides: Partial<WorkspaceArchivalTimestamps> = {}): WorkspaceArchivalTimestamps {
  return {
    archivedAt: null,
    scheduledDeleteAt: null,
    restoredAt: null,
    ...overrides,
  };
}

describe("RESTORATION_WINDOW_DAYS", () => {
  test("is fixed at 60 days by the spec", () => {
    expect(RESTORATION_WINDOW_DAYS).toBe(60);
  });
});

describe("computeScheduledDeleteAt", () => {
  test("returns a timestamp exactly 60 days after the archive moment", () => {
    const archivedAt = new Date("2026-01-01T00:00:00.000Z");
    const scheduled = computeScheduledDeleteAt(archivedAt);
    expect(scheduled.getTime() - archivedAt.getTime()).toBe(RESTORATION_WINDOW_DAYS * MS_PER_DAY);
  });
});

describe("isWorkspaceActive / isWorkspaceArchived", () => {
  test("an active workspace has null archivedAt", () => {
    const row = ts();
    expect(isWorkspaceActive(row)).toBe(true);
    expect(isWorkspaceArchived(row)).toBe(false);
  });

  test("an archived workspace has a non-null archivedAt", () => {
    const archivedAt = new Date("2026-01-01T00:00:00.000Z");
    const row = ts({ archivedAt, scheduledDeleteAt: computeScheduledDeleteAt(archivedAt) });
    expect(isWorkspaceActive(row)).toBe(false);
    expect(isWorkspaceArchived(row)).toBe(true);
  });

  test("a restoredAt timestamp on its own does not imply the workspace is archived", () => {
    const row = ts({ restoredAt: new Date("2026-01-10T00:00:00.000Z") });
    expect(isWorkspaceActive(row)).toBe(true);
    expect(isWorkspaceArchived(row)).toBe(false);
  });
});

describe("isPastRestorationWindow", () => {
  const archivedAt = new Date("2026-01-01T00:00:00.000Z");
  const scheduledDeleteAt = computeScheduledDeleteAt(archivedAt);

  test("returns false while the restoration window is still open", () => {
    const row = ts({ archivedAt, scheduledDeleteAt });
    const now = new Date(scheduledDeleteAt.getTime() - MS_PER_DAY);
    expect(isPastRestorationWindow(row, now)).toBe(false);
  });

  test("returns true once the scheduled-delete moment has passed", () => {
    const row = ts({ archivedAt, scheduledDeleteAt });
    const now = new Date(scheduledDeleteAt.getTime() + 1);
    expect(isPastRestorationWindow(row, now)).toBe(true);
  });

  test("returns false for an active workspace regardless of `now`", () => {
    const row = ts();
    const now = new Date("9999-12-31T00:00:00.000Z");
    expect(isPastRestorationWindow(row, now)).toBe(false);
  });

  test("returns false when archivedAt is set but scheduledDeleteAt is missing", () => {
    // Defensive branch: if the row is in an inconsistent state (archive
    // stamped without a matching scheduled-delete timestamp) the sweep
    // should leave it alone rather than deleting it.
    const row = ts({ archivedAt, scheduledDeleteAt: null });
    expect(isPastRestorationWindow(row, new Date("9999-12-31T00:00:00.000Z"))).toBe(false);
  });
});

describe("deriveArchivalState", () => {
  const archivedAt = new Date("2026-01-01T00:00:00.000Z");
  const scheduledDeleteAt = computeScheduledDeleteAt(archivedAt);

  test("classifies a workspace with no archivedAt as active", () => {
    const state = deriveArchivalState(ts(), new Date("2026-03-01T00:00:00.000Z"));
    expect(state).toBe("active");
  });

  test("classifies an archived workspace still inside the window as archived_restorable", () => {
    const state = deriveArchivalState(ts({ archivedAt, scheduledDeleteAt }), new Date(scheduledDeleteAt.getTime() - 1));
    expect(state).toBe("archived_restorable");
  });

  test("classifies an archived workspace past the window as archived_past_restoration_window", () => {
    const state = deriveArchivalState(ts({ archivedAt, scheduledDeleteAt }), new Date(scheduledDeleteAt.getTime() + 1));
    expect(state).toBe("archived_past_restoration_window");
  });
});

describe("isShareSuppressedByRestore", () => {
  test("suppresses shares whose updatedAt predates the workspace restoredAt", () => {
    const restoredAt = new Date("2026-03-01T00:00:00.000Z");
    const suppressed = isShareSuppressedByRestore({
      workspace: ts({ restoredAt }),
      shareUpdatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(suppressed).toBe(true);
  });

  test("allows shares whose updatedAt is after the restoredAt moment", () => {
    const restoredAt = new Date("2026-03-01T00:00:00.000Z");
    const suppressed = isShareSuppressedByRestore({
      workspace: ts({ restoredAt }),
      shareUpdatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(suppressed).toBe(false);
  });

  test("never suppresses a share for a workspace that has no restoredAt history", () => {
    const suppressed = isShareSuppressedByRestore({
      workspace: ts(),
      shareUpdatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(suppressed).toBe(false);
  });
});
