## Why

The repository currently provides only a local CLI pipeline, while the product brief calls for a web SaaS experience in `app/` with authenticated users, persistent transcript ownership, and asynchronous processing. The platform and authentication decisions need to be made first because every later web capability depends on user identity, durable ownership, background jobs, and a shared runtime model.

## What Changes

- Establish the baseline web platform topology for the future product: browser app in `app/`, authenticated API/BFF, background worker, Postgres for durable application data, and Redis for asynchronous job coordination.
- Define the platform rule that the web app reuses shared meeting-processing modules from `libs/audio-recap` instead of shelling out to the CLI, so the CLI and web worker can share one pipeline core.
- Add account authentication for individual users with email/password sign-up and sign-in, Google sign-in, session-based authentication, sign out, email verification, password reset, and account deletion.
- Define the system boundaries needed by future changes, including transcript ownership, worker-triggered processing, and privacy-oriented handling of transient source media.
- Make explicit that this change does not introduce billing, teams, admin backoffice tooling, API tokens, or permanent archival of uploaded source media.

## Capabilities

### New Capabilities
- `account-authentication`: Account creation, authentication, session lifecycle, Google sign-in, account recovery, account deletion, and the security rules needed for a single-user SaaS transcript library.

### Modified Capabilities
- None.

## Impact

- `app/` becomes the web product entrypoint and must evolve beyond the current Vite-only scaffold.
- New backend runtime surfaces are required for an authenticated API/BFF and a background worker connected through Redis-backed jobs.
- Postgres becomes the system of record for users, sessions, identity links, and future transcript ownership metadata.
- `libs/audio-recap` must be reusable as shared pipeline code instead of being treated only as a CLI wrapper.
- Email delivery and Google OAuth integration become required external dependencies for account lifecycle flows.
