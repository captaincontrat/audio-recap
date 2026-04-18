import { VerifyEmailFlow } from "@/components/features/auth/verify-email-flow";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("auth.verifyEmail.title") };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  const { translate } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("auth.verifyEmail.title")}</h1>
        <p className="text-sm text-muted-foreground">{translate("auth.verifyEmail.subtitle")}</p>
      </header>
      <VerifyEmailFlow searchParamsPromise={searchParams} />
    </main>
  );
}
