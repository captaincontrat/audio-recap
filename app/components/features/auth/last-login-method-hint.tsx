"use client";

import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { describeLastLoginMethodKey } from "@/lib/auth/last-login-method";
import { useTranslator } from "@/lib/i18n/provider";

// Reads the `better-auth.last_used_login_method` cookie (set by the
// last-login-method plugin on successful sign-in) and shows a friendly
// hint above the sign-in form so returning users can spot the path they
// used last. Purely advisory — the full sign-in surface remains visible
// regardless of the hint's value.
export function LastLoginMethodHint() {
  const translate = useTranslator();
  const [method, setMethod] = useState<string | null>(null);

  useEffect(() => {
    const value = authClient.getLastUsedLoginMethod();
    setMethod(value ?? null);
  }, []);

  const key = describeLastLoginMethodKey(method);
  if (!key) {
    return null;
  }

  return (
    <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {translate("auth.lastLoginMethod.hint.prefix")} <span className="font-medium text-foreground">{translate(key)}</span>
      {translate("auth.lastLoginMethod.hint.suffix")}
    </p>
  );
}
