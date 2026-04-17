"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type VerifyApiResponse = { ok: true; userId: string; email: string; alreadyVerified: boolean } | { ok: false; code: string; message: string };

type ResendApiResponse = { ok: true; expiresAt: string } | { ok: false; code: string; message: string };

type Status = { type: "idle" } | { type: "loading" } | { type: "success"; message: string } | { type: "error"; message: string };

export function VerifyEmailFlow({ searchParamsPromise }: { searchParamsPromise: Promise<{ token?: string; sent?: string }> }) {
  const { token, sent } = use(searchParamsPromise);
  const router = useRouter();
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
        setStatus({ type: "error", message: "Unexpected response from the server." });
        return;
      }
      if (payload.ok) {
        const message = payload.alreadyVerified ? "This account was already verified — you're all set." : "Your email is verified.";
        setStatus({ type: "success", message });
        router.refresh();
        return;
      }
      setStatus({ type: "error", message: payload.message });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function handleResend() {
    setResendState({ loading: true, message: null });
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = (await response.json().catch(() => null)) as ResendApiResponse | null;
    if (!payload) {
      setResendState({ loading: false, message: "Unexpected response from the server." });
      return;
    }
    if (!payload.ok) {
      setResendState({ loading: false, message: payload.message });
      return;
    }
    setResendState({ loading: false, message: "A new verification email is on its way." });
  }

  return (
    <section className="flex flex-col gap-4">
      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          We sent a verification email. Open the link to finish setting up your account.
        </p>
      ) : null}
      {status.type === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Verifying your email…
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
          {resendState.loading ? "Sending…" : "Resend verification email"}
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
