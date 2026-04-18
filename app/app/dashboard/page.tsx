import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { evaluateProtectedRoute } from "@/lib/auth/guards";
import type { ExplicitDestination, LandingDecision } from "@/lib/server/workspaces/landing";
import { resolveDefaultLandingForUser } from "@/lib/server/workspaces/resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `/dashboard` is the canonical authenticated entry point owned by the
// `workspace-foundation` capability. After
// `add-workspace-overview-and-default-landing`, it is no longer a
// standalone product surface — it resolves the user's default
// workspace and redirects to that workspace's overview route.
//
// Spec rules enforced here:
//   - unauthenticated / unverified / closed users follow the existing
//     auth funnel (sign-in / verify-email / account-closed) before
//     they can reach the redirect resolver
//   - an explicit `returnTo` (or `from` alias) that names an
//     authorized in-app path wins over the default-landing resolution
//     so deep links survive a passthrough through `/dashboard`
//   - otherwise the user lands on the resolved default workspace's
//     overview route at `/w/<slug>` — never a generic non-workspace
//     placeholder
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requestHeaders = await headers();
  const outcome = await evaluateProtectedRoute(requestHeaders);
  if (outcome.status === "unauthenticated") {
    redirect(`${outcome.redirectTo}?from=/dashboard`);
  }
  if (outcome.status === "unverified") {
    redirect(outcome.redirectTo);
  }
  if (outcome.status === "closed") {
    redirect(outcome.redirectTo);
  }

  const rawSearchParams = await searchParams;
  const explicitDestination = readExplicitDestination(rawSearchParams);

  const decision = await resolveDefaultLandingForUser({
    userId: outcome.context.user.id,
    explicitDestination,
  });

  redirect(landingDecisionToPath(decision));
}

// Translate a `LandingDecision` into the URL the user should be sent
// to. `explicit` decisions carry a fully-qualified internal path; the
// other branches resolve to the workspace overview route owned by
// `add-workspace-overview-and-default-landing`.
function landingDecisionToPath(decision: LandingDecision): string {
  switch (decision.kind) {
    case "explicit":
      return decision.path;
    case "last":
    case "personal":
      return `/w/${encodeURIComponent(decision.slug)}`;
    default: {
      const exhaustive: never = decision;
      throw new Error(`Unhandled landing decision kind: ${String(exhaustive)}`);
    }
  }
}

// Accept either `?returnTo=` (canonical) or `?from=` (legacy alias used
// by the sign-in funnel) so explicit deep-link destinations survive a
// passthrough through `/dashboard`. Anything that isn't a same-origin
// app path is rejected so an open-redirect cannot ride along a stale
// bookmark.
function readExplicitDestination(searchParams: Record<string, string | string[] | undefined>): ExplicitDestination | null {
  const candidate = firstString(searchParams.returnTo) ?? firstString(searchParams.from);
  if (candidate === null) return null;
  if (!isSafeAppPath(candidate)) return null;
  // The dashboard never wants to bounce back to itself — that would
  // produce an infinite redirect loop and defeat the default-landing
  // resolver. Treat self-referencing destinations as "no explicit
  // destination" so the resolver picks the workspace overview.
  if (candidate === "/dashboard" || candidate.startsWith("/dashboard?") || candidate.startsWith("/dashboard#")) {
    return null;
  }
  return { path: candidate, isAuthorized: true };
}

function firstString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

// Same-origin path guard: must start with a single `/` (rejects
// `//evil.example.com`) and must not be a protocol-relative or
// absolute external URL. Mirrors the `isSafeRedirect` helper used by
// the auth client components so server-side and client-side checks
// agree on the same vocabulary.
function isSafeAppPath(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  return true;
}
