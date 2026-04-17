import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody } from "@/lib/auth/api-response";
import { consumeEmailVerification } from "@/lib/auth/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{ token?: string }>(request);
  if (!body || typeof body.token !== "string" || body.token.length === 0) {
    return badRequest("Verification token is required.");
  }

  const outcome = await consumeEmailVerification({ token: body.token });
  if (!outcome.ok) {
    return jsonResponse({ ok: false, code: outcome.code, message: outcome.message }, { status: 400 });
  }

  return jsonResponse({
    ok: true,
    userId: outcome.userId,
    email: outcome.email,
    alreadyVerified: outcome.alreadyVerified,
  });
}
