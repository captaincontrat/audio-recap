import { describe, expect, test } from "vitest";

import { shareManagementRefusalToHttpStatus } from "@/lib/server/transcripts/sharing/http-status";

// The public-resolve path intentionally has no status map (every
// refusal collapses to a generic 404 driven by the route handler),
// so only the management mapping needs tests here.
describe("shareManagementRefusalToHttpStatus", () => {
  test("maps every share management refusal reason to a stable HTTP status", () => {
    expect(shareManagementRefusalToHttpStatus("not_found")).toBe(404);
    expect(shareManagementRefusalToHttpStatus("access_denied")).toBe(403);
    expect(shareManagementRefusalToHttpStatus("forbidden")).toBe(403);
    expect(shareManagementRefusalToHttpStatus("workspace_archived")).toBe(409);
    expect(shareManagementRefusalToHttpStatus("transcript_not_completed")).toBe(409);
    expect(shareManagementRefusalToHttpStatus("share_not_enabled")).toBe(409);
  });

  test("throws for an unexpected refusal reason", () => {
    expect(() => shareManagementRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled share management refusal reason/);
  });
});
