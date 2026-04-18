import "server-only";

import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody } from "@/lib/auth/api-response";
import { reverifyPasswordForRecentAuth } from "@/lib/auth/recent-auth-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{ password?: string }>(request);
  if (!body || typeof body.password !== "string" || body.password.length === 0) {
    return badRequest("Password is required.");
  }

  const outcome = await reverifyPasswordForRecentAuth(body.password);
  if (!outcome.ok) {
    const status = outcome.reason === "no-session" ? 401 : outcome.reason === "invalid-password" ? 401 : 400;
    return jsonResponse({ ok: false, reason: outcome.reason }, { status });
  }

  return jsonResponse({ ok: true });
}
