"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SignUpInput, signUpInputSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SignUpApiResponse = { ok: true; userId: string; verificationExpiresAt: string } | { ok: false; code: string; message: string };

export function SignUpForm() {
  const router = useRouter();
  const translate = useTranslator();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpInputSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: SignUpInput) {
    setServerError(null);
    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as SignUpApiResponse | null;
    if (!payload) {
      setServerError(translate("common.form.unexpectedServerResponse"));
      return;
    }
    if (!payload.ok) {
      setServerError(localizeAuthError({ code: payload.code, translate, fallback: payload.message }));
      return;
    }
    router.push("/verify-email?sent=1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Field label={translate("auth.signUp.name.label")} htmlFor="name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" {...register("name")} />
      </Field>
      <Field label={translate("common.email.label")} htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" required {...register("email")} />
      </Field>
      <Field label={translate("common.password.label")} htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" required {...register("password")} />
      </Field>
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? translate("auth.signUp.submit.loading") : translate("auth.signUp.submit")}
      </Button>
    </form>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className={cn("text-xs text-destructive")}>{error}</p> : null}
    </div>
  );
}
