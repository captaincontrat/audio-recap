import "server-only";

import { ensureSameOrigin, jsonResponse, unauthorized } from "@/lib/auth/api-response";
import { reactivateCurrentAccount } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/reactivate — submit the self-service reactivation
// request from the `/account/closed` page. All prerequisites are
// derived from server state; the body is intentionally empty.
export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const outcome = await reactivateCurrentAccount();
  if (outcome.ok) {
    return jsonResponse({ ok: true });
  }

  switch (outcome.reason) {
    case "no-session":
      return unauthorized();
    case "fresh-auth-required":
      return jsonResponse({ ok: false, code: "fresh_auth_required" }, { status: 403 });
    case "not-closed":
      return jsonResponse({ ok: false, code: "not_closed" }, { status: 409 });
    case "window-expired":
      return jsonResponse({ ok: false, code: "window_expired" }, { status: 410 });
    default: {
      const exhaustive: never = outcome.reason;
      throw new Error(`Unhandled reactivation refusal reason: ${String(exhaustive)}`);
    }
  }
}
