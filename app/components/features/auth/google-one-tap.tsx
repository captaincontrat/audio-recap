"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth/client";

// Mounts the Google One Tap prompt on page load. The heavy lifting lives
// inside the Better Auth client plugin — we just kick it off once, then
// redirect on success. Prompting only runs when `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
// is set (the page-level gate decides whether to render this component).
export function GoogleOneTap({ callbackURL = "/dashboard" }: { callbackURL?: string }) {
  const router = useRouter();
  // Strict Mode remounts components in dev; this guard prevents firing the
  // prompt twice in a single page view, which Google's SDK rejects.
  const hasPrompted = useRef(false);

  useEffect(() => {
    if (hasPrompted.current) return;
    hasPrompted.current = true;

    // The One Tap client plugin is only registered when a Google client
    // id is present (see `lib/auth/client.ts`). Without it, `authClient`
    // has no `oneTap` action and this component is not rendered at all —
    // the render gate lives on the sign-in page.
    authClient
      .oneTap({ callbackURL })
      .then(() => {
        router.push(callbackURL);
        router.refresh();
      })
      .catch(() => {
        // Prompt dismissals and SDK load failures are expected — keep
        // silent so the other sign-in options remain usable.
      });
  }, [callbackURL, router]);

  return null;
}
