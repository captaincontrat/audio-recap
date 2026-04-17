import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { type AuthEmail, type EmailAdapter, renderHtml, renderPlainText, renderSubject, type SendResult } from "@/lib/server/email/adapter";
import { childLogger } from "@/lib/server/logger";

export type SesEmailAdapterOptions = {
  region: string;
  from: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

export class SesEmailAdapter implements EmailAdapter {
  private readonly client: SESv2Client;
  private readonly from: string;
  private readonly log = childLogger({ component: "email.ses" });

  constructor(options: SesEmailAdapterOptions) {
    this.from = options.from;
    this.client = new SESv2Client({
      region: options.region,
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
    });
  }

  async send(email: AuthEmail): Promise<SendResult> {
    const subject = renderSubject(email);
    const command = new SendEmailCommand({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: renderPlainText(email), Charset: "UTF-8" },
            Html: { Data: renderHtml(email), Charset: "UTF-8" },
          },
        },
      },
    });

    try {
      const response = await this.client.send(command);
      const id = response.MessageId ?? `ses-${Date.now()}`;
      this.log.info({ to: email.to, subject, type: email.type, messageId: id }, "email delivered via SES");
      return { id };
    } catch (err) {
      this.log.error({ err, to: email.to, type: email.type }, "email delivery failed");
      throw err;
    }
  }
}
