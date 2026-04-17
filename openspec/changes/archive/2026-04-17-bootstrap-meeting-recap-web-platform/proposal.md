## Why

The original bootstrap change bundled platform runtime, core auth, advanced auth methods, localization, account-deletion semantics, and processing-coupled storage and pipeline concerns into one large scope. That made the foundation change too broad for high-quality implementation work.

This reduced bootstrap keeps only the smallest shared foundation that every later web capability still depends on: a web runtime plus worker boundary, durable auth persistence, core email/password account flows, and protected-route enforcement for a verified user.

## What Changes

- Establish the baseline web platform topology for the future product: a Next.js web app in `app/`, a dedicated worker process, Better Auth, Postgres for durable application data, Redis for asynchronous job coordination, and shared structured logging.
- Add core account authentication for individual users with email/password sign-up, email verification, password reset, sign-in, sign-out, session-based authentication, and one-account-per-email rules.
- Standardize the core auth implementation stack on Drizzle, AWS SES-backed verification/reset email delivery, React Hook Form, Zod, Vitest, and Playwright.
- Keep the current CLI viable while later changes add concrete transcript processing, advanced auth methods, localization, and account lifecycle hardening.
- Make explicit that this reduced bootstrap does not introduce Google sign-in, Google One Tap, magic links, passkeys, two-factor authentication, auth localization, account deletion, concrete transient blob-storage behavior, or shared pipeline refactoring.

## Capabilities

### New Capabilities
- `core-account-authentication`: Password-account creation, verification, password reset, sign-in/sign-out, session lifecycle, protected-route enforcement, and the core persistence/security rules needed for a verified single-user SaaS account.

### Modified Capabilities
- None.

## Impact

- `app/` becomes the authenticated web product entrypoint and establishes the long-lived web/worker runtime boundary that later changes will reuse.
- Postgres becomes the durable store for users, normalized emails, password credentials, sessions, and verification/reset tokens.
- Redis-backed queue infrastructure becomes part of the platform baseline even before transcript-processing logic is layered on top.
- AWS SES becomes a required dependency for verification and password-reset email flows.
- Follow-up changes can build on a verified authenticated user without having to carry the full advanced-auth or processing-storage scope in the same implementation context.
