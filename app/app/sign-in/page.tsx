import Link from "next/link";
import { GoogleOneTap } from "@/components/features/auth/google-one-tap";
import { GoogleSignInButton } from "@/components/features/auth/google-sign-in-button";
import { LastLoginMethodHint } from "@/components/features/auth/last-login-method-hint";
import { MagicLinkForm } from "@/components/features/auth/magic-link-form";
import { PasskeySignInButton } from "@/components/features/auth/passkey-sign-in-button";
import { SignInForm } from "@/components/features/auth/sign-in-form";

export const metadata = {
  title: "Sign in",
};

// Federated options only render when Google OAuth credentials are exposed
// to the browser. Deployments without credentials still see password,
// magic-link, and passkey sign-in paths.
const HAS_GOOGLE = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export default function SignInPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Summitdown account.</p>
      </header>

      <LastLoginMethodHint />

      <SignInForm redirectPromise={searchParams} />

      <Divider>or</Divider>

      <div className="flex flex-col gap-3">
        {HAS_GOOGLE ? <GoogleSignInButton /> : null}
        <PasskeySignInButton />
      </div>

      <Divider>or sign in with an email link</Divider>

      <MagicLinkForm />

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>

      {HAS_GOOGLE ? <GoogleOneTap /> : null}
    </main>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
