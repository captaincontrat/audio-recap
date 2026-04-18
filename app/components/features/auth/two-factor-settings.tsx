"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { useTranslator } from "@/lib/i18n/provider";

type Stage =
  | { kind: "idle" }
  | { kind: "enrolling"; totpURI: string; backupCodes: string[] }
  | { kind: "verifying"; totpURI: string; backupCodes: string[] }
  | { kind: "enabled"; backupCodes?: string[] };

// Two-factor management panel. There are three states the UI cycles
// through when enrolling: (1) collect password, call `enable` and
// display the provisioning URI plus one-time backup codes, (2) prompt
// for the first TOTP code and call `verifyTotp` to flip `verified` on
// the row, (3) show the "enabled" state with disable and backup-code
// regeneration controls. Because this page already sits behind the
// recent-auth gate, we do not re-prompt for the password on every
// action — only on `enable` / `disable` / `generateBackupCodes` because
// the Better Auth endpoints require it directly.
export function TwoFactorSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const translate = useTranslator();
  const [stage, setStage] = useState<Stage>(initialEnabled ? { kind: "enabled" } : { kind: "idle" });
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEnable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: callError } = await authClient.twoFactor.enable({ password });
      if (callError || !data) {
        const typed = callError as { code?: string; message?: string } | null | undefined;
        setError(
          localizeAuthError({
            code: typed?.code,
            translate,
            fallback: typed?.message ?? translate("auth.twoFactorSettings.enable.error"),
          }),
        );
        return;
      }
      setStage({ kind: "enrolling", totpURI: data.totpURI, backupCodes: data.backupCodes });
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (stage.kind !== "enrolling" && stage.kind !== "verifying") return;
      const { error: callError } = await authClient.twoFactor.verifyTotp({ code: verifyCode.trim() });
      if (callError) {
        const typed = callError as { code?: string; message?: string };
        setError(
          localizeAuthError({
            code: typed.code,
            translate,
            fallback: typed.message ?? translate("auth.twoFactorSettings.enroll.error"),
          }),
        );
        return;
      }
      setStage({ kind: "enabled", backupCodes: stage.backupCodes });
      setVerifyCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: callError } = await authClient.twoFactor.disable({ password });
      if (callError) {
        const typed = callError as { code?: string; message?: string };
        setError(
          localizeAuthError({
            code: typed.code,
            translate,
            fallback: typed.message ?? translate("auth.twoFactorSettings.disable.error"),
          }),
        );
        return;
      }
      setStage({ kind: "idle" });
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: callError } = await authClient.twoFactor.generateBackupCodes({ password });
      if (callError || !data) {
        const typed = callError as { code?: string; message?: string } | null | undefined;
        setError(
          localizeAuthError({
            code: typed?.code,
            translate,
            fallback: typed?.message ?? translate("auth.twoFactorSettings.regenerate.error"),
          }),
        );
        return;
      }
      setStage({ kind: "enabled", backupCodes: data.backupCodes });
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {stage.kind === "idle" ? (
        <form onSubmit={handleEnable} className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">{translate("auth.twoFactorSettings.enable.title")}</h2>
            <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.enable.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enable-password">{translate("common.password.label")}</Label>
            <Input
              id="enable-password"
              type="password"
              autoComplete="current-password"
              value={password}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? translate("auth.twoFactorSettings.enable.submit.loading") : translate("auth.twoFactorSettings.enable.submit")}
          </Button>
        </form>
      ) : null}

      {stage.kind === "enrolling" || stage.kind === "verifying" ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">{translate("auth.twoFactorSettings.enroll.title")}</h2>
            <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.enroll.subtitle")}</p>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" aria-label={translate("auth.twoFactorSettings.enroll.uri.ariaLabel")}>
            {stage.totpURI}
          </pre>
          <BackupCodesList codes={stage.backupCodes} />
          <form onSubmit={handleVerifyEnrollment} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="verify-code">{translate("auth.twoFactorSettings.enroll.code.label")}</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyCode}
                required
                onChange={(event) => setVerifyCode(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? translate("auth.twoFactorSettings.enroll.submit.loading") : translate("auth.twoFactorSettings.enroll.submit")}
            </Button>
          </form>
        </div>
      ) : null}

      {stage.kind === "enabled" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
            <h2 className="text-lg font-medium">{translate("auth.twoFactorSettings.enabled.title")}</h2>
            <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.enabled.subtitle")}</p>
          </div>

          {stage.backupCodes ? <BackupCodesList codes={stage.backupCodes} /> : null}

          <form onSubmit={handleRegenerate} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <h3 className="text-base font-medium">{translate("auth.twoFactorSettings.regenerate.title")}</h3>
            <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.regenerate.subtitle")}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="regen-password">{translate("common.password.label")}</Label>
              <Input
                id="regen-password"
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? translate("auth.twoFactorSettings.regenerate.submit.loading") : translate("auth.twoFactorSettings.regenerate.submit")}
            </Button>
          </form>

          <form onSubmit={handleDisable} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <h3 className="text-base font-medium">{translate("auth.twoFactorSettings.disable.title")}</h3>
            <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.disable.subtitle")}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disable-password">{translate("common.password.label")}</Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? translate("auth.twoFactorSettings.disable.submit.loading") : translate("auth.twoFactorSettings.disable.submit")}
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function BackupCodesList({ codes }: { codes: string[] }) {
  const translate = useTranslator();
  if (codes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
      <h3 className="text-base font-medium">{translate("auth.twoFactorSettings.backupCodes.title")}</h3>
      <p className="text-sm text-muted-foreground">{translate("auth.twoFactorSettings.backupCodes.subtitle")}</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}
