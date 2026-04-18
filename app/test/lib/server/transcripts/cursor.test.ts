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

  test("round-trips the composite important_created cursor for both directions", () => {
    // `${flag}|${iso}` — flag is `1` for important rows and `0` for
    // plain ones. Owned by `add-transcript-curation-controls`.
    const payload: CursorPayload = {
      column: "important_created",
      value: "1|2026-04-05T10:00:00.000Z",
      id: "transcript_imp_boundary",
    };
    const token = encodeCursor(payload);
    expect(decodeCursor(token, "important_first")).toEqual(payload);
    expect(decodeCursor(token, "important_last")).toEqual(payload);
  });

  test("round-trips the composite tag_sort_key cursor for tagged and untagged boundary rows", () => {
    // Tagged boundary (`t|<sorted-tag-list>`).
    const tagged: CursorPayload = {
      column: "tag_sort_key",
      value: "t|alpha\u0001zulu",
      id: "transcript_tagged_boundary",
    };
    const taggedToken = encodeCursor(tagged);
    expect(decodeCursor(taggedToken, "tag_list_asc")).toEqual(tagged);
    expect(decodeCursor(taggedToken, "tag_list_desc")).toEqual(tagged);

    // Untagged boundary (`u|`) so the paginator knows to sit in the
    // NULL-group when resuming.
    const untagged: CursorPayload = {
      column: "tag_sort_key",
      value: "u|",
      id: "transcript_untagged_boundary",
    };
    const untaggedToken = encodeCursor(untagged);
    expect(decodeCursor(untaggedToken, "tag_list_asc")).toEqual(untagged);
    expect(decodeCursor(untaggedToken, "tag_list_desc")).toEqual(untagged);
  });

  test("round-trips the composite shared_created cursor for both directions", () => {
    // `${flag}|${iso}` — flag is `1` for publicly-shared rows and
    // `0` for non-shared ones. Mirrors the important_created shape
    // so the same paginator logic can handle both families.
    const payload: CursorPayload = {
      column: "shared_created",
      value: "1|2026-04-05T10:00:00.000Z",
      id: "transcript_shared_boundary",
    };
    const token = encodeCursor(payload);
    expect(decodeCursor(token, "shared_first")).toEqual(payload);
    expect(decodeCursor(token, "unshared_first")).toEqual(payload);
  });

  test("refuses to decode a curation cursor under a mismatched sort", () => {
    const importantToken = encodeCursor({ column: "important_created", value: "1|2026-04-01T00:00:00.000Z", id: "id_imp" });
    expect(() => decodeCursor(importantToken, "newest_first")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(importantToken, "tag_list_asc")).toThrowError(/does not match the active sort/);

    const tagToken = encodeCursor({ column: "tag_sort_key", value: "t|alpha", id: "id_tag" });
    expect(() => decodeCursor(tagToken, "title_asc")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(tagToken, "important_first")).toThrowError(/does not match the active sort/);

    const sharedToken = encodeCursor({ column: "shared_created", value: "1|2026-04-01T00:00:00.000Z", id: "id_shared" });
    expect(() => decodeCursor(sharedToken, "newest_first")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(sharedToken, "important_first")).toThrowError(/does not match the active sort/);
    expect(() => decodeCursor(sharedToken, "tag_list_asc")).toThrowError(/does not match the active sort/);
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
