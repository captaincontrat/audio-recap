import { describe, expect, test } from "vitest";

import { CursorDecodeError, type CursorPayload, decodeCursor, encodeCursor } from "@/lib/server/transcripts/cursor";

describe("encodeCursor", () => {
  test("emits base64url output (no +, /, or = padding)", () => {
    const token = encodeCursor({ column: "created_at", value: "2026-04-18T01:00:00.000Z", id: "transcript_abc" });
    expect(token).not.toMatch(/[+/=]/);
    expect(token.length).toBeGreaterThan(0);
  });

  test("round-trips payload values through decodeCursor", () => {
    const payload: CursorPayload = {
      column: "updated_at",
      value: "2026-04-18T02:30:00.000Z",
      id: "transcript_xyz",
    };
    const token = encodeCursor(payload);
    expect(decodeCursor(token, "recently_updated")).toEqual(payload);
  });

  test("round-trips title cursors without losing case in the boundary value", () => {
    const payload: CursorPayload = {
      column: "title",
      value: "project kickoff",
      id: "transcript_title_sorted",
    };
    const token = encodeCursor(payload);
    expect(decodeCursor(token, "title_asc")).toEqual(payload);
    expect(decodeCursor(token, "title_desc")).toEqual(payload);
  });
});

describe("decodeCursor", () => {
  test("rejects an empty token", () => {
    expect(() => decodeCursor("", "newest_first")).toThrowError(CursorDecodeError);
  });

  test("rejects unparseable base64url", () => {
    expect(() => decodeCursor("this_is_not_base64!!!", "newest_first")).toThrow();
  });

  test("rejects base64url that does not decode to JSON", () => {
    const junk = Buffer.from("not-json", "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => decodeCursor(junk, "newest_first")).toThrowError(CursorDecodeError);
  });

  test("rejects JSON that does not describe a cursor", () => {
    const cases = [
      "null",
      '"just a string"',
      "[1,2,3]",
      '{"column":"created_at"}',
      '{"column":"created_at","value":"x"}',
      '{"column":"created_at","value":"x","id":""}',
      '{"column":"bogus","value":"x","id":"id_1"}',
      '{"column":"created_at","value":42,"id":"id_1"}',
      '{"column":"created_at","value":"x","id":true}',
    ];
    for (const raw of cases) {
      const token = Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      expect(() => decodeCursor(token, "newest_first")).toThrowError(CursorDecodeError);
    }
  });

  test("rejects a cursor whose column does not match the active sort", () => {
    const titleToken = encodeCursor({ column: "title", value: "foo", id: "id_1" });
    expect(() => decodeCursor(titleToken, "newest_first")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(titleToken, "recently_updated")).toThrowError(/does not match the active sort/);

    const createdToken = encodeCursor({ column: "created_at", value: "2026-01-01T00:00:00.000Z", id: "id_1" });
    expect(() => decodeCursor(createdToken, "recently_updated")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(createdToken, "title_asc")).toThrowError(/does not match the active sort/);

    const updatedToken = encodeCursor({ column: "updated_at", value: "2026-01-01T00:00:00.000Z", id: "id_1" });
    expect(() => decodeCursor(updatedToken, "newest_first")).toThrowError(/does not match the active sort/);
  });

  test("accepts cursors whose column matches the active sort column", () => {
    const createdToken = encodeCursor({ column: "created_at", value: "2026-01-01T00:00:00.000Z", id: "id_1" });
    expect(decodeCursor(createdToken, "newest_first").column).toBe("created_at");
    expect(decodeCursor(createdToken, "oldest_first").column).toBe("created_at");
  });
});

describe("CursorDecodeError", () => {
  test("has a stable code literal for route-handler branching", () => {
    const error = new CursorDecodeError();
    expect(error.code).toBe("cursor_decode_failed");
    expect(error.name).toBe("CursorDecodeError");
    expect(error).toBeInstanceOf(Error);
  });

  test("honors a custom message", () => {
    const error = new CursorDecodeError("specific");
    expect(error.message).toBe("specific");
  });

  test("defaults to a descriptive message", () => {
    const error = new CursorDecodeError();
    expect(error.message).toMatch(/malformed|expired/i);
  });
});
