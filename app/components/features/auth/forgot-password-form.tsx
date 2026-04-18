"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ForgotPasswordInput, forgotPasswordInputSchema } from "@/lib/auth/schemas";
import { useTranslator } from "@/lib/i18n/provider";

export function ForgotPasswordForm() {
  const translate = useTranslator();
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as { ok: boolean; message: string } | null;
    // Server always responds with the enumeration-safe generic notice, so we
    // show the localized notice regardless of the server message to keep the
    // wording consistent with the active locale.
    setNotice(translate("auth.forgotPassword.defaultNotice"));
    void payload;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{translate("common.email.label")}</Label>
        <Input id="email" type="email" autoComplete="email" required {...register("email")} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? translate("auth.forgotPassword.submit.loading") : translate("auth.forgotPassword.submit")}
      </Button>
    </form>
  );
}
