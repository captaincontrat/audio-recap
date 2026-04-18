import "server-only";

import { getEmailAdapter } from "../server/email/factory";
import { getServerEnv } from "../server/env";

export type SendMagicLinkArgs = {
  to: string;
  url: string;
  userName?: string | null;
};

// Deliver the magic-link sign-in email. The Better Auth magic-link plugin
// supplies a fully-formed callback URL when it invokes `sendMagicLink`; we
// forward it verbatim to the email adapter and let the plugin's verification
// handler consume the token. Flow-level neutral responses (i.e. returning
// the same "check your inbox" screen whether or not the email exists) live
// in the request layer — this helper is only concerned with delivery.
export async function sendMagicLinkEmail(args: SendMagicLinkArgs): Promise<void> {
  // Touching the env here keeps the helper aligned with the rest of the
  // auth layer, which all reads through `getServerEnv()` so misconfigured
  // deployments fail at startup rather than on the first email attempt.
  getServerEnv();
  const adapter = getEmailAdapter();
  await adapter.send({
    type: "magic-link",
    to: args.to,
    url: args.url,
    userName: args.userName ?? null,
  });
}
