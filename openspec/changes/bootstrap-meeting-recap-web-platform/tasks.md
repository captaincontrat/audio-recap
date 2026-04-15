## 1. Platform Skeleton

- [ ] 1.1 Extend the existing Next.js app to host the browser UI, protected route handlers, and shared server-side code while adding the separate `app/worker` entrypoint.
- [ ] 1.2 Wire shared configuration, Drizzle/Postgres connectivity, BullMQ/Redis connectivity, and the S3-compatible blob-storage contract using MinIO in local development and CI.
- [ ] 1.3 Add Better Auth plus the shared session, secure-cookie, and CSRF primitives that all authenticated web routes will use.

## 2. Shared Pipeline Reuse

- [ ] 2.1 Refactor `libs/audio-recap` so the meeting-processing pipeline can be imported as shared library code without invoking the CLI entrypoint.
- [ ] 2.2 Update the CLI to remain a thin wrapper around the shared pipeline modules and verify that `pnpm process:meeting` still works.
- [ ] 2.3 Define the worker-facing pipeline adapter boundaries for temporary media I/O, OpenAI calls, and future job progress reporting.

## 3. Account Persistence Model

- [ ] 3.1 Add the Drizzle schema and migrations for users, normalized emails, password credentials, Google identities, sessions, verification tokens, and password-reset tokens.
- [ ] 3.2 Implement the account repositories/services and Better Auth integration hooks that enforce one active account per normalized email and store only hashed secrets and token hashes.
- [ ] 3.3 Implement the account-deletion orchestration path that revokes sessions immediately and enqueues cleanup hooks for owned application data.

## 4. Authentication Flows

- [ ] 4.1 Implement email/password sign-up with Better Auth-backed flows, verification-pending sessions, and verification-email delivery.
- [ ] 4.2 Implement verification consumption, verification resend, password sign-in, protected-route enforcement, and sign-out.
- [ ] 4.3 Implement forgot-password and reset-password flows with neutral responses, single-use reset tokens, and revocation of other active sessions on reset.
- [ ] 4.4 Implement Google sign-in through Better Auth with first-time account creation, existing-account linking, and unverified-account activation by verified Google email.

## 5. Web UX And Validation

- [ ] 5.1 Build the Next.js auth routes, screens, and states for sign-up, sign-in, verification, password reset, sign-out, and account deletion confirmation.
- [ ] 5.2 Add recent-auth enforcement and destructive-action UX for permanent account deletion.
- [ ] 5.3 Add automated coverage with Vitest and Playwright for the account lifecycle, including signup, verification, sign-in/out, Google linking, password reset, protected-route gating, and account deletion.
