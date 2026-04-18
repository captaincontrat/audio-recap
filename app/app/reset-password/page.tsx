import Link from "next/link";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("auth.resetPassword.title") };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { translate } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("auth.resetPassword.heading")}</h1>
        <p className="text-sm text-muted-foreground">{translate("auth.resetPassword.subtitle")}</p>
      </header>
      <ResetPasswordForm tokenPromise={searchParams} />
      <p className="text-sm text-muted-foreground">
        {translate("auth.resetPassword.needNewLink")}{" "}
        <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
          {translate("auth.resetPassword.startOver")}
        </Link>
      </p>
    </main>
  );
}
