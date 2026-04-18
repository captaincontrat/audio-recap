"use client";

import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { describeLastLoginMethod } from "@/lib/auth/last-login-method";

// Reads the `better-auth.last_used_login_method` cookie (set by the
// last-login-method plugin on successful sign-in) and shows a friendly
// hint above the sign-in form so returning users can spot the path they
// used last. Purely advisory — the full sign-in surface remains visible
// regardless of the hint's value.
export function LastLoginMethodHint() {
  const [method, setMethod] = useState<string | null>(null);

  useEffect(() => {
    const value = authClient.getLastUsedLoginMethod();
    setMethod(value ?? null);
  }, []);

  const label = describeLastLoginMethod(method);
  if (!label) {
    return null;
  }

  return (
    <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      You last signed in with <span className="font-medium text-foreground">{label}</span>.
    </p>
  );
}
