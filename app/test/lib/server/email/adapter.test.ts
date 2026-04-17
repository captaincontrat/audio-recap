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

const invitationEmail: AuthEmail = {
  type: "workspace-invitation",
  to: "ada@example.com",
  url: "https://app.example.com/invitations?token=abc",
  workspaceName: "Acme",
  inviterName: "Grace",
};

const anonymousInvitationEmail: AuthEmail = {
  type: "workspace-invitation",
  to: "ada@example.com",
  url: "https://app.example.com/invitations?token=xyz",
  workspaceName: "Acme",
  inviterName: null,
};

describe("renderSubject", () => {
  test("uses a verification-specific subject", () => {
    expect(renderSubject(verificationEmail)).toBe("Verify your Summitdown email address");
  });

  test("uses a reset-specific subject", () => {
    expect(renderSubject(resetEmail)).toBe("Reset your Summitdown password");
  });

  test("names the workspace in the invitation subject", () => {
    expect(renderSubject(invitationEmail)).toBe("You're invited to join Acme on Summitdown");
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

  test("greets the user by name in password-reset emails too", () => {
    const namedReset = { ...resetEmail, userName: "Ada" } satisfies AuthEmail;
    expect(renderPlainText(namedReset)).toContain("Hi Ada,");
    expect(renderPlainText(namedReset)).toContain(namedReset.url);
  });

  test("names the inviter and the workspace when available", () => {
    const body = renderPlainText(invitationEmail);
    expect(body).toContain("Grace invited you to join Acme on Summitdown");
    expect(body).toContain(invitationEmail.url);
    expect(body).toContain("expires in 7 days");
  });

  test("falls back to an anonymous invitation opener when inviter name is missing", () => {
    const body = renderPlainText(anonymousInvitationEmail);
    expect(body).toContain("You've been invited to join Acme on Summitdown");
    expect(body).toContain(anonymousInvitationEmail.url);
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
