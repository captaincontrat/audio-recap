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

const magicLinkEmail: AuthEmail = {
  type: "magic-link",
  to: "ada@example.com",
  url: "https://app.example.com/api/auth/magic-link/verify?token=abc",
  userName: "Ada",
};

const anonymousMagicLinkEmail: AuthEmail = {
  type: "magic-link",
  to: "ada@example.com",
  url: "https://app.example.com/api/auth/magic-link/verify?token=xyz",
  userName: null,
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

  test("uses a magic-link-specific subject", () => {
    expect(renderSubject(magicLinkEmail)).toBe("Your Summitdown sign-in link");
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

  test("greets the user by name in magic-link emails and includes the URL", () => {
    const body = renderPlainText(magicLinkEmail);
    expect(body.startsWith("Hi Ada,")).toBe(true);
    expect(body).toContain(magicLinkEmail.url);
    expect(body).toContain("Use the link below to sign in to Summitdown");
  });

  test("falls back to an anonymous greeting for magic-link emails when the user is unknown", () => {
    const body = renderPlainText(anonymousMagicLinkEmail);
    expect(body.startsWith("Hi,")).toBe(true);
    expect(body).toContain(anonymousMagicLinkEmail.url);
  });

  test("reminds the reader that the link is single-use and the account stays signed out on no-op", () => {
    const body = renderPlainText(magicLinkEmail);
    expect(body).toContain("can be used once");
    expect(body).toContain("your account stays signed out");
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
