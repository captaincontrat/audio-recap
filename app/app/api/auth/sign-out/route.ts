import { ensureSameOrigin, jsonResponse, serverError } from "@/lib/auth/api-response";
import { signOut } from "@/lib/auth/signout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const outcome = await signOut(request.headers);
  if (!outcome.ok) {
    return serverError(outcome.message, outcome.code);
  }
  return jsonResponse({ ok: true });
}
