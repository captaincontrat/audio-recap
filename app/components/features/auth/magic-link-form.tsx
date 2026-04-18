"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useTranslator } from "@/lib/i18n/provider";

// Request-a-link form. The server endpoint returns `{ status: true }`
// regardless of whether the email exists, so we always show the same
// "check your inbox" confirmation to avoid leaking account existence.
export function MagicLinkForm({ callbackURL = "/dashboard" }: { callbackURL?: string }) {
  const translate = useTranslator();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsPending(true);
    const { error: apiError } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL });
    setIsPending(false);
    // Any non-rate-limited error is presented generically; a successful
    // dispatch AND a "no such email" path both land on the same confirmation
    // to keep existence ambiguous.
    if (apiError && apiError.status === 429) {
      setError(translate("auth.magicLink.rateLimited"));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs" role="status" aria-live="polite">
        {translate("auth.magicLink.confirmation")}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="magic-link-email">{translate("common.email.label")}</Label>
        <Input id="magic-link-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={isPending || !email.trim()}>
        {isPending ? translate("auth.magicLink.submit.loading") : translate("auth.magicLink.submit")}
      </Button>
    </form>
  );
}
