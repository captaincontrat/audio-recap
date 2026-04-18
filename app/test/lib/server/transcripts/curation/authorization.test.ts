import { describe, expect, test } from "vitest";

import { canPatchCuration, evaluateDeleteAuthorization } from "@/lib/server/transcripts/curation/authorization";

describe("canPatchCuration", () => {
  test("permits admin and member", () => {
    expect(canPatchCuration("admin")).toBe(true);
    expect(canPatchCuration("member")).toBe(true);
  });

  test("refuses read_only", () => {
    expect(canPatchCuration("read_only")).toBe(false);
  });

  test("throws exhaustively on an unexpected role", () => {
    expect(() => canPatchCuration("ghost" as never)).toThrowError(/Unhandled workspace role/);
  });
});

describe("evaluateDeleteAuthorization", () => {
  const member = { role: "member" as const };
  const admin = { role: "admin" as const };
  const readOnly = { role: "read_only" as const };

  test("admin is allowed regardless of creator attribution", () => {
    expect(evaluateDeleteAuthorization({ ...admin, requestingUserId: "u_admin", transcriptCreatedByUserId: "u_other" })).toEqual({ kind: "allow" });
    expect(evaluateDeleteAuthorization({ ...admin, requestingUserId: "u_admin", transcriptCreatedByUserId: null })).toEqual({ kind: "allow" });
    expect(evaluateDeleteAuthorization({ ...admin, requestingUserId: "u_admin", transcriptCreatedByUserId: "u_admin" })).toEqual({ kind: "allow" });
  });

  test("member is allowed when they are the creator", () => {
    expect(evaluateDeleteAuthorization({ ...member, requestingUserId: "u_me", transcriptCreatedByUserId: "u_me" })).toEqual({ kind: "allow" });
  });

  test("member is refused when the transcript was created by another user", () => {
    const decision = evaluateDeleteAuthorization({ ...member, requestingUserId: "u_me", transcriptCreatedByUserId: "u_other" });
    expect(decision).toEqual({ kind: "refuse", reason: "not_creator" });
  });

  test("member is refused when the creator account was permanently deleted", () => {
    const decision = evaluateDeleteAuthorization({ ...member, requestingUserId: "u_me", transcriptCreatedByUserId: null });
    expect(decision).toEqual({ kind: "refuse", reason: "creator_attribution_cleared" });
  });

  test("read_only has no delete authority even if they were the creator", () => {
    const decision = evaluateDeleteAuthorization({ ...readOnly, requestingUserId: "u_me", transcriptCreatedByUserId: "u_me" });
    expect(decision).toEqual({ kind: "refuse", reason: "role_not_permitted" });
  });

  test("throws exhaustively on an unexpected role", () => {
    expect(() =>
      evaluateDeleteAuthorization({
        role: "ghost" as never,
        requestingUserId: "u",
        transcriptCreatedByUserId: null,
      }),
    ).toThrowError(/Unhandled workspace role/);
  });
});
