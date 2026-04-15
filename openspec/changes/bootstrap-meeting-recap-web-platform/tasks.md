## 1. Platform Skeleton

- [ ] 1.1 Extend the existing Next.js app to host the browser UI, protected route handlers, and shared server-side code while adding the separate `app/worker` entrypoint.
- [ ] 1.2 Wire shared configuration, Drizzle/Postgres connectivity, and BullMQ/`ioredis` connectivity for the web and worker runtimes.
- [ ] 1.3 Add Better Auth plus the shared session, secure-cookie, and CSRF primitives that all authenticated web routes will use.
- [ ] 1.4 Add the auth email delivery adapter with AWS SES as the production provider for verification and password-reset flows.
- [ ] 1.5 Add shared structured logging with `pino` across the Next.js web runtime and `app/worker`, including request/job context for auth and future queue-backed flows.

## 2. Account Persistence Model

- [ ] 2.1 Add the Drizzle schema and migrations for users, normalized emails, password credentials, sessions, verification tokens, and password-reset tokens.
- [ ] 2.2 Implement the account repositories/services and Better Auth integration hooks that enforce one active account per normalized email, Argon2id password hashing, and hashed secrets/token material.

## 3. Core Authentication Flows

- [ ] 3.1 Implement email/password sign-up with Better Auth-backed flows, verification-pending sessions, and verification-email delivery.
- [ ] 3.2 Implement verification consumption, verification resend, password sign-in, protected-route enforcement, and sign-out.
- [ ] 3.3 Implement forgot-password and reset-password flows with neutral responses, single-use reset tokens, and revocation of other active sessions on reset.

## 4. Web UX And Validation

- [ ] 4.1 Build the Next.js auth routes, screens, and states for sign-up, sign-in, verification, password reset, and sign-out.
- [ ] 4.2 Standardize browser-side auth forms on `react-hook-form` plus `zod` validation via `@hookform/resolvers` where immediate validation improves UX, while keeping server-side validation authoritative.
- [ ] 4.3 Add automated coverage with Vitest and Playwright for sign-up, verification, password reset, sign-in, sign-out, and protected-route gating.
