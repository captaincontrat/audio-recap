import { describe, expect, test } from "vitest";

import { detailReadRefusalToHttpStatus, libraryReadRefusalToHttpStatus } from "@/lib/server/transcripts/http-status";

describe("libraryReadRefusalToHttpStatus", () => {
  test("maps every library refusal reason to a stable HTTP status", () => {
    expect(libraryReadRefusalToHttpStatus("not_found")).toBe(404);
    expect(libraryReadRefusalToHttpStatus("access_denied")).toBe(403);
    expect(libraryReadRefusalToHttpStatus("workspace_archived")).toBe(409);
    expect(libraryReadRefusalToHttpStatus("invalid_query")).toBe(400);
  });

  test("throws for an unexpected library refusal reason", () => {
    expect(() => libraryReadRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled library read refusal reason/);
  });
});

describe("detailReadRefusalToHttpStatus", () => {
  test("maps every detail refusal reason to a stable HTTP status", () => {
    expect(detailReadRefusalToHttpStatus("not_found")).toBe(404);
    expect(detailReadRefusalToHttpStatus("access_denied")).toBe(403);
    expect(detailReadRefusalToHttpStatus("workspace_archived")).toBe(409);
  });

  test("throws for an unexpected detail refusal reason", () => {
    expect(() => detailReadRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled detail read refusal reason/);
  });
});
