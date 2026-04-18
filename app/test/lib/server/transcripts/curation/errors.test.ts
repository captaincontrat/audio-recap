import { describe, expect, test } from "vitest";

import { DeleteRefusedError, PatchRefusedError } from "@/lib/server/transcripts/curation/errors";

describe("PatchRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const err = new PatchRefusedError("workspace_archived");
    expect(err.reason).toBe("workspace_archived");
    expect(err.code).toBe("curation_patch_refused");
    expect(err.name).toBe("PatchRefusedError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PatchRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new PatchRefusedError("not_found").message).toMatch(/not found/i);
    expect(new PatchRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new PatchRefusedError("forbidden").message).toMatch(/role does not allow/i);
    expect(new PatchRefusedError("workspace_archived").message).toMatch(/archived/i);
    expect(new PatchRefusedError("invalid_patch").message).toMatch(/invalid/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new PatchRefusedError("invalid_patch", "tag_too_long").message).toBe("tag_too_long");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new PatchRefusedError("unexpected" as never)).toThrowError(/Unhandled curation patch refusal reason/);
  });
});

describe("DeleteRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const err = new DeleteRefusedError("forbidden");
    expect(err.reason).toBe("forbidden");
    expect(err.code).toBe("curation_delete_refused");
    expect(err.name).toBe("DeleteRefusedError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DeleteRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new DeleteRefusedError("not_found").message).toMatch(/not found/i);
    expect(new DeleteRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new DeleteRefusedError("forbidden").message).toMatch(/cannot delete/i);
    expect(new DeleteRefusedError("workspace_archived").message).toMatch(/archived/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new DeleteRefusedError("forbidden", "creator_attribution_cleared").message).toBe("creator_attribution_cleared");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new DeleteRefusedError("unexpected" as never)).toThrowError(/Unhandled curation delete refusal reason/);
  });
});
