import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { RecentAuthPrompt } from "@/components/features/auth/recent-auth-prompt";
import { getAuth } from "@/lib/auth/instance";

export const metadata = {
  title: "Confirm your password",
};

// Landing page for sensitive auth-management actions that failed the
// `verifyRecentAuth` gate. Confirming the current password refreshes
// the elevation window and bounces the user back to wherever they came
// from (`?from=…`). Any other path kicks them back to `/account/security`
// so accidental or crafted `from` values cannot redirect off-site.
export default async function RecentAuthPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.session || !session.user) {
    redirect("/sign-in?from=/account/security");
  }

  const { from } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Confirm your password</h1>
        <p className="text-sm text-muted-foreground">Re-enter your password to continue with a sensitive security change.</p>
      </header>
      <RecentAuthPrompt from={from} />
    </main>
  );
}
