import { describe, expect, test } from "vitest";

import { describePasskey, describePasskeyName, type PasskeyDisplayRow } from "@/lib/auth/passkey-display";

function row(overrides: Partial<PasskeyDisplayRow> = {}): PasskeyDisplayRow {
  return {
    name: "Laptop",
    deviceType: "singleDevice",
    backedUp: false,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    ...overrides,
  };
}

describe("describePasskeyName", () => {
  test("returns the trimmed name when provided", () => {
    expect(describePasskeyName({ name: "  MacBook  " })).toBe("MacBook");
  });

  test("falls back to a neutral label when name is blank", () => {
    expect(describePasskeyName({ name: "" })).toBe("Unnamed passkey");
    expect(describePasskeyName({ name: "   " })).toBe("Unnamed passkey");
  });

  test("falls back to a neutral label when name is null or undefined", () => {
    expect(describePasskeyName({ name: null })).toBe("Unnamed passkey");
    expect(describePasskeyName({})).toBe("Unnamed passkey");
  });
});

describe("describePasskey", () => {
  test("includes the device type, sync label, and formatted date for a backed-up credential", () => {
    const createdAt = new Date("2026-04-01T00:00:00Z");
    const label = describePasskey(row({ deviceType: "multiDevice", backedUp: true, createdAt }));
    expect(label).toContain("multiDevice");
    expect(label).toContain("synced");
    expect(label).toContain(createdAt.toLocaleDateString());
  });

  test("labels device-bound credentials explicitly", () => {
    const label = describePasskey(row({ deviceType: "singleDevice", backedUp: false }));
    expect(label).toContain("device-bound");
    expect(label).not.toContain("synced");
  });

  test("accepts an ISO string for createdAt and formats it consistently", () => {
    const iso = "2026-04-01T00:00:00Z";
    const label = describePasskey(row({ createdAt: iso }));
    expect(label).toContain(new Date(iso).toLocaleDateString());
  });

  test("falls back to 'Unknown date' for null createdAt (enrollment not yet synced)", () => {
    expect(describePasskey(row({ createdAt: null }))).toContain("Unknown date");
  });

  test("falls back to 'Unknown date' when createdAt can't be parsed", () => {
    expect(describePasskey(row({ createdAt: "not-a-real-date" }))).toContain("Unknown date");
  });

  test("falls back to 'Unknown date' when createdAt is undefined", () => {
    const { createdAt: _createdAt, ...rest } = row();
    expect(describePasskey({ ...rest, createdAt: undefined })).toContain("Unknown date");
  });
});
