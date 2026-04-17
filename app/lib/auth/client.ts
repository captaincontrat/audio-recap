"use client";

import { createAuthClient } from "better-auth/react";

// Thin wrapper around Better Auth's React client. `baseURL` is omitted so the
// client uses same-origin fetches, which is what the Next.js server route at
// `/api/auth/*` will serve. Import this module only from client components or
// hooks; it should never run on the server.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
