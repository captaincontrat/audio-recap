import Link from "next/link";
import { SignInForm } from "@/components/features/auth/sign-in-form";

export const metadata = {
  title: "Sign in",
};

export default function SignInPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Summitdown account.</p>
      </header>
      <SignInForm redirectPromise={searchParams} />
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
    </main>
  );
}
