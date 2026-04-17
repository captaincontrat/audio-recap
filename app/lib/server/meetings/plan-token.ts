import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/server/env";
import type { AcceptancePlan } from "./acceptance";

// HMAC-signed envelope for an acceptance plan. The browser receives the
// token from the `prepare` step, uploads to the presigned URLs, and
// then posts the token back to `finalize`. We HMAC-sign the payload so
// the finalize route can trust the submission shape without re-running
// workspace resolution or re-validating policy; the token also binds
// the token to the authenticated user and workspace.
//
// Tokens expire alongside the presigned PUT URLs so a dropped or stale
// flow cannot be replayed.

type PlanTokenPayload = {
  v: 1;
  iat: number;
  exp: number;
  userId: string;
  plan: AcceptancePlan;
};

const TOKEN_VERSION = 1;
const DOMAIN_SEPARATOR = "meeting-acceptance-plan.v1";

export function signAcceptancePlan(args: { plan: AcceptancePlan; userId: string; ttlSeconds: number; now?: Date }): string {
  const nowMs = (args.now ?? new Date()).getTime();
  const payload: PlanTokenPayload = {
    v: TOKEN_VERSION,
    iat: nowMs,
    exp: nowMs + args.ttlSeconds * 1_000,
    userId: args.userId,
    plan: args.plan,
  };

  const body = encodeBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = encodeBase64Url(hmac(body));
  return `${body}.${signature}`;
}

export type VerifiedAcceptancePlan = {
  plan: AcceptancePlan;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
};

export type AcceptancePlanVerificationError = "malformed" | "invalid_signature" | "expired" | "version_mismatch" | "user_mismatch";

export class AcceptancePlanTokenError extends Error {
  readonly code: AcceptancePlanVerificationError;

  constructor(code: AcceptancePlanVerificationError, message?: string) {
    super(message ?? `Acceptance plan token error: ${code}`);
    this.name = "AcceptancePlanTokenError";
    this.code = code;
  }
}

export function verifyAcceptancePlan(args: { token: string; userId: string; now?: Date }): VerifiedAcceptancePlan {
  const firstDot = args.token.indexOf(".");
  if (firstDot === -1 || args.token.indexOf(".", firstDot + 1) !== -1) {
    throw new AcceptancePlanTokenError("malformed");
  }

  const body = args.token.slice(0, firstDot);
  const signature = args.token.slice(firstDot + 1);
  const expected = encodeBase64Url(hmac(body));
  const providedBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    throw new AcceptancePlanTokenError("invalid_signature");
  }

  let decoded: PlanTokenPayload;
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PlanTokenPayload;
  } catch {
    throw new AcceptancePlanTokenError("malformed");
  }

  if (decoded.v !== TOKEN_VERSION) {
    throw new AcceptancePlanTokenError("version_mismatch");
  }

  const nowMs = (args.now ?? new Date()).getTime();
  if (typeof decoded.exp !== "number" || decoded.exp <= nowMs) {
    throw new AcceptancePlanTokenError("expired");
  }
  if (decoded.userId !== args.userId) {
    throw new AcceptancePlanTokenError("user_mismatch");
  }

  return {
    plan: decoded.plan,
    userId: decoded.userId,
    issuedAt: new Date(decoded.iat),
    expiresAt: new Date(decoded.exp),
  };
}

function hmac(data: string): Buffer {
  const env = getServerEnv();
  const h = createHmac("sha256", env.BETTER_AUTH_SECRET);
  h.update(DOMAIN_SEPARATOR);
  h.update("\n");
  h.update(data);
  return h.digest();
}

function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}
