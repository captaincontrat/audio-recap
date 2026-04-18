import "server-only";

import { type AuthEmail, type EmailAdapter, renderPlainText, renderSubject, type SendResult } from "@/lib/server/email/adapter";

export type CapturedEmail = {
  id: string;
  to: string;
  subject: string;
  text: string;
  type: AuthEmail["type"];
  // Link-bearing auth emails (verification, password reset, magic link,
  // workspace invitations) ship a URL that the e2e harness extracts to
  // exercise the follow-up flow. The two-factor OTP path does not have a
  // URL — the numeric code is delivered directly instead — so callers
  // reading `url` must treat it as optional. `code` is populated only for
  // the OTP path and left empty otherwise.
  url: string;
  code: string;
  createdAt: string;
};

type Store = Map<string, CapturedEmail[]>;

const STORE_KEY = "__summitdown_test_email_store__";

function getStore(): Store {
  const globalScope = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  if (!globalScope[STORE_KEY]) {
    globalScope[STORE_KEY] = new Map<string, CapturedEmail[]>();
  }
  return globalScope[STORE_KEY];
}

export class MemoryEmailAdapter implements EmailAdapter {
  async send(email: AuthEmail): Promise<SendResult> {
    const store = getStore();
    const entries = store.get(email.to) ?? [];
    const id = `memory-${Date.now()}-${entries.length}`;
    const captured: CapturedEmail = {
      id,
      to: email.to,
      subject: renderSubject(email),
      text: renderPlainText(email),
      type: email.type,
      url: email.type === "two-factor-otp" ? "" : email.url,
      code: email.type === "two-factor-otp" ? email.code : "",
      createdAt: new Date().toISOString(),
    };
    entries.push(captured);
    store.set(email.to, entries);
    return { id };
  }
}

export function getCapturedEmails(to?: string): CapturedEmail[] {
  const store = getStore();
  if (to) {
    return [...(store.get(to) ?? [])];
  }
  return Array.from(store.values()).flat();
}

export function clearCapturedEmails(): void {
  getStore().clear();
}
