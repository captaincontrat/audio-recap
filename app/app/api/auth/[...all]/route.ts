import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/instance";

// Catch-all handler for every Better Auth plugin endpoint that isn't already
// wrapped by one of the hand-written sibling routes (sign-up, sign-in,
// sign-out, verify-email, password reset, session). This is where the
// plugin-owned flows live — OAuth (`/api/auth/sign-in/oauth2`), Google
// callback (`/api/auth/callback/google`), One Tap
// (`/api/auth/one-tap/callback`), magic link (`/api/auth/sign-in/magic-link`
// and `/api/auth/magic-link/verify`), and passkey
// (`/api/auth/passkey/*`). Next.js routes the more specific files first, so
// explicit routes keep their bespoke behavior while everything else falls
// through to Better Auth's own handler.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(getAuth());
