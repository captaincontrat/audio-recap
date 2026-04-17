import { randomBytes } from "node:crypto";

// Slug helpers for workspace URL segments. Personal workspaces use an
// opaque slug with a `p-` prefix so they are distinguishable from team
// workspaces at a glance but still carry enough randomness to be unique
// across a real user base.
//
// Slug length is chosen so the unique-index violation probability stays
// negligible for realistic product scale: 8 url-safe characters ≈ 48 bits
// of entropy.

const PERSONAL_SLUG_PREFIX = "p-";
const PERSONAL_SLUG_ENTROPY_BYTES = 6;

// Normalize a generated slug segment to the URL-safe alphabet Better
// Auth-style identifiers use (`[a-zA-Z0-9_-]`). `base64url` is already
// url-safe but can be trimmed of trailing padding characters as a belt-
// and-suspenders step.
function urlSafeSegment(bytes: number): string {
  return randomBytes(bytes).toString("base64url").replace(/=+$/u, "");
}

export function generatePersonalWorkspaceSlug(): string {
  return `${PERSONAL_SLUG_PREFIX}${urlSafeSegment(PERSONAL_SLUG_ENTROPY_BYTES)}`;
}

// Exposed so the personal workspace provisioner can detect and filter out
// non-personal slugs when composing data queries in tests.
export function isPersonalWorkspaceSlug(slug: string): boolean {
  return slug.startsWith(PERSONAL_SLUG_PREFIX);
}

export const __internals = {
  PERSONAL_SLUG_PREFIX,
  PERSONAL_SLUG_ENTROPY_BYTES,
};
