"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";

type VerifyApiResponse = { ok: true; userId: string; email: string; alreadyVerified: boolean } | { ok: false; code: string; message: string };

type ResendApiResponse = { ok: true; expiresAt: string } | { ok: false; code: string; message: string };

type Status = { type: "idle" } | { type: "loading" } | { type: "success"; message: string } | { type: "error"; message: string };

export function VerifyEmailFlow({ searchParamsPromise }: { searchParamsPromise: Promise<{ token?: string; sent?: string }> }) {
  const { token, sent } = use(searchParamsPromise);
  const router = useRouter();
  const translate = useTranslator();
  const [status, setStatus] = useState<Status>(token ? { type: "loading" } : { type: "idle" });
  const [resendState, setResendState] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (cancelled) return;
      const payload = (await response.json().catch(() => null)) as VerifyApiResponse | null;
      if (!payload) {
        setStatus({ type: "error", message: translate("common.form.unexpectedServerResponse") });
        return;
      }
      if (payload.ok) {
        // Sign-up auto-creates a session (see `emailAndPassword.autoSignIn`
        // in `lib/auth/instance.ts`), so the moment the DB flips the user to
        // `emailVerified=true` the dashboard guard will admit this browser.
        // Keep the success status for the brief window before the navigation
        // lands so users get confirmation even on slow networks.
        const message = payload.alreadyVerified ? translate("auth.verifyEmail.alreadyVerified") : translate("auth.verifyEmail.success");
        setStatus({ type: "success", message });
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setStatus({ type: "error", message: localizeAuthError({ code: payload.code, translate, fallback: payload.message }) });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, translate]);

  async function handleResend() {
    setResendState({ loading: true, message: null });
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = (await response.json().catch(() => null)) as ResendApiResponse | null;
    if (!payload) {
      setResendState({ loading: false, message: translate("common.form.unexpectedServerResponse") });
      return;
    }
    if (!payload.ok) {
      setResendState({ loading: false, message: localizeAuthError({ code: payload.code, translate, fallback: payload.message }) });
      return;
    }
    setResendState({ loading: false, message: translate("auth.verifyEmail.resend.success") });
  }

  return (
    <section className="flex flex-col gap-4">
      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate("auth.verifyEmail.sent")}
        </p>
      ) : null}
      {status.type === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate("auth.verifyEmail.verifying")}
        </p>
      ) : null}
      {status.type === "success" ? (
        <p role="status" className="text-sm">
          {status.message}
        </p>
      ) : null}
      {status.type === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {status.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="button" onClick={handleResend} disabled={resendState.loading}>
          {resendState.loading ? translate("auth.verifyEmail.resend.loading") : translate("auth.verifyEmail.resend")}
        </Button>
        {resendState.message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {resendState.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
