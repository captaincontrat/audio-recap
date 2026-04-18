import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseAccountButton } from "@/components/features/account/close-account-button";
import { FreshSignInButton } from "@/components/features/account/fresh-sign-in-button";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "@/lib/auth/two-factor-config";
import { evaluateAdminHandoffForClosure } from "@/lib/server/accounts";
import { getDb } from "@/lib/server/db/client";
import { session as sessionTable, twoFactor as twoFactorTable, user as userTable } from "@/lib/server/db/schema";

export const metadata = {
  title: "Close your account",
};

export const dynamic = "force-dynamic";

// Account closure confirmation page. Middleware already blocks
// unauthenticated visitors; this page additionally enforces the
// step-up prerequisites so the user reaches the confirm button only
// once every gate is green.
//
// Gates (short-circuit order):
//   1. Session + active account — closed accounts land on `/account/closed`.
//   2. Recent authentication — stale session bounces to the password
//      re-verify prompt.
//   3. Fresh second-factor (only when 2FA is enabled) — we detect a
//      stale `session.createdAt` and require the user to sign out and
//      sign back in so the next session is created via a full sign-in
//      that includes 2FA.
//   4. Last-eligible-active-admin handoff — surfaces the blocking
//      workspaces so the user can resolve them before retrying.
export default async function CloseAccountPage() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.session || !session.user) {
    redirect("/sign-in?from=/account/close");
  }

  const db = getDb();
  const userRows = await db
    .select({ closedAt: userTable.closedAt, twoFactorEnabled: userTable.twoFactorEnabled })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const userRow = userRows[0];
  if (!userRow) {
    redirect("/sign-in?from=/account/close");
  }
  if (userRow.closedAt) {
    redirect("/account/closed");
  }

  const recent = await verifyRecentAuth(session.session.id);
  if (!recent.ok) {
    redirect("/account/recent-auth?from=/account/close");
  }

  let freshTwoFactorOk = true;
  if (userRow.twoFactorEnabled) {
    const verifiedRows = await db
      .select({ verified: twoFactorTable.verified })
      .from(twoFactorTable)
      .where(and(eq(twoFactorTable.userId, session.user.id), eq(twoFactorTable.verified, true)))
      .limit(1);
    if (verifiedRows[0]?.verified) {
      const sessionRows = await db.select({ createdAt: sessionTable.createdAt }).from(sessionTable).where(eq(sessionTable.id, session.session.id)).limit(1);
      const createdAt = sessionRows[0]?.createdAt;
      freshTwoFactorOk = createdAt ? (Date.now() - createdAt.getTime()) / 1000 <= RECENT_AUTH_MAX_AGE_SECONDS : false;
    }
  }

  const adminChecks = await evaluateAdminHandoffForClosure({ userId: session.user.id });
  const blockingWorkspaces = adminChecks.filter((check) => check.lastEligibleActiveAdmin).map((check) => check.workspaceId);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Close your account</h1>
        <p className="text-sm text-muted-foreground">
          Closing your account signs you out on every device and starts a 30-day window during which you can reactivate by signing in again. After the window
          elapses the account is permanently deleted.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
        <h2 className="font-medium">What happens right away</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Your active sessions are revoked.</li>
          <li>You lose access to dashboards, meetings, and team workspaces.</li>
          <li>Your personal workspace is preserved during the 30-day window.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
        <h2 className="font-medium">After 30 days</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Your account is permanently deleted.</li>
          <li>Your personal workspace is deleted with it.</li>
          <li>Transcripts in shared team workspaces remain under those workspaces.</li>
        </ul>
      </section>

      {!freshTwoFactorOk ? (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <h2 className="font-medium text-destructive">One more step</h2>
          <p className="text-muted-foreground">
            Closing your account requires a fresh sign-in with your authenticator. Sign out, sign in again with your password and two-factor code, then return
            to this page to confirm.
          </p>
          <div>
            <FreshSignInButton destination="/account/close" />
          </div>
        </section>
      ) : null}

      {blockingWorkspaces.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <h2 className="font-medium text-destructive">Hand off admin responsibility first</h2>
          <p className="text-muted-foreground">
            You are the last eligible admin in the following team workspace(s). Promote another member to admin before closing your account:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {blockingWorkspaces.map((workspaceId) => (
              <li key={workspaceId}>
                <code className="text-foreground">{workspaceId}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-4 pt-2">
        {freshTwoFactorOk && blockingWorkspaces.length === 0 ? <CloseAccountButton /> : null}
        <Button asChild variant="ghost">
          <Link href="/account/security">Cancel</Link>
        </Button>
      </div>
    </main>
  );
}
