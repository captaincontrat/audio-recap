import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FreshSignInButton } from "@/components/features/account/fresh-sign-in-button";
import { ReactivateButton } from "@/components/features/account/reactivate-button";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { deriveAccountClosureState, REACTIVATION_WINDOW_DAYS } from "@/lib/server/accounts";
import { getDb } from "@/lib/server/db/client";
import { user as userTable } from "@/lib/server/db/schema";

export const metadata = {
  title: "Account closed",
};

export const dynamic = "force-dynamic";

// Landing page for closed accounts. The protected-route guard routes
// closed users here after revoking their sessions, so a typical visitor
// arrives unauthenticated. From this page the user can:
//   - Start a fresh sign-in that, on success, bounces them back here
//     with a new session whose `lastAuthenticatedAt` proves fresh auth
//     (and fresh 2FA when 2FA is enabled).
//   - Reactivate, once the fresh-auth marker is in place.
//   - See window-expired messaging if their 30-day window has already
//     elapsed.
export default async function AccountClosedPage() {
  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Unauthenticated visit: explain what happened and offer a fresh sign-in.
  if (!session?.session || !session.user) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Your account is closed</h1>
          <p className="text-sm text-muted-foreground">
            Sign in again to reactivate your account. You have {REACTIVATION_WINDOW_DAYS} days from the moment you closed the account before it is permanently
            deleted.
          </p>
        </header>
        <FreshSignInButton destination="/account/closed" />
      </main>
    );
  }

  const db = getDb();
  const userRows = await db
    .select({ closedAt: userTable.closedAt, scheduledDeleteAt: userTable.scheduledDeleteAt })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const userRow = userRows[0];

  if (!userRow || userRow.closedAt === null) {
    redirect("/dashboard");
  }

  const state = deriveAccountClosureState({ closedAt: userRow.closedAt, scheduledDeleteAt: userRow.scheduledDeleteAt }, new Date());
  const recent = await verifyRecentAuth(session.session.id);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Your account is closed</h1>
        {state === "closed_reactivable" ? (
          <p className="text-sm text-muted-foreground">
            You can reactivate this account until <strong className="text-foreground">{userRow.scheduledDeleteAt?.toLocaleString() ?? "soon"}</strong>.
            Reactivation restores sign-in but does not restore previously revoked sessions or undo workspace changes that happened while the account was closed.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            The {REACTIVATION_WINDOW_DAYS}-day reactivation window has elapsed. This account will be permanently deleted shortly, and the reactivation button is
            no longer available.
          </p>
        )}
      </header>

      {state === "closed_reactivable" ? (
        recent.ok ? (
          <ReactivateButton />
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm">
            <p className="text-muted-foreground">
              To reactivate, sign in again so we can confirm it is really you. If you have two-factor authentication enabled you will be prompted for a fresh
              code as part of that sign-in.
            </p>
            <FreshSignInButton destination="/account/closed" />
          </div>
        )
      ) : (
        <Button asChild variant="ghost">
          <Link href="/">Back to home</Link>
        </Button>
      )}
    </main>
  );
}
