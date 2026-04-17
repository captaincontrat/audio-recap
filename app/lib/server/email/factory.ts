import "server-only";

import type { EmailAdapter } from "@/lib/server/email/adapter";
import { ConsoleEmailAdapter } from "@/lib/server/email/console";
import { MemoryEmailAdapter } from "@/lib/server/email/memory";
import { SesEmailAdapter } from "@/lib/server/email/ses";
import { getServerEnv } from "@/lib/server/env";

let adapter: EmailAdapter | undefined;

export function getEmailAdapter(): EmailAdapter {
  if (adapter) return adapter;

  const env = getServerEnv();

  switch (env.EMAIL_PROVIDER) {
    case "ses":
      adapter = new SesEmailAdapter({
        region: env.AWS_REGION,
        from: env.EMAIL_FROM,
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      });
      return adapter;
    case "console":
      adapter = new ConsoleEmailAdapter({ from: env.EMAIL_FROM });
      return adapter;
    case "memory":
      adapter = new MemoryEmailAdapter();
      return adapter;
  }
}

export function setEmailAdapterForTests(next: EmailAdapter | undefined): void {
  adapter = next;
}
