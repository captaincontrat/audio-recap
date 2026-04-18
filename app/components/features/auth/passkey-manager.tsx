"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { describePasskey, describePasskeyName, type PasskeyDisplayRow } from "@/lib/auth/passkey-display";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";

type PasskeyRow = PasskeyDisplayRow & { id: string };

// Passkey enrollment and management panel shown on the authenticated user's
// dashboard. Lists existing passkeys, lets the user add a new one, and
// supports deleting an existing credential. Enrollment requires a fresh
// session (enforced server-side by the Better Auth passkey plugin), so the
// button will fail with an `SESSION_REQUIRED` error if the session is
// stale — we surface the error message verbatim.
export function PasskeyManager() {
  const translate = useTranslator();
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
      setError(translate("auth.passkey.manager.errors.load"));
      return;
    }
    const payload = (await response.json().catch(() => [])) as PasskeyRow[];
    setPasskeys(Array.isArray(payload) ? payload : []);
    setIsLoading(false);
  }, [translate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Bail out on browsers without WebAuthn — enrollment simply isn't
  // possible, so hiding the panel avoids dangling broken controls.
  if (typeof window !== "undefined" && typeof window.PublicKeyCredential === "undefined") {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{translate("auth.passkey.manager.title")}</h2>
        <p className="text-xs text-muted-foreground">{translate("auth.passkey.manager.unsupported")}</p>
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
      const typed = apiError as { code?: string; message?: string };
      setError(
        localizeAuthError({
          code: typed.code,
          translate,
          fallback: typed.message ?? translate("auth.passkey.manager.errors.enroll"),
        }),
      );
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
      setError(translate("auth.passkey.manager.errors.remove"));
      return;
    }
    await refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{translate("auth.passkey.manager.title")}</h2>
        <p className="text-xs text-muted-foreground">{translate("auth.passkey.manager.subtitle")}</p>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{translate("auth.passkey.manager.loading")}</p>
      ) : passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{translate("auth.passkey.manager.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between gap-3 rounded-sm border border-border/50 px-2 py-1.5 text-xs">
              <div className="flex flex-col">
                <span className="font-medium">{describePasskeyName(pk)}</span>
                <span className="text-muted-foreground">{describePasskey(pk)}</span>
              </div>
              <Button type="button" variant="destructive" size="xs" onClick={() => onDelete(pk.id)} disabled={deletingId === pk.id}>
                {deletingId === pk.id ? translate("auth.passkey.manager.remove.loading") : translate("auth.passkey.manager.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onEnroll} className="flex flex-col gap-2" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passkey-name">{translate("auth.passkey.manager.name.label")}</Label>
          <Input
            id="passkey-name"
            placeholder={translate("auth.passkey.manager.name.placeholder")}
            value={newPasskeyName}
            onChange={(event) => setNewPasskeyName(event.target.value)}
            maxLength={64}
          />
        </div>
        <Button type="submit" size="sm" disabled={isEnrolling}>
          {isEnrolling ? translate("auth.passkey.manager.enroll.loading") : translate("auth.passkey.manager.enroll")}
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
