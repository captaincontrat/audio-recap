import "server-only";

import { getEmailAdapter } from "../server/email/factory";
import { getServerEnv } from "../server/env";

export type SendTwoFactorOtpArgs = {
  to: string;
  code: string;
  userName?: string | null;
};

// Deliver the short numeric OTP that the Better Auth `twoFactor` plugin
// generates for the email second-factor path. The plugin produces and
// persists the code through its own OTP store; this helper is purely a
// delivery shim that hands the code to the configured email adapter. We
// read `getServerEnv()` eagerly so a misconfigured deployment fails at
// startup instead of silently on the first challenge.
export async function sendTwoFactorOtpEmail(args: SendTwoFactorOtpArgs): Promise<void> {
  getServerEnv();
  const adapter = getEmailAdapter();
  await adapter.send({
    type: "two-factor-otp",
    to: args.to,
    code: args.code,
    userName: args.userName ?? null,
  });
}
