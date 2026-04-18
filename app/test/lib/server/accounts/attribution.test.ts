import { describe, expect, test } from "vitest";

import { DELETED_USER_ATTRIBUTION_LABEL, renderCreatorAttribution } from "@/lib/server/accounts/attribution";

describe("renderCreatorAttribution", () => {
  test("returns the generic label when the creator FK has been nulled", () => {
    expect(renderCreatorAttribution({ createdByUserId: null })).toBe(DELETED_USER_ATTRIBUTION_LABEL);
  });

  test("returns the generic label when a creator is still linked but has no display name", () => {
    expect(renderCreatorAttribution({ createdByUserId: "u_1", creatorDisplayName: null })).toBe(DELETED_USER_ATTRIBUTION_LABEL);
    expect(renderCreatorAttribution({ createdByUserId: "u_1", creatorDisplayName: "" })).toBe(DELETED_USER_ATTRIBUTION_LABEL);
    expect(renderCreatorAttribution({ createdByUserId: "u_1", creatorDisplayName: "   " })).toBe(DELETED_USER_ATTRIBUTION_LABEL);
  });

  test("returns the trimmed display name when the creator is live", () => {
    expect(renderCreatorAttribution({ createdByUserId: "u_1", creatorDisplayName: " Ada Lovelace " })).toBe(" Ada Lovelace ".trim());
  });

  test("null-FK always wins over a lingering display name", () => {
    expect(renderCreatorAttribution({ createdByUserId: null, creatorDisplayName: "Ghost" })).toBe(DELETED_USER_ATTRIBUTION_LABEL);
  });
});
