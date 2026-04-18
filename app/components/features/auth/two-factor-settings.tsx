"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

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
        setError(callError?.message ?? "Could not start two-factor setup.");
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
        setError(callError.message ?? "That code did not match.");
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
        setError(callError.message ?? "Could not disable two-factor authentication.");
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
        setError(callError?.message ?? "Could not regenerate backup codes.");
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
            <h2 className="text-lg font-medium">Enable two-factor authentication</h2>
            <p className="text-sm text-muted-foreground">Confirm your password to start the setup flow.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enable-password">Password</Label>
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
            {busy ? "Starting…" : "Start setup"}
          </Button>
        </form>
      ) : null}

      {stage.kind === "enrolling" || stage.kind === "verifying" ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Scan and verify</h2>
            <p className="text-sm text-muted-foreground">Add this account to your authenticator app, then enter a code below to finish setup.</p>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" aria-label="Authenticator provisioning URI">
            {stage.totpURI}
          </pre>
          <BackupCodesList codes={stage.backupCodes} />
          <form onSubmit={handleVerifyEnrollment} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="verify-code">Enter the 6-digit code</Label>
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
              {busy ? "Verifying…" : "Verify and enable"}
            </Button>
          </form>
        </div>
      ) : null}

      {stage.kind === "enabled" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
            <h2 className="text-lg font-medium">Two-factor is on</h2>
            <p className="text-sm text-muted-foreground">Future sign-ins on untrusted devices will require a verification code.</p>
          </div>

          {stage.backupCodes ? <BackupCodesList codes={stage.backupCodes} /> : null}

          <form onSubmit={handleRegenerate} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <h3 className="text-base font-medium">Regenerate backup codes</h3>
            <p className="text-sm text-muted-foreground">Existing codes stop working once you regenerate. Save the new set somewhere safe.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="regen-password">Password</Label>
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
              {busy ? "Regenerating…" : "Regenerate backup codes"}
            </Button>
          </form>

          <form onSubmit={handleDisable} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <h3 className="text-base font-medium">Disable two-factor</h3>
            <p className="text-sm text-muted-foreground">Turning it off removes the second step from every future sign-in.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disable-password">Password</Label>
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
              {busy ? "Disabling…" : "Disable two-factor"}
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function BackupCodesList({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
      <h3 className="text-base font-medium">Backup codes</h3>
      <p className="text-sm text-muted-foreground">Save these codes somewhere safe. Each one is single-use.</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}
