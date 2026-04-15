## Why

The repository currently provides only a local CLI pipeline, while the product brief calls for a web SaaS experience in `app/` with authenticated users, persistent transcript ownership, and asynchronous processing. The platform and authentication decisions need to be made first because every later web capability depends on user identity, durable ownership, background jobs, and a shared runtime model.

## What Changes

- Establish the baseline web platform topology for the future product: a Next.js web app in `app/`, Better Auth-backed authentication, a BullMQ worker, Postgres for durable application data, Redis for asynchronous job coordination, and S3-compatible transient blob storage.
- Define the platform rule that the web app reuses shared meeting-processing modules from `libs/audio-recap` instead of shelling out to the CLI, so the CLI and web worker can share one pipeline core.
- Add account authentication for individual users with email/password, magic-link sign-in, passkey sign-in, Google sign-in plus Google One Tap, optional two-factor authentication, session-based authentication, sign out, email verification, password reset, full-app localization support, last-login-method UX hints, and account deletion.
- Define the system boundaries needed by future changes, including transcript ownership, worker-triggered processing, and privacy-oriented handling of transient source media.
- Make explicit that this change does not introduce billing, teams, admin backoffice tooling, API tokens, or permanent archival of uploaded source media.

## Capabilities

### New Capabilities
- `account-authentication`: Account creation, email/password and magic-link authentication, Google sign-in plus One Tap, passkeys, optional two-factor authentication, session lifecycle, app-localized UX, account recovery, account deletion, and the security rules needed for a single-user SaaS transcript library.

### Modified Capabilities
- None.

## Impact

- `app/` becomes the Next.js web product entrypoint and must evolve from a frontend foundation into the authenticated product runtime plus worker boundary.
- New backend runtime surfaces are required inside the Next.js app plus a background worker connected through BullMQ/Redis-backed jobs.
- Postgres becomes the system of record for users, sessions, identity links, and future transcript ownership metadata.
- `libs/audio-recap` must be reusable as shared pipeline code instead of being treated only as a CLI wrapper.
- AWS SES email delivery, Google OAuth/One Tap integration, passkey/WebAuthn support, and S3-compatible blob storage become required external dependencies for account lifecycle flows and future upload handling.
