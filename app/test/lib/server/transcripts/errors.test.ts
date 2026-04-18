import { describe, expect, test } from "vitest";

import { DetailReadRefusedError, LibraryReadRefusedError } from "@/lib/server/transcripts/errors";

describe("LibraryReadRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const error = new LibraryReadRefusedError("workspace_archived");
    expect(error.reason).toBe("workspace_archived");
    expect(error.code).toBe("library_read_refused");
    expect(error.name).toBe("LibraryReadRefusedError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LibraryReadRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new LibraryReadRefusedError("not_found").message).toMatch(/workspace not found/i);
    expect(new LibraryReadRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new LibraryReadRefusedError("workspace_archived").message).toMatch(/archived/i);
    expect(new LibraryReadRefusedError("invalid_query").message).toMatch(/invalid/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new LibraryReadRefusedError("not_found", "custom").message).toBe("custom");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new LibraryReadRefusedError("unexpected" as never)).toThrowError(/Unhandled library read refusal reason/);
  });
});

describe("DetailReadRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const error = new DetailReadRefusedError("not_found");
    expect(error.reason).toBe("not_found");
    expect(error.code).toBe("detail_read_refused");
    expect(error.name).toBe("DetailReadRefusedError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DetailReadRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new DetailReadRefusedError("not_found").message).toMatch(/transcript not found/i);
    expect(new DetailReadRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new DetailReadRefusedError("workspace_archived").message).toMatch(/archived/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new DetailReadRefusedError("workspace_archived", "specific").message).toBe("specific");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new DetailReadRefusedError("unexpected" as never)).toThrowError(/Unhandled detail read refusal reason/);
  });
});
