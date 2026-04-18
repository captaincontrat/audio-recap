"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

type Mode = "totp" | "email-otp" | "backup-code";

function isSafeRedirect(target: string | undefined): target is string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//");
}

// UI for the post-sign-in second-factor challenge. The user has already
// proved their first factor (password / magic-link / OAuth); Better
// Auth has set a short-lived challenge cookie and is waiting for one of:
// a TOTP code, an email OTP delivered on demand, or a one-time backup
// code. We do not know which method the user wants up front, so the UI
// lets them switch between modes — each one calls a different client
// helper, but on success Better Auth issues the full session cookie and
// we redirect to the originally requested page.
export function TwoFactorChallenge({ from }: { from: string | undefined }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const destination = isSafeRedirect(from) ? from : "/dashboard";

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSubmitting(true);
    try {
      const trimmed = code.trim();
      if (!trimmed) {
        setServerError("Enter your verification code.");
        return;
      }

      const { error } =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code: trimmed, trustDevice })
          : mode === "email-otp"
            ? await authClient.twoFactor.verifyOtp({ code: trimmed, trustDevice })
            : await authClient.twoFactor.verifyBackupCode({ code: trimmed, trustDevice });

      if (error) {
        setServerError(error.message ?? "That code did not work. Try again.");
        return;
      }

      router.push(destination);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp() {
    setServerError(null);
    setSendingOtp(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp();
      if (error) {
        setServerError(error.message ?? "Could not send the verification email. Try again in a moment.");
        return;
      }
      setOtpSent(true);
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 text-sm" role="tablist" aria-label="Verification method">
        <TabButton active={mode === "totp"} onClick={() => setMode("totp")}>
          Authenticator app
        </TabButton>
        <TabButton active={mode === "email-otp"} onClick={() => setMode("email-otp")}>
          Email code
        </TabButton>
        <TabButton active={mode === "backup-code"} onClick={() => setMode("backup-code")}>
          Backup code
        </TabButton>
      </div>

      <form onSubmit={handleVerify} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="two-factor-code">{mode === "backup-code" ? "Backup code" : "Verification code"}</Label>
          <Input
            id="two-factor-code"
            name="code"
            type="text"
            inputMode={mode === "backup-code" ? "text" : "numeric"}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {mode === "email-otp" ? (
            <p className="text-xs text-muted-foreground">
              {otpSent ? "We sent a code to your email. It expires in a few minutes." : "Request a code to receive it at your account email."}
            </p>
          ) : null}
        </div>

        {mode === "email-otp" ? (
          <Button type="button" variant="secondary" onClick={handleSendOtp} disabled={sendingOtp}>
            {sendingOtp ? "Sending…" : otpSent ? "Resend email code" : "Send email code"}
          </Button>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} />
          Trust this device for 30 days
        </label>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-foreground bg-foreground/5 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
