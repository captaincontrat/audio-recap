"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ApiSuccess = { ok: true };
type ApiFailure = { ok: false; code: "unauthenticated" | "fresh_auth_required" | "not_closed" | "window_expired" };
type ApiResponse = ApiSuccess | ApiFailure;

// Reactivate button on the `/account/closed` page. The server-side
// action uses the current session's `lastAuthenticatedAt` as proof
// that a fresh sign-in (including 2FA when enabled) just happened —
// so "click to reactivate" is all the UI needs. On failure the error
// copy steers the user back through a fresh sign-in.
export function ReactivateButton() {
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
        setError("Unexpected response from the server.");
        return;
      }
      if (!payload.ok) {
        setError(describeFailure(payload));
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
        {submitting ? "Reactivating…" : "Reactivate my account"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describeFailure(payload: ApiFailure): string {
  switch (payload.code) {
    case "unauthenticated":
      return "Your session has expired. Sign in again to reactivate.";
    case "fresh_auth_required":
      return "Please sign in again before reactivating.";
    case "not_closed":
      return "This account is not closed.";
    case "window_expired":
      return "The 30-day reactivation window has elapsed. Your account will be permanently deleted shortly.";
    default: {
      const exhaustive: never = payload.code;
      return `Unexpected error: ${String(exhaustive)}`;
    }
  }
}
