import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FreshSignInButton } from "@/components/features/account/fresh-sign-in-button";
import { ReactivateButton } from "@/components/features/account/reactivate-button";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { getServerLocale, getServerTranslator } from "@/lib/i18n/server";
import { deriveAccountClosureState, REACTIVATION_WINDOW_DAYS } from "@/lib/server/accounts";
import { getDb } from "@/lib/server/db/client";
import { user as userTable } from "@/lib/server/db/schema";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("chrome.accountClosed.title") };
}

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
  const { translate } = await getServerTranslator();
  const { locale } = await getServerLocale();

  // Unauthenticated visit: explain what happened and offer a fresh sign-in.
  if (!session?.session || !session.user) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{translate("chrome.accountClosed.heading")}</h1>
          <p className="text-sm text-muted-foreground">{translate("chrome.accountClosed.unauth.body", { days: REACTIVATION_WINDOW_DAYS })}</p>
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
  const scheduledDeleteLabel = userRow.scheduledDeleteAt?.toLocaleString(locale) ?? translate("chrome.accountClosed.reactivable.unknownDate");

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("chrome.accountClosed.heading")}</h1>
        {state === "closed_reactivable" ? (
          <p className="text-sm text-muted-foreground">{translate("chrome.accountClosed.reactivable.body", { deleteDate: scheduledDeleteLabel })}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{translate("chrome.accountClosed.expired.body", { days: REACTIVATION_WINDOW_DAYS })}</p>
        )}
      </header>

      {state === "closed_reactivable" ? (
        recent.ok ? (
          <ReactivateButton />
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm">
            <p className="text-muted-foreground">{translate("chrome.accountClosed.confirmFresh.body")}</p>
            <FreshSignInButton destination="/account/closed" />
          </div>
        )
      ) : (
        <Button asChild variant="ghost">
          <Link href="/">{translate("chrome.accountClosed.backHome")}</Link>
        </Button>
      )}
    </main>
  );
}
