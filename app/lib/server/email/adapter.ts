import "server-only";

export type VerificationEmail = {
  type: "verification";
  to: string;
  url: string;
  userName?: string | null;
};

export type PasswordResetEmail = {
  type: "password-reset";
  to: string;
  url: string;
  userName?: string | null;
};

export type WorkspaceInvitationEmail = {
  type: "workspace-invitation";
  to: string;
  url: string;
  workspaceName: string;
  inviterName?: string | null;
};

// Sent by the Better Auth magic-link plugin. `url` contains the single-use
// verification token; the plugin stores it in the `verification` table and
// consumes it on callback. `userName` is optional because magic-link sign-in
// also applies to brand-new accounts whose profile we haven't met yet.
export type MagicLinkEmail = {
  type: "magic-link";
  to: string;
  url: string;
  userName?: string | null;
};

// Sent by the Better Auth `twoFactor` plugin when the user picks "email me a
// code" as the alternate second factor. `code` is the short numeric OTP the
// user types back into the challenge form — NOT a link — so the shape is
// intentionally different from the other auth emails in this union. The
// plugin generates and persists the code in its own verification store;
// this adapter is only responsible for delivery.
export type TwoFactorOtpEmail = {
  type: "two-factor-otp";
  to: string;
  code: string;
  userName?: string | null;
};

export type AuthEmail = VerificationEmail | PasswordResetEmail | WorkspaceInvitationEmail | MagicLinkEmail | TwoFactorOtpEmail;

export type SendResult = {
  id: string;
};

export interface EmailAdapter {
  send(email: AuthEmail): Promise<SendResult>;
}

export function renderSubject(email: AuthEmail): string {
  switch (email.type) {
    case "verification":
      return "Verify your Summitdown email address";
    case "password-reset":
      return "Reset your Summitdown password";
    case "workspace-invitation":
      return `You're invited to join ${email.workspaceName} on Summitdown`;
    case "magic-link":
      return "Your Summitdown sign-in link";
    case "two-factor-otp":
      return "Your Summitdown verification code";
  }
}

export function renderPlainText(email: AuthEmail): string {
  switch (email.type) {
    case "verification": {
      const greeting = email.userName ? `Hi ${email.userName},` : "Hi,";
      return [
        greeting,
        "",
        "Confirm your email address by opening the link below. The link can be used once and expires soon:",
        "",
        email.url,
        "",
        "If you did not create a Summitdown account you can ignore this message.",
      ].join("\n");
    }
    case "password-reset": {
      const greeting = email.userName ? `Hi ${email.userName},` : "Hi,";
      return [
        greeting,
        "",
        "We received a request to reset the password on your Summitdown account.",
        "",
        "If you made this request, open the link below to choose a new password. The link can be used once and expires soon:",
        "",
        email.url,
        "",
        "If you did not request a password reset you can ignore this message.",
      ].join("\n");
    }
    case "workspace-invitation": {
      const opener = email.inviterName
        ? `${email.inviterName} invited you to join ${email.workspaceName} on Summitdown.`
        : `You've been invited to join ${email.workspaceName} on Summitdown.`;
      return [
        "Hi,",
        "",
        opener,
        "",
        "Open the link below to accept the invitation. The link can be used once and expires in 7 days:",
        "",
        email.url,
        "",
        "If you were not expecting this invitation you can ignore this message.",
      ].join("\n");
    }
    case "magic-link": {
      const greeting = email.userName ? `Hi ${email.userName},` : "Hi,";
      return [
        greeting,
        "",
        "Use the link below to sign in to Summitdown. The link can be used once and expires soon:",
        "",
        email.url,
        "",
        "If you did not request this link you can ignore this message — your account stays signed out.",
      ].join("\n");
    }
    case "two-factor-otp": {
      const greeting = email.userName ? `Hi ${email.userName},` : "Hi,";
      return [
        greeting,
        "",
        "Use this verification code to finish signing in to Summitdown. The code can be used once and expires in a few minutes:",
        "",
        email.code,
        "",
        "If you did not try to sign in you can ignore this message — your account stays protected by your second factor.",
      ].join("\n");
    }
  }
}

export function renderHtml(email: AuthEmail): string {
  const paragraphs = renderPlainText(email)
    .split("\n\n")
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
  return `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.5;">${paragraphs}</body></html>`;
}

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  // The regex character class is kept in lockstep with `HTML_ENTITIES`, so
  // every match is guaranteed to have an entry. Without
  // `noUncheckedIndexedAccess` the indexer is typed as `string`, which keeps
  // the replacer free of an unreachable fallback branch.
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}
