import { describe, expect, test } from "vitest";

import { type AuthEmail, renderHtml, renderPlainText, renderSubject } from "@/lib/server/email/adapter";

const verificationEmail: AuthEmail = {
  type: "verification",
  to: "user@example.com",
  url: "https://app.example.com/verify?token=abc",
  userName: "User",
};

const resetEmail: AuthEmail = {
  type: "password-reset",
  to: "user@example.com",
  url: "https://app.example.com/reset?token=abc",
  userName: null,
};

describe("renderSubject", () => {
  test("uses a verification-specific subject", () => {
    expect(renderSubject(verificationEmail)).toBe("Verify your Summitdown email address");
  });

  test("uses a reset-specific subject", () => {
    expect(renderSubject(resetEmail)).toBe("Reset your Summitdown password");
  });
});

describe("renderPlainText", () => {
  test("greets the user by name when available", () => {
    expect(renderPlainText(verificationEmail)).toContain("Hi User,");
    expect(renderPlainText(verificationEmail)).toContain(verificationEmail.url);
  });

  test("falls back to an anonymous greeting when name is missing", () => {
    expect(renderPlainText(resetEmail).startsWith("Hi,")).toBe(true);
    expect(renderPlainText(resetEmail)).toContain(resetEmail.url);
  });
});

describe("renderHtml", () => {
  test("escapes user-controlled content", () => {
    const escaped = renderHtml({
      ...verificationEmail,
      userName: "<b>Mallory</b>",
    });

    expect(escaped).not.toContain("<b>Mallory</b>");
    expect(escaped).toContain("&lt;b&gt;Mallory&lt;/b&gt;");
  });

  test("renders verification body paragraphs as HTML", () => {
    const html = renderHtml(verificationEmail);
    expect(html).toContain("<p>");
    expect(html).toContain(verificationEmail.url);
  });

  test("escapes all reserved HTML characters", () => {
    const html = renderHtml({
      ...verificationEmail,
      userName: `"O'Reilly" & < > chars`,
    });

    expect(html).toContain("&quot;");
    expect(html).toContain("&#39;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
  });
});
