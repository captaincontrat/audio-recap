import { describe, expect, test } from "vitest";

import { editSessionRefusalToHttpStatus } from "@/lib/server/transcripts/edit-sessions/http-status";

describe("editSessionRefusalToHttpStatus", () => {
  test("maps every refusal reason to a stable HTTP status", () => {
    expect(editSessionRefusalToHttpStatus("not_found")).toBe(404);
    expect(editSessionRefusalToHttpStatus("access_denied")).toBe(403);
    expect(editSessionRefusalToHttpStatus("workspace_archived")).toBe(409);
    expect(editSessionRefusalToHttpStatus("role_not_authorized")).toBe(403);
    expect(editSessionRefusalToHttpStatus("already_locked")).toBe(409);
    expect(editSessionRefusalToHttpStatus("session_expired")).toBe(410);
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => editSessionRefusalToHttpStatus("unexpected" as never)).toThrowError(/Unhandled edit-session refusal reason/);
  });
});
