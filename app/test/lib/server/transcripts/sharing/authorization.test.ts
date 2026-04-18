import { describe, expect, test } from "vitest";

import { canManagePublicSharing } from "@/lib/server/transcripts/sharing/authorization";

// `canManagePublicSharing` is the pure-function gate the service
// layer and the Server Components both reach for. It mirrors the
// curation gate (`admin` + `member` can act, `read_only` cannot) but
// is scoped to the share-management capability so any future
// divergence (e.g. an admin-only mode) would land here without
// rippling through the curation module.
describe("canManagePublicSharing", () => {
  test("permits admin and member", () => {
    expect(canManagePublicSharing("admin")).toBe(true);
    expect(canManagePublicSharing("member")).toBe(true);
  });

  test("refuses read_only", () => {
    expect(canManagePublicSharing("read_only")).toBe(false);
  });

  test("throws exhaustively on an unexpected role", () => {
    expect(() => canManagePublicSharing("ghost" as never)).toThrowError(/Unhandled workspace role/);
  });
});
