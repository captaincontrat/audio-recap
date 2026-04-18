"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

// Triggers the WebAuthn ceremony for users who have already enrolled at
// least one passkey. Browsers without WebAuthn support silently hide the
// button via `PublicKeyCredential` feature detection; users who try the
// flow without an enrolled credential will see the native browser dialog
// and can cancel to fall back to password or magic-link.
export function PasskeySignInButton({ callbackURL = "/dashboard" }: { callbackURL?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof window !== "undefined" && typeof window.PublicKeyCredential === "undefined") {
    return null;
  }

  async function onClick() {
    setError(null);
    setIsPending(true);
    const result = await authClient.signIn.passkey();
    setIsPending(false);
    if (result?.error) {
      setError(result.error.message ?? "We couldn't sign you in with a passkey.");
      return;
    }
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" variant="outline" onClick={onClick} disabled={isPending} aria-label="Sign in with a passkey">
        {isPending ? "Waiting for passkey…" : "Sign in with a passkey"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
