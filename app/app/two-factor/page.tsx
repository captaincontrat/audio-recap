import { TwoFactorChallenge } from "@/components/features/auth/two-factor-challenge";

export const metadata = {
  title: "Two-factor verification",
};

// After a successful password / magic-link / OAuth sign-in, Better Auth's
// `twoFactor` plugin returns `{ twoFactorRedirect: true }` and sets a
// short-lived challenge cookie instead of issuing a session. The sign-in
// form redirects the browser here with the original `from=` query so we
// can honor the target after verification completes. This page stays
// client-only — the API surface (`authClient.twoFactor.*`) handles all
// the server interactions.
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Two-factor verification</h1>
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app to finish signing in.</p>
      </header>
      <TwoFactorChallenge from={from} />
    </main>
  );
}
