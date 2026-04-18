"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { describePasskey, describePasskeyName, type PasskeyDisplayRow } from "@/lib/auth/passkey-display";

type PasskeyRow = PasskeyDisplayRow & { id: string };

// Passkey enrollment and management panel shown on the authenticated user's
// dashboard. Lists existing passkeys, lets the user add a new one, and
// supports deleting an existing credential. Enrollment requires a fresh
// session (enforced server-side by the Better Auth passkey plugin), so the
// button will fail with an `SESSION_REQUIRED` error if the session is
// stale — we surface the error message verbatim.
export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/auth/passkey/list-user-passkeys", { credentials: "same-origin" });
    if (!response.ok) {
      setIsLoading(false);
      setError("We couldn't load your passkeys.");
      return;
    }
    const payload = (await response.json().catch(() => [])) as PasskeyRow[];
    setPasskeys(Array.isArray(payload) ? payload : []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Bail out on browsers without WebAuthn — enrollment simply isn't
  // possible, so hiding the panel avoids dangling broken controls.
  if (typeof window !== "undefined" && typeof window.PublicKeyCredential === "undefined") {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Passkeys</h2>
        <p className="text-xs text-muted-foreground">This browser doesn't support passkeys. Try the latest version of Chrome, Safari, Firefox, or Edge.</p>
      </section>
    );
  }

  async function onEnroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEnrolling(true);
    setError(null);
    const trimmed = newPasskeyName.trim();
    const { error: apiError } = await authClient.passkey.addPasskey({ name: trimmed || undefined });
    setIsEnrolling(false);
    if (apiError) {
      setError(apiError.message ?? "We couldn't enroll that passkey.");
      return;
    }
    setNewPasskeyName("");
    await refresh();
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const response = await fetch("/api/auth/passkey/delete-passkey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    if (!response.ok) {
      setError("We couldn't remove that passkey.");
      return;
    }
    await refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Passkeys</h2>
        <p className="text-xs text-muted-foreground">Sign in without a password by using your device's biometrics or a security key.</p>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">No passkeys enrolled yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between gap-3 rounded-sm border border-border/50 px-2 py-1.5 text-xs">
              <div className="flex flex-col">
                <span className="font-medium">{describePasskeyName(pk)}</span>
                <span className="text-muted-foreground">{describePasskey(pk)}</span>
              </div>
              <Button type="button" variant="destructive" size="xs" onClick={() => onDelete(pk.id)} disabled={deletingId === pk.id}>
                {deletingId === pk.id ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onEnroll} className="flex flex-col gap-2" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passkey-name">Name (optional)</Label>
          <Input
            id="passkey-name"
            placeholder="e.g. MacBook Touch ID"
            value={newPasskeyName}
            onChange={(event) => setNewPasskeyName(event.target.value)}
            maxLength={64}
          />
        </div>
        <Button type="submit" size="sm" disabled={isEnrolling}>
          {isEnrolling ? "Waiting for device…" : "Add a passkey"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
