import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { TwoFactorSettings } from "@/components/features/auth/two-factor-settings";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";

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
    </main>
  );
}
