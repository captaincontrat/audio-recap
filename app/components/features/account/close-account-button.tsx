"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslator } from "@/lib/i18n/provider";
import type { Translator } from "@/lib/i18n/translator";

type ApiSuccess = { ok: true; scheduledDeleteAt: string };
type ApiFailure = {
  ok: false;
  code:
    | "unauthenticated"
    | "account_not_found"
    | "already_closed"
    | "recent_auth_required"
    | "fresh_two_factor_required"
    | "last_eligible_admin_handoff_required";
  blockingWorkspaceIds?: ReadonlyArray<string>;
};
type ApiResponse = ApiSuccess | ApiFailure;

// Final confirmation button for the `/account/close` flow. Everything
// up to this point was informational; clicking the button triggers the
// server-side closure (session revocation + retained-state write). On
// success the user lands on `/account/closed` where they can still
// self-service reactivate during the 30-day window.
export function CloseAccountButton() {
  const translate = useTranslator();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const confirmed = window.confirm(translate("chrome.closeButton.confirm"));
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/close", { method: "POST", headers: { "content-type": "application/json" } });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!payload) {
        setError(translate("common.form.unexpectedServerResponse"));
        return;
      }
      if (!payload.ok) {
        setError(describeFailure(payload, translate));
        return;
      }
      router.push("/account/closed");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="destructive" onClick={onClick} disabled={submitting}>
        {submitting ? translate("chrome.closeButton.submit.loading") : translate("chrome.closeButton.submit")}
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
      return translate("chrome.closeButton.error.unauthenticated");
    case "account_not_found":
      return translate("chrome.closeButton.error.accountNotFound");
    case "already_closed":
      return translate("chrome.closeButton.error.alreadyClosed");
    case "recent_auth_required":
      return translate("chrome.closeButton.error.recentAuthRequired");
    case "fresh_two_factor_required":
      return translate("chrome.closeButton.error.freshTwoFactorRequired");
    case "last_eligible_admin_handoff_required":
      return translate("chrome.closeButton.error.adminHandoffRequired");
    default: {
      const exhaustive: never = payload.code;
      return translate("chrome.closeButton.error.unexpected", { code: String(exhaustive) });
    }
  }
}
