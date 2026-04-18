import "server-only";

import { ensureSameOrigin, jsonResponse, unauthorized } from "@/lib/auth/api-response";
import { closeCurrentAccount } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/close — submit the account-closure confirmation.
// The action reads every prerequisite (recent-auth marker, fresh session
// when 2FA is enabled, last-eligible-admin invariant) from server state,
// so the request body is intentionally empty. The CSRF same-origin check
// plus the server-side session lookup are the only gates needed here.
export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const outcome = await closeCurrentAccount();
  if (outcome.ok) {
    return jsonResponse({ ok: true, scheduledDeleteAt: outcome.scheduledDeleteAt.toISOString() });
  }

  switch (outcome.reason) {
    case "no-session":
      return unauthorized();
    case "not-found":
      return jsonResponse({ ok: false, code: "account_not_found" }, { status: 404 });
    case "already_closed":
      return jsonResponse({ ok: false, code: "already_closed" }, { status: 409 });
    case "recent_auth_required":
      return jsonResponse({ ok: false, code: "recent_auth_required" }, { status: 403 });
    case "fresh_two_factor_required":
      return jsonResponse({ ok: false, code: "fresh_two_factor_required" }, { status: 403 });
    case "last_eligible_admin_handoff_required":
      return jsonResponse(
        { ok: false, code: "last_eligible_admin_handoff_required", blockingWorkspaceIds: outcome.blockingWorkspaceIds ?? [] },
        { status: 409 },
      );
    default: {
      const exhaustive: never = outcome.reason;
      throw new Error(`Unhandled closure refusal reason: ${String(exhaustive)}`);
    }
  }
}
