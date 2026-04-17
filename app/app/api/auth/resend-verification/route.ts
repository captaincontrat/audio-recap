import { ensureSameOrigin, jsonResponse, unauthorized } from "@/lib/auth/api-response";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { resendEmailVerification } from "@/lib/auth/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const session = await getSessionFromHeaders(request.headers);
  if (!session) {
    return unauthorized();
  }

  const outcome = await resendEmailVerification({ userId: session.user.id });
  if (!outcome.ok) {
    const status = outcome.code === "already_verified" ? 409 : 404;
    return jsonResponse({ ok: false, code: outcome.code, message: outcome.message }, { status });
  }

  return jsonResponse({ ok: true, expiresAt: outcome.expiresAt.toISOString() });
}
