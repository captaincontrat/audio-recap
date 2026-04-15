## 1. Platform Skeleton

- [ ] 1.1 Extend the existing Next.js app to host the browser UI, protected route handlers, and shared server-side code while adding the separate `app/worker` entrypoint.
- [ ] 1.2 Wire shared configuration, Drizzle/Postgres connectivity, BullMQ/`ioredis` connectivity, and the S3-compatible blob-storage contract using MinIO in local development and CI.
- [ ] 1.3 Add Better Auth plus the shared session, secure-cookie, and CSRF primitives that all authenticated web routes will use.
- [ ] 1.4 Add the auth email delivery adapter with AWS SES as the production provider for verification, reset, magic-link, and email-OTP flows.
- [ ] 1.5 Add shared structured logging with `pino` across the Next.js web runtime and `app/worker`, including request/job context for auth, upload, and processing flows.

## 2. Shared Pipeline Reuse

- [ ] 2.1 Refactor `libs/audio-recap` so the meeting-processing pipeline can be imported as shared library code without invoking the CLI entrypoint.
- [ ] 2.2 Update the CLI to remain a thin wrapper around the shared pipeline modules and verify that `pnpm process:meeting` still works.
- [ ] 2.3 Define the worker-facing pipeline adapter boundaries for temporary media I/O, OpenAI calls, and future job progress reporting.

## 3. Account Persistence Model

- [ ] 3.1 Add the Drizzle schema and migrations for users, normalized emails, password credentials, Google identities, passkeys, sessions, verification/reset/magic-link tokens, and two-factor state.
- [ ] 3.2 Implement the account repositories/services and Better Auth integration hooks that enforce one active account per normalized email, Argon2id password hashing, and hashed secrets/token material.
- [ ] 3.3 Implement the account-deletion orchestration path that revokes sessions immediately and enqueues cleanup hooks for owned application data.

## 4. Authentication Flows

- [ ] 4.1 Implement email/password sign-up with Better Auth-backed flows, verification-pending sessions, and verification-email delivery.
- [ ] 4.2 Implement verification consumption, verification resend, password sign-in, protected-route enforcement, and sign-out.
- [ ] 4.3 Implement forgot-password and reset-password flows with neutral responses, single-use reset tokens, and revocation of other active sessions on reset.
- [ ] 4.4 Implement Google sign-in and Google One Tap through Better Auth with first-time account creation, existing-account linking, and unverified-account activation by verified Google email.
- [ ] 4.5 Implement magic-link request and verification flows with SES-backed delivery, verified-account creation/linking by email, and neutral request responses.
- [ ] 4.6 Implement passkey enrollment, list/delete management, and passkey sign-in without passkey-first onboarding.
- [ ] 4.7 Implement opt-in two-factor authentication with TOTP enrollment, email OTP, backup codes, trusted devices, and recent-auth protections for managing 2FA settings.

## 5. Web UX And Validation

- [ ] 5.1 Build the Next.js auth routes, screens, and states for sign-up, sign-in, magic link, Google, One Tap, passkey, 2FA, verification, password reset, sign-out, and account deletion confirmation.
- [ ] 5.2 Add full-app localization support for `en`, `fr`, `de`, and `es`, including locale selection/detection, shared translation loading, Better Auth i18n integration, last-login-method UX hints, and recent-auth/destructive-action UX for permanent account deletion and sensitive auth-management changes.
- [ ] 5.3 Standardize browser-side auth and upload forms on `react-hook-form` plus `zod` validation via `@hookform/resolvers` where immediate validation improves UX, while keeping server-side validation authoritative.
- [ ] 5.4 Add automated coverage with Vitest and Playwright for the account lifecycle and app-localization foundation, including verification, magic link, Google/One Tap, passkey, 2FA, password reset, protected-route gating, locale fallbacks, and account deletion.
