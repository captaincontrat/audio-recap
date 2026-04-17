import Link from "next/link";
import { SignUpForm } from "@/components/features/auth/sign-up-form";

export const metadata = {
  title: "Create your account",
};

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Create your Summitdown account</h1>
        <p className="text-sm text-muted-foreground">Start turning recorded meetings into shareable recaps.</p>
      </header>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
