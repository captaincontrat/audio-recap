"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslator } from "@/lib/i18n/provider";

type PromptResponse = { ok: true } | { ok: false; reason: "no-session" | "no-credential" | "invalid-password" };

function isSafeRedirect(target: string | undefined): target is string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//");
}

export function RecentAuthPrompt({ from }: { from: string | undefined }) {
  const translate = useTranslator();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/recent-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => null)) as PromptResponse | null;
      if (!payload) {
        setError(translate("common.form.unexpectedServerResponse"));
        return;
      }
      if (!payload.ok) {
        setError(payload.reason === "no-credential" ? translate("auth.recentAuth.error.noCredential") : translate("auth.recentAuth.error.mismatch"));
        return;
      }
      router.push(isSafeRedirect(from) ? from : "/account/security");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">{translate("common.password.label")}</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? translate("auth.recentAuth.submit.loading") : translate("auth.recentAuth.submit")}
      </Button>
    </form>
  );
}
