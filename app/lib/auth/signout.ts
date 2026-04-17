import "server-only";

import { childLogger } from "../server/logger";
import { getAuth } from "./instance";

export type SignOutResult = { ok: true } | { ok: false; code: "sign_out_failed"; message: string };

// Revoke the active session. Better Auth reads the session cookie from the
// provided headers and deletes the corresponding row from the `session`
// table, matching the spec's "revoke the active session" requirement.
export async function signOut(headers: Headers): Promise<SignOutResult> {
  const log = childLogger({ component: "auth.sign-out" });
  try {
    await getAuth().api.signOut({ headers });
    return { ok: true };
  } catch (error) {
    log.error({ err: error }, "sign-out failed");
    return { ok: false, code: "sign_out_failed", message: "We couldn't sign you out. Please try again." };
  }
}
