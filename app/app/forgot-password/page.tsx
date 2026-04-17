import Link from "next/link";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter the email on your account and we&apos;ll send a reset link.</p>
      </header>
      <ForgotPasswordForm />
      <p className="text-sm text-muted-foreground">
        <Link href="/sign-in" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
