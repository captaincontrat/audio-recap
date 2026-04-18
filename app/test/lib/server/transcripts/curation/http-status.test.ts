import { describe, expect, test } from "vitest";

import { deleteRefusalToHttpStatus, patchRefusalToHttpStatus } from "@/lib/server/transcripts/curation/http-status";

describe("patchRefusalToHttpStatus", () => {
  test("maps every patch refusal reason to a stable HTTP status", () => {
    expect(patchRefusalToHttpStatus("not_found")).toBe(404);
    expect(patchRefusalToHttpStatus("access_denied")).toBe(403);
    expect(patchRefusalToHttpStatus("forbidden")).toBe(403);
    expect(patchRefusalToHttpStatus("workspace_archived")).toBe(409);
    expect(patchRefusalToHttpStatus("invalid_patch")).toBe(400);
  });

  test("throws for an unexpected patch refusal reason", () => {
    expect(() => patchRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled curation patch refusal reason/);
  });
});

describe("deleteRefusalToHttpStatus", () => {
  test("maps every delete refusal reason to a stable HTTP status", () => {
    expect(deleteRefusalToHttpStatus("not_found")).toBe(404);
    expect(deleteRefusalToHttpStatus("access_denied")).toBe(403);
    expect(deleteRefusalToHttpStatus("forbidden")).toBe(403);
    expect(deleteRefusalToHttpStatus("workspace_archived")).toBe(409);
  });

  test("throws for an unexpected delete refusal reason", () => {
    expect(() => deleteRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled curation delete refusal reason/);
  });
});
