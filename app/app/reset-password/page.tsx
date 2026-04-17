import Link from "next/link";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export const metadata = {
  title: "Set a new password",
};

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Enter the new password you&apos;d like to use to sign in.</p>
      </header>
      <ResetPasswordForm tokenPromise={searchParams} />
      <p className="text-sm text-muted-foreground">
        Need a new link?{" "}
        <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
          Start over
        </Link>
      </p>
    </main>
  );
}
