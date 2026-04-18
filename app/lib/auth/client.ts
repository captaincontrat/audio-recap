"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { lastLoginMethodClient, magicLinkClient, oneTapClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Next.js inlines `NEXT_PUBLIC_*` values at build time, so this constant is
// resolved once per build and can be safely read from client components.
// Leaving it unset hides Google One Tap without removing the rest of the
// federated stack.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Thin wrapper around Better Auth's React client. `baseURL` is omitted so the
// client uses same-origin fetches, which is what the Next.js server route at
// `/api/auth/*` will serve. Import this module only from client components or
// hooks; it should never run on the server.
//
// The plugin list mirrors the server registry in `instance.ts`; each client
// plugin contributes the matching `signIn.*` / `passkey.*` helpers that the
// UI calls. One Tap is only registered when a Google client id is provided
// so the prompt never fires with an empty id.
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), ...(GOOGLE_CLIENT_ID ? [oneTapClient({ clientId: GOOGLE_CLIENT_ID })] : []), passkeyClient(), lastLoginMethodClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
