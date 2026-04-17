import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/features/auth/sign-out-button";
import { evaluateProtectedRoute } from "@/lib/auth/guards";

export const metadata = {
  title: "Dashboard",
};

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

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome back, {outcome.context.user.name || outcome.context.user.email}</h1>
        <p className="text-sm text-muted-foreground">Your dashboard is where recent meetings will land once uploads are wired up.</p>
      </header>
      <section className="flex flex-col gap-3 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Account</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{outcome.context.user.email}</dd>
          <dt className="text-muted-foreground">Verified</dt>
          <dd>{outcome.context.user.emailVerified ? "Yes" : "No"}</dd>
        </dl>
        <div className="flex">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
