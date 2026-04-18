"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ResetPasswordInput, resetPasswordInputSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";

type ResetApiResponse = { ok: true; userId: string } | { ok: false; code: string; message: string };

export function ResetPasswordForm({ tokenPromise }: { tokenPromise: Promise<{ token?: string }> }) {
  const { token } = use(tokenPromise);
  const router = useRouter();
  const translate = useTranslator();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordInputSchema),
    mode: "onBlur",
    defaultValues: { token: token ?? "" },
  });

  if (!token) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {translate("auth.resetPassword.missingToken")}
      </p>
    );
  }

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as ResetApiResponse | null;
    if (!payload) {
      setServerError(translate("common.form.unexpectedServerResponse"));
      return;
    }
    if (!payload.ok) {
      setServerError(localizeAuthError({ code: payload.code, translate, fallback: payload.message }));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="text-sm" role="status">
        {translate("auth.resetPassword.success.prefix")}{" "}
        <a href="/sign-in" className="font-medium underline underline-offset-4">
          {translate("auth.resetPassword.success.link")}
        </a>{" "}
        {translate("auth.resetPassword.success.suffix")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("token")} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{translate("common.newPassword.label")}</Label>
        <Input id="password" type="password" autoComplete="new-password" required {...register("password")} />
        {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
      </div>
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? translate("auth.resetPassword.submit.loading") : translate("auth.resetPassword.submit")}
      </Button>
    </form>
  );
}
