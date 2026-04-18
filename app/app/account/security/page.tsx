import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

import { TwoFactorSettings } from "@/components/features/auth/two-factor-settings";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { REACTIVATION_WINDOW_DAYS } from "@/lib/server/accounts";
import { getDb } from "@/lib/server/db/client";
import { user as userTable } from "@/lib/server/db/schema";

export const metadata = {
  title: "Account security",
};

// Recent-auth gate: two-factor management is sensitive enough that we
// require a fresh authentication marker before rendering the controls.
// Middleware already blocks unauthenticated users from reaching this
// page (`/account` is in the protected prefix list), so on arrival the
// only way to be bounced is a stale elevation window.
export default async function AccountSecurityPage() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.session || !session.user) {
    redirect("/sign-in?from=/account/security");
  }

  const closureRow = await getDb().select({ closedAt: userTable.closedAt }).from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
  if (closureRow[0]?.closedAt) {
    redirect("/account/closed");
  }

  const recent = await verifyRecentAuth(session.session.id);
  if (!recent.ok) {
    redirect("/account/recent-auth?from=/account/security");
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Account security</h1>
        <p className="text-sm text-muted-foreground">
          Add a second step to sign-ins and manage your recovery options. Two-factor authentication is optional but strongly recommended.
        </p>
      </header>

      <TwoFactorSettings initialEnabled={Boolean(session.user.twoFactorEnabled)} />

      <section className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-medium text-destructive">Close account</h2>
          <p className="text-sm text-muted-foreground">
            Closing your account signs you out everywhere and starts a {REACTIVATION_WINDOW_DAYS}-day reactivation window. After the window elapses the account
            is permanently deleted.
          </p>
        </header>
        <div>
          <Button asChild variant="destructive">
            <Link href="/account/close">Close my account…</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
