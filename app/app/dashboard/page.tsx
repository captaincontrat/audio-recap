import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PasskeyManager } from "@/components/features/auth/passkey-manager";
import { SignOutButton } from "@/components/features/auth/sign-out-button";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("chrome.dashboard.title") };
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const outcome = await evaluateProtectedRoute(requestHeaders);
  if (outcome.status === "unauthenticated") {
    redirect(`${outcome.redirectTo}?from=/dashboard`);
  }
  if (outcome.status === "unverified") {
    redirect(outcome.redirectTo);
  }
  if (outcome.status === "closed") {
    redirect(outcome.redirectTo);
  }

  const { translate } = await getServerTranslator();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("chrome.dashboard.welcome", { name: outcome.context.user.name || outcome.context.user.email })}</h1>
        <p className="text-sm text-muted-foreground">{translate("chrome.dashboard.subtitle")}</p>
      </header>
      <section className="flex flex-col gap-3 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{translate("chrome.dashboard.account.heading")}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{translate("chrome.dashboard.account.email")}</dt>
          <dd>{outcome.context.user.email}</dd>
          <dt className="text-muted-foreground">{translate("chrome.dashboard.account.verified")}</dt>
          <dd>{outcome.context.user.emailVerified ? translate("chrome.dashboard.account.verified.yes") : translate("chrome.dashboard.account.verified.no")}</dd>
        </dl>
        <div className="flex">
          <SignOutButton />
        </div>
      </section>
      <PasskeyManager />
    </main>
  );
}
