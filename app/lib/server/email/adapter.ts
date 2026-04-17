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

export type AuthEmail = VerificationEmail | PasswordResetEmail;

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
  }
}

export function renderPlainText(email: AuthEmail): string {
  const greeting = email.userName ? `Hi ${email.userName},` : "Hi,";

  switch (email.type) {
    case "verification":
      return [
        greeting,
        "",
        "Confirm your email address by opening the link below. The link can be used once and expires soon:",
        "",
        email.url,
        "",
        "If you did not create a Summitdown account you can ignore this message.",
      ].join("\n");
    case "password-reset":
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
