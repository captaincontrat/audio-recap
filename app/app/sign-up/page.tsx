import Link from "next/link";
import { SignUpForm } from "@/components/features/auth/sign-up-form";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { translate } = await getServerTranslator();
  return { title: translate("auth.signUp.title") };
}

export default async function SignUpPage() {
  const { translate } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{translate("auth.signUp.heading")}</h1>
        <p className="text-sm text-muted-foreground">{translate("auth.signUp.subtitle")}</p>
      </header>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        {translate("auth.signUp.signInPrompt")}{" "}
        <Link href="/sign-in" className="font-medium underline underline-offset-4">
          {translate("auth.signUp.signInCta")}
        </Link>
      </p>
    </main>
  );
}
