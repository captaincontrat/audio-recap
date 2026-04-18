import { TwoFactorChallenge } from "@/components/features/auth/two-factor-challenge";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("auth.twoFactor.title") };
}

// After a successful password / magic-link / OAuth sign-in, Better Auth's
// `twoFactor` plugin returns `{ twoFactorRedirect: true }` and sets a
// short-lived challenge cookie instead of issuing a session. The sign-in
// form redirects the browser here with the original `from=` query so we
// can honor the target after verification completes. This page stays
// client-only — the API surface (`authClient.twoFactor.*`) handles all
// the server interactions.
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const { translate } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("auth.twoFactor.title")}</h1>
        <p className="text-sm text-muted-foreground">{translate("auth.twoFactor.subtitle")}</p>
      </header>
      <TwoFactorChallenge from={from} />
    </main>
  );
}
