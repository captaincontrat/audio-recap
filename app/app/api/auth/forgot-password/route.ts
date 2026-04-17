import { ensureSameOrigin, jsonResponse, readJsonBody } from "@/lib/auth/api-response";
import { requestPasswordReset } from "@/lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{ email?: string }>(request);
  const outcome = await requestPasswordReset({
    email: typeof body?.email === "string" ? body.email : "",
  });

  // Always returns 200 with the same neutral body so the response does not
  // leak whether an account exists, matching the spec.
  return jsonResponse({ ok: outcome.ok, message: outcome.message });
}
