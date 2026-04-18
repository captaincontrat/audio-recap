"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

// Rendered only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set; the page-level
// check keeps the button off the DOM for deployments that haven't wired up
// Google OAuth yet. `callbackURL` is passed through to Better Auth's OAuth
// state so the user lands back on the same destination they originally
// requested (or `/dashboard` as a safe default).
export function GoogleSignInButton({ callbackURL = "/dashboard" }: { callbackURL?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setIsPending(true);
    const result = await authClient.signIn.social({ provider: "google", callbackURL });
    if (result?.error) {
      setError(result.error.message ?? "We couldn't start Google sign-in.");
      setIsPending(false);
      return;
    }
    // On success Better Auth redirects the browser; if we're still here the
    // redirect is pending and the loading state stays until unmount.
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" variant="outline" onClick={onClick} disabled={isPending} aria-label="Sign in with Google">
        <GoogleGlyph aria-hidden="true" /> {isPending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Google logo" {...props}>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.163-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 013.68 9c0-.593.102-1.17.285-1.707V4.96H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
