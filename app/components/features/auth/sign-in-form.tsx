"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SignInInput, signInInputSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";

type SignInApiResponse =
  | { ok: true; userId: string; emailVerified: boolean }
  | { ok: true; twoFactorRequired: true; twoFactorMethods: string[] }
  | { ok: false; code: string; message: string };

function isSafeRedirect(target: string | undefined): target is string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//");
}

function buildTwoFactorUrl(from: string | undefined): string {
  const base = "/two-factor";
  if (isSafeRedirect(from)) {
    const params = new URLSearchParams({ from });
    return `${base}?${params.toString()}`;
  }
  return base;
}

export function SignInForm({ redirectPromise }: { redirectPromise: Promise<{ from?: string }> }) {
  const { from } = use(redirectPromise);
  const router = useRouter();
  const translate = useTranslator();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInInputSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: SignInInput) {
    setServerError(null);
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as SignInApiResponse | null;
    if (!payload) {
      setServerError(translate("common.form.unexpectedServerResponse"));
      return;
    }
    if (!payload.ok) {
      setServerError(localizeAuthError({ code: payload.code, translate, fallback: payload.message }));
      return;
    }
    if ("twoFactorRequired" in payload) {
      router.push(buildTwoFactorUrl(from));
      router.refresh();
      return;
    }
    const destination = payload.emailVerified ? (isSafeRedirect(from) ? from : "/dashboard") : "/verify-email";
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{translate("common.email.label")}</Label>
        <Input id="email" type="email" autoComplete="email" required {...register("email")} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{translate("common.password.label")}</Label>
        <Input id="password" type="password" autoComplete="current-password" required {...register("password")} />
        {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
      </div>
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? translate("auth.signIn.submit.loading") : translate("auth.signIn.submit")}
      </Button>
    </form>
  );
}
