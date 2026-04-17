import { describe, expect, test } from "vitest";

import { resolveDefaultLanding } from "@/lib/server/workspaces/landing";

const PERSONAL = { workspaceId: "ws_personal", slug: "p-abc123" };
const LAST_VALID = {
  workspaceId: "ws_team",
  slug: "acme",
  accessible: true,
  active: true,
};

describe("resolveDefaultLanding", () => {
  test("preserves an authorized explicit destination even when a last-valid workspace exists", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: { path: "/w/acme/settings", isAuthorized: true },
      lastValidWorkspace: LAST_VALID,
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "explicit", path: "/w/acme/settings" });
  });

  test("ignores unauthorized explicit destinations and falls back to last-valid workspace", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: { path: "/w/other/things", isAuthorized: false },
      lastValidWorkspace: LAST_VALID,
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "last", workspaceId: "ws_team", slug: "acme" });
  });

  test("uses last-valid workspace when no explicit destination is provided", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: null,
      lastValidWorkspace: LAST_VALID,
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "last", workspaceId: "ws_team", slug: "acme" });
  });

  test("skips an inaccessible remembered workspace and falls through to personal", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: null,
      lastValidWorkspace: { ...LAST_VALID, accessible: false },
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "personal", workspaceId: "ws_personal", slug: "p-abc123" });
  });

  test("skips an archived remembered workspace and falls through to personal", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: null,
      lastValidWorkspace: { ...LAST_VALID, active: false },
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "personal", workspaceId: "ws_personal", slug: "p-abc123" });
  });

  test("lands on personal when no remembered workspace is available", () => {
    const decision = resolveDefaultLanding({
      explicitDestination: null,
      lastValidWorkspace: null,
      personalWorkspace: PERSONAL,
    });

    expect(decision).toEqual({ kind: "personal", workspaceId: "ws_personal", slug: "p-abc123" });
  });
});
