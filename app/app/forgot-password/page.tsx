import Link from "next/link";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("auth.forgotPassword.title") };
}

export default async function ForgotPasswordPage() {
  const { translate } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("auth.forgotPassword.heading")}</h1>
        <p className="text-sm text-muted-foreground">{translate("auth.forgotPassword.subtitle")}</p>
      </header>
      <ForgotPasswordForm />
      <p className="text-sm text-muted-foreground">
        <Link href="/sign-in" className="underline underline-offset-4">
          {translate("auth.forgotPassword.backToSignIn")}
        </Link>
      </p>
    </main>
  );
}
