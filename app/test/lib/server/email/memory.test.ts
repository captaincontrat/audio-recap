import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { clearCapturedEmails, getCapturedEmails, MemoryEmailAdapter } from "@/lib/server/email/memory";

const STORE_KEY = "__summitdown_test_email_store__";

describe("MemoryEmailAdapter", () => {
  beforeEach(() => {
    clearCapturedEmails();
  });

  afterEach(() => {
    clearCapturedEmails();
    const globalScope = globalThis as typeof globalThis & { [STORE_KEY]?: unknown };
    delete globalScope[STORE_KEY];
  });

  test("captures verification emails keyed by recipient", async () => {
    const adapter = new MemoryEmailAdapter();
    const result = await adapter.send({
      type: "verification",
      to: "user@example.com",
      url: "https://app.example.com/verify?token=abc",
      userName: "Ada",
    });

    expect(result.id.startsWith("memory-")).toBe(true);
    const emails = getCapturedEmails("user@example.com");
    expect(emails).toHaveLength(1);
    const [email] = emails;
    expect(email?.type).toBe("verification");
    expect(email?.subject).toContain("Verify");
    expect(email?.url).toBe("https://app.example.com/verify?token=abc");
  });

  test("getCapturedEmails returns all captured emails when no recipient is provided", async () => {
    const adapter = new MemoryEmailAdapter();
    await adapter.send({ type: "verification", to: "a@example.com", url: "https://a", userName: null });
    await adapter.send({ type: "password-reset", to: "b@example.com", url: "https://b", userName: null });

    const all = getCapturedEmails();
    expect(all).toHaveLength(2);
    expect(all.map((email) => email.to).sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  test("getCapturedEmails returns an empty array for unseen recipients", () => {
    expect(getCapturedEmails("nobody@example.com")).toEqual([]);
  });

  test("clearCapturedEmails removes all captured emails", async () => {
    const adapter = new MemoryEmailAdapter();
    await adapter.send({ type: "verification", to: "user@example.com", url: "https://x", userName: null });
    expect(getCapturedEmails()).toHaveLength(1);

    clearCapturedEmails();
    expect(getCapturedEmails()).toHaveLength(0);
  });

  test("reuses the existing global store across adapter instances", async () => {
    const first = new MemoryEmailAdapter();
    await first.send({ type: "verification", to: "user@example.com", url: "https://1", userName: null });

    const second = new MemoryEmailAdapter();
    await second.send({ type: "verification", to: "user@example.com", url: "https://2", userName: null });

    const emails = getCapturedEmails("user@example.com");
    expect(emails.map((email) => email.url)).toEqual(["https://1", "https://2"]);
  });
});
