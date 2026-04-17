import "server-only";

import { type AuthEmail, type EmailAdapter, renderPlainText, renderSubject, type SendResult } from "@/lib/server/email/adapter";
import { childLogger } from "@/lib/server/logger";

type Sink = (email: AuthEmail, rendered: { subject: string; text: string }) => void;

export type ConsoleEmailAdapterOptions = {
  sink?: Sink;
  from: string;
};

export class ConsoleEmailAdapter implements EmailAdapter {
  private readonly sink: Sink;
  private readonly log = childLogger({ component: "email.console" });
  private readonly from: string;

  constructor(options: ConsoleEmailAdapterOptions) {
    this.from = options.from;
    this.sink = options.sink ?? this.defaultSink.bind(this);
  }

  private defaultSink(email: AuthEmail, rendered: { subject: string; text: string }): void {
    this.log.info({ from: this.from, to: email.to, subject: rendered.subject, type: email.type }, "email delivered to console sink");
    this.log.debug({ body: rendered.text }, "email body");
  }

  async send(email: AuthEmail): Promise<SendResult> {
    const rendered = { subject: renderSubject(email), text: renderPlainText(email) };
    this.sink(email, rendered);
    return { id: `console-${Date.now()}` };
  }
}
