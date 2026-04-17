import { VerifyEmailFlow } from "@/components/features/auth/verify-email-flow";

export const metadata = {
  title: "Verify your email",
};

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">Confirm your email to unlock the full Summitdown experience.</p>
      </header>
      <VerifyEmailFlow searchParamsPromise={searchParams} />
    </main>
  );
}
