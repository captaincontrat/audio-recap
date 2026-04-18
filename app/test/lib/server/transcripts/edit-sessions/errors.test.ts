import { describe, expect, test } from "vitest";

import { SessionRefusedError } from "@/lib/server/transcripts/edit-sessions/errors";

describe("SessionRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const error = new SessionRefusedError("already_locked");
    expect(error.reason).toBe("already_locked");
    expect(error.code).toBe("edit_session_refused");
    expect(error.name).toBe("SessionRefusedError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SessionRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new SessionRefusedError("not_found").message).toMatch(/transcript not found/i);
    expect(new SessionRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new SessionRefusedError("workspace_archived").message).toMatch(/archived/i);
    expect(new SessionRefusedError("role_not_authorized").message).toMatch(/cannot edit/i);
    expect(new SessionRefusedError("already_locked").message).toMatch(/another edit session/i);
    expect(new SessionRefusedError("session_expired").message).toMatch(/expired/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new SessionRefusedError("already_locked", "custom").message).toBe("custom");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new SessionRefusedError("unexpected" as never)).toThrowError(/Unhandled edit-session refusal reason/);
  });
});
