"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslator } from "@/lib/i18n/provider";
import type { Translator } from "@/lib/i18n/translator";

type ApiSuccess = { ok: true };
type ApiFailure = { ok: false; code: "unauthenticated" | "fresh_auth_required" | "not_closed" | "window_expired" };
type ApiResponse = ApiSuccess | ApiFailure;

// Reactivate button on the `/account/closed` page. The server-side
// action uses the current session's `lastAuthenticatedAt` as proof
// that a fresh sign-in (including 2FA when enabled) just happened —
// so "click to reactivate" is all the UI needs. On failure the error
// copy steers the user back through a fresh sign-in.
export function ReactivateButton() {
  const translate = useTranslator();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/reactivate", { method: "POST", headers: { "content-type": "application/json" } });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!payload) {
        setError(translate("common.form.unexpectedServerResponse"));
        return;
      }
      if (!payload.ok) {
        setError(describeFailure(payload, translate));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={onClick} disabled={submitting}>
        {submitting ? translate("chrome.reactivateButton.submit.loading") : translate("chrome.reactivateButton.submit")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describeFailure(payload: ApiFailure, translate: Translator): string {
  switch (payload.code) {
    case "unauthenticated":
      return translate("chrome.reactivateButton.error.unauthenticated");
    case "fresh_auth_required":
      return translate("chrome.reactivateButton.error.freshAuthRequired");
    case "not_closed":
      return translate("chrome.reactivateButton.error.notClosed");
    case "window_expired":
      return translate("chrome.reactivateButton.error.windowExpired");
    default: {
      const exhaustive: never = payload.code;
      return translate("chrome.reactivateButton.error.unexpected", { code: String(exhaustive) });
    }
  }
}
