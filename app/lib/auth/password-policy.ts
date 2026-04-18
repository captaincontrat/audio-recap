// Shared password policy constants. Split out of `password.ts` so the
// client can import the minimum length for `react-hook-form` validation
// without dragging in `@node-rs/argon2`, whose browser fallback exports
// nothing and trips Turbopack when it appears in a client import graph.
//
// Follows the same pattern as `two-factor-config.ts`: a pure constants
// module that is the single source of truth for both server-side
// authoritative validation (see `schemas.ts`, `password.ts`) and
// client-side UX messaging.

// Minimum length we enforce for user-chosen passwords. Twelve characters
// is comfortably above the NIST SP 800-63B floor of 8 while staying in
// the range where typical passphrases ("correct horse battery staple")
// fit naturally. The Argon2id runtime in `password.ts` re-asserts this
// bound so short inputs are rejected before hashing.
export const MIN_PASSWORD_LENGTH = 12;
