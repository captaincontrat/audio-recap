import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ArchivalSideEffectError,
  type ArchiveSideEffect,
  listRegisteredArchiveSideEffects,
  registerArchiveSideEffect,
  runArchiveSideEffects,
  unregisterArchiveSideEffect,
} from "@/lib/server/workspaces/archival-side-effects";

const CONTEXT = {
  workspaceId: "ws_1",
  archivedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function stubEffect(id: string, run: ArchiveSideEffect["run"] = async () => undefined): ArchiveSideEffect {
  return { id, run };
}

afterEach(() => {
  for (const entry of listRegisteredArchiveSideEffects()) {
    unregisterArchiveSideEffect(entry.id);
  }
});

describe("runArchiveSideEffects (explicit list)", () => {
  test("invokes every registered side-effect sequentially with the archive context", async () => {
    const invitationRun = vi.fn(async () => undefined);
    const publicShareRun = vi.fn(async () => undefined);
    const editSessionRun = vi.fn(async () => undefined);

    await runArchiveSideEffects(CONTEXT, [
      stubEffect("invitations.invalidate", invitationRun),
      stubEffect("public-shares.suppress", publicShareRun),
      stubEffect("edit-sessions.release-and-cancel-resume", editSessionRun),
    ]);

    expect(invitationRun).toHaveBeenCalledWith(CONTEXT);
    expect(publicShareRun).toHaveBeenCalledWith(CONTEXT);
    expect(editSessionRun).toHaveBeenCalledWith(CONTEXT);
    expect(invitationRun.mock.invocationCallOrder[0]).toBeLessThan(publicShareRun.mock.invocationCallOrder[0]);
    expect(publicShareRun.mock.invocationCallOrder[0]).toBeLessThan(editSessionRun.mock.invocationCallOrder[0]);
  });

  test("continues running other side-effects when one fails and aggregates failures", async () => {
    const invalidateFailed = vi.fn(async () => {
      throw new Error("invitations down");
    });
    const editsFailed = vi.fn(async () => {
      throw new Error("redis flake");
    });
    const publicShareRun = vi.fn(async () => undefined);

    const call = runArchiveSideEffects(CONTEXT, [
      stubEffect("invitations.invalidate", invalidateFailed),
      stubEffect("public-shares.suppress", publicShareRun),
      stubEffect("edit-sessions.release-and-cancel-resume", editsFailed),
    ]);

    await expect(call).rejects.toBeInstanceOf(ArchivalSideEffectError);
    await expect(call).rejects.toMatchObject({
      code: "archival_side_effect_failed",
      failures: [{ id: "invitations.invalidate" }, { id: "edit-sessions.release-and-cancel-resume" }],
    });
    expect(publicShareRun).toHaveBeenCalled();
  });
});

describe("archive side-effect registry", () => {
  test("registered effects run by default", async () => {
    const invitationRun = vi.fn(async () => undefined);
    registerArchiveSideEffect(stubEffect("invitations.invalidate", invitationRun));

    await runArchiveSideEffects(CONTEXT);
    expect(invitationRun).toHaveBeenCalledWith(CONTEXT);
  });

  test("re-registering the same id replaces the previous effect", async () => {
    const originalRun = vi.fn(async () => undefined);
    const replacementRun = vi.fn(async () => undefined);
    registerArchiveSideEffect(stubEffect("public-shares.suppress", originalRun));
    registerArchiveSideEffect(stubEffect("public-shares.suppress", replacementRun));

    await runArchiveSideEffects(CONTEXT);

    expect(originalRun).not.toHaveBeenCalled();
    expect(replacementRun).toHaveBeenCalledWith(CONTEXT);
  });

  test("unregisterArchiveSideEffect removes a prior registration", async () => {
    const run = vi.fn(async () => undefined);
    registerArchiveSideEffect(stubEffect("edit-sessions.release-and-cancel-resume", run));
    unregisterArchiveSideEffect("edit-sessions.release-and-cancel-resume");

    await runArchiveSideEffects(CONTEXT);
    expect(run).not.toHaveBeenCalled();
  });

  test("unregisterArchiveSideEffect is a no-op when the id is not registered", () => {
    // Keeps registration idempotent under hot-reload: downstream modules
    // can always defensively unregister before re-registering, even on a
    // cold start where nothing is registered yet.
    expect(() => unregisterArchiveSideEffect("never-registered")).not.toThrow();
    expect(listRegisteredArchiveSideEffects()).toEqual([]);
  });
});
