"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const confirmed = window.confirm("Close your account? You will be signed out immediately and you have 30 days to reactivate before permanent deletion.");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/close", { method: "POST", headers: { "content-type": "application/json" } });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!payload) {
        setError("Unexpected response from the server.");
        return;
      }
      if (!payload.ok) {
        setError(describeFailure(payload));
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
        {submitting ? "Closing…" : "Close my account"}
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
      return "Your session has expired. Sign in again to continue.";
    case "account_not_found":
      return "We could not find your account.";
    case "already_closed":
      return "This account is already closed.";
    case "recent_auth_required":
      return "Re-enter your password to continue.";
    case "fresh_two_factor_required":
      return "Sign in again with your authenticator before closing.";
    case "last_eligible_admin_handoff_required":
      return "Promote another member to admin in your team workspace(s) before closing your account.";
    default: {
      const exhaustive: never = payload.code;
      return `Unexpected error: ${String(exhaustive)}`;
    }
  }
}
