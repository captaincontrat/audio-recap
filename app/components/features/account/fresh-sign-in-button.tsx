"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslator } from "@/lib/i18n/provider";

// Sign the user out of the current session and bounce them through the
// primary sign-in flow so the next session is created via a full
// sign-in — which, for a 2FA-enabled account, includes the second-
// factor challenge. The `/account/close` confirmation page checks
// `session.createdAt` to decide whether that signal is fresh; sending
// the user through here forces a new session row with a brand-new
// `createdAt` and `lastAuthenticatedAt`.
export function FreshSignInButton({ destination }: { destination: string }) {
  const translate = useTranslator();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" } }).catch(() => {});
      const target = `/sign-in?from=${encodeURIComponent(destination)}`;
      router.push(target);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={submitting}>
      {submitting ? translate("chrome.freshSignInButton.submit.loading") : translate("chrome.freshSignInButton.submit")}
    </Button>
  );
}
