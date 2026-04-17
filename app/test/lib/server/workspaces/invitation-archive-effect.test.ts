import { afterEach, describe, expect, test, vi } from "vitest";

import { listRegisteredArchiveSideEffects, unregisterArchiveSideEffect } from "@/lib/server/workspaces/archival-side-effects";
import {
  INVITATION_ARCHIVE_EFFECT_ID,
  invitationArchiveSideEffect,
  registerInvitationArchiveSideEffect,
  unregisterInvitationArchiveSideEffect,
} from "@/lib/server/workspaces/invitation-archive-effect";

afterEach(() => {
  for (const entry of listRegisteredArchiveSideEffects()) {
    unregisterArchiveSideEffect(entry.id);
  }
  vi.restoreAllMocks();
});

describe("invitationArchiveSideEffect", () => {
  test("exposes the shared archival side-effect id used by the lifecycle coordinator", () => {
    expect(INVITATION_ARCHIVE_EFFECT_ID).toBe("invitations.invalidate");
    expect(invitationArchiveSideEffect.id).toBe(INVITATION_ARCHIVE_EFFECT_ID);
  });

  test("registerInvitationArchiveSideEffect adds the effect to the default registry", () => {
    registerInvitationArchiveSideEffect();
    const ids = listRegisteredArchiveSideEffects().map((entry) => entry.id);
    expect(ids).toContain(INVITATION_ARCHIVE_EFFECT_ID);
  });

  test("register is idempotent under repeated bootstrap", () => {
    registerInvitationArchiveSideEffect();
    registerInvitationArchiveSideEffect();
    const matching = listRegisteredArchiveSideEffects().filter((entry) => entry.id === INVITATION_ARCHIVE_EFFECT_ID);
    expect(matching).toHaveLength(1);
  });

  test("unregister removes the effect from the registry", () => {
    registerInvitationArchiveSideEffect();
    unregisterInvitationArchiveSideEffect();
    const ids = listRegisteredArchiveSideEffects().map((entry) => entry.id);
    expect(ids).not.toContain(INVITATION_ARCHIVE_EFFECT_ID);
  });
});
