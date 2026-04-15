## Split Result

The original `bootstrap-meeting-recap-web-platform` scope was split into:

- reduced bootstrap: `openspec/changes/bootstrap-meeting-recap-web-platform/`
- federated/passwordless auth: `openspec/changes/add-federated-and-passwordless-auth/`
- account security hardening: `openspec/changes/add-account-security-hardening/`
- auth localization: `openspec/changes/add-auth-localization-foundation/`
- processing-coupled storage/pipeline work: `openspec/changes/add-web-meeting-processing/`

Validation check after the split:

- `openspec validate --changes --json --no-interactive`
- result: 7/7 active changes valid

Functional-scope result:

- No original functional requirement was dropped.
- The only intentional artifact-level removal was the single monolithic `account-authentication` capability name, which was replaced by four smaller capabilities:
  - `core-account-authentication`
  - `federated-and-passwordless-auth`
  - `account-security-hardening`
  - `auth-localization`

## Proposal Scope Mapping

| Original bootstrap proposal item | Outcome | New home |
| --- | --- | --- |
| Baseline web platform topology: Next.js app, Better Auth, BullMQ worker, Postgres, Redis, S3-compatible transient blob storage | Split | Runtime/Better Auth/Postgres/Redis stay in reduced bootstrap; concrete S3-compatible transient storage moves to `add-web-meeting-processing` |
| Reuse shared meeting-processing modules from `libs/audio-recap` instead of shelling out to CLI | Moved | `openspec/changes/add-web-meeting-processing/` |
| Account authentication including password, magic link, Google, One Tap, passkeys, 2FA, localization, last-login-method, account deletion | Split | Password/verification/reset/protected-route rules stay in reduced bootstrap; Google/magic-link/passkeys/last-login-method move to `add-federated-and-passwordless-auth`; 2FA/account deletion move to `add-account-security-hardening`; localization moves to `add-auth-localization-foundation` |
| System boundaries for transcript ownership, worker-triggered processing, privacy-oriented transient media handling | Split | Worker/runtime boundary stays in reduced bootstrap; concrete transcript-processing and transient-media rules move to `add-web-meeting-processing` |
| Non-goals: billing, teams, admin, API tokens, permanent archival of uploaded source media | Preserved | Remain out of scope across the split set; permanent non-archival is restated in `add-web-meeting-processing` and its retention spec |

## Design Decision Mapping

| Original design decision | Outcome | New home |
| --- | --- | --- |
| Use a Next.js web runtime plus dedicated worker under `app/` | Stays | reduced bootstrap |
| Use a Heroku-first deployment profile | Stays, narrowed | reduced bootstrap; storage details deferred |
| Postgres is the source of truth; Redis is ephemeral infrastructure | Stays | reduced bootstrap |
| Use Drizzle for schema, migrations, and typed SQL access | Stays | reduced bootstrap |
| Use BullMQ for Redis-backed background work | Stays | reduced bootstrap |
| Use Pino for structured logs across web and worker | Stays | reduced bootstrap |
| Use S3-compatible transient blob storage across environments | Moved | `add-web-meeting-processing` |
| Reuse shared pipeline code from `libs/audio-recap`, not the CLI process | Moved | `add-web-meeting-processing` |
| Use Better Auth to reduce auth boilerplate while keeping product rules app-owned | Split | core password flows in reduced bootstrap; plugin-specific flows in the three auth follow-up changes |
| Select the Better Auth plugin set now rather than adding auth UX piecemeal later | Split | `add-federated-and-passwordless-auth`, `add-account-security-hardening`, `add-auth-localization-foundation` |
| Use AWS SES for outbound auth email delivery | Split | verification/reset in reduced bootstrap; magic-link delivery in `add-federated-and-passwordless-auth`; email OTP in `add-account-security-hardening` |
| Keep Argon2id for password accounts | Stays | reduced bootstrap |
| Use server-managed sessions with secure cookies | Stays | reduced bootstrap |
| Use one account per email with linkable credentials | Split | base one-email identity contract in reduced bootstrap; linked-credential behavior in `add-federated-and-passwordless-auth` |
| Verification, reset, and magic-link tokens are single-use, time-limited, and stored hashed | Split | verification/reset tokens in reduced bootstrap; magic-link tokens in `add-federated-and-passwordless-auth` |
| Account deletion is permanent and privacy-oriented | Moved | `add-account-security-hardening` |
| Standardize the app quality toolchain on Biome, Vitest, and Playwright | Stays as shared baseline | reduced bootstrap; reused by follow-up auth changes |
| Use React Hook Form plus Zod for browser forms and shared validation | Stays as shared baseline | reduced bootstrap; reused by follow-up auth changes |
| Future source media remains transient infrastructure, not durable product content | Moved | `add-web-meeting-processing` plus `transcript-data-retention` |

## Task Mapping

| Original task | Outcome | New home |
| --- | --- | --- |
| 1.1 Next.js app + `app/worker` entrypoint | Stays | reduced bootstrap 1.1 |
| 1.2 Shared config, Drizzle/Postgres, BullMQ/Redis, S3/MinIO blob-storage contract | Split | database/Redis/config in reduced bootstrap 1.2; S3/MinIO/blob-storage contract in `add-web-meeting-processing` 1.2 |
| 1.3 Better Auth plus session/cookie/CSRF primitives | Stays | reduced bootstrap 1.3 |
| 1.4 AWS SES adapter for verification, reset, magic-link, email-OTP | Split | verification/reset in reduced bootstrap 1.4; magic-link in `add-federated-and-passwordless-auth` 1.3 and 2.3; email OTP in `add-account-security-hardening` 1.2 and 2.3 |
| 1.5 Shared `pino` logging across web and worker | Stays | reduced bootstrap 1.5 |
| 2.1 Refactor `libs/audio-recap` into shared importable pipeline code | Moved | `add-web-meeting-processing` 2.1 |
| 2.2 Keep CLI as thin wrapper around shared pipeline modules | Moved | `add-web-meeting-processing` 2.1 and design migration plan |
| 2.3 Define worker-facing pipeline adapter boundaries | Moved | `add-web-meeting-processing` 1.2, 2.1, and 3.1 |
| 3.1 Drizzle schema for users, emails, password creds, Google identities, passkeys, sessions, verification/reset/magic-link tokens, 2FA state | Split | password/session/verification/reset tables in reduced bootstrap 2.1; Google/magic-link/passkeys in `add-federated-and-passwordless-auth` 1.1; 2FA state in `add-account-security-hardening` 1.1 |
| 3.2 Account repositories/services for one-email rule, Argon2id, hashed secrets/token material | Split | base password-account rules in reduced bootstrap 2.2; linked-credential rules in `add-federated-and-passwordless-auth` 1.2 and 2.2 |
| 3.3 Account-deletion orchestration path | Moved | `add-account-security-hardening` 1.3 and 3.2 |
| 4.1 Email/password sign-up with verification-pending sessions | Stays | reduced bootstrap 3.1 |
| 4.2 Verification, resend, password sign-in, protected-route enforcement, sign-out | Stays | reduced bootstrap 3.2 |
| 4.3 Forgot-password and reset-password flows | Stays | reduced bootstrap 3.3 |
| 4.4 Google sign-in and Google One Tap | Moved | `add-federated-and-passwordless-auth` 2.2 and 4.1 |
| 4.5 Magic-link request and verification | Moved | `add-federated-and-passwordless-auth` 1.3, 2.3, and 4.1 |
| 4.6 Passkey enrollment, management, and sign-in | Moved | `add-federated-and-passwordless-auth` 3.1, 3.2, and 4.1 |
| 4.7 Optional 2FA with TOTP, email OTP, backup codes, trusted devices, recent-auth protections | Moved | `add-account-security-hardening` 2.1 through 3.1 |
| 5.1 Next.js auth routes/screens/states for every auth surface | Split | core password flows in reduced bootstrap 4.1; Google/magic-link/passkey in `add-federated-and-passwordless-auth` 4.1; 2FA/account deletion in `add-account-security-hardening` 4.1 |
| 5.2 Full-app localization support | Moved | `add-auth-localization-foundation` 1.x through 3.x |
| 5.3 Standardize browser-side forms on React Hook Form + Zod | Stays as baseline | reduced bootstrap 4.2 |
| 5.4 Automated coverage for account lifecycle and localization foundation | Split | core password-flow tests in reduced bootstrap 4.3; federated/passwordless tests in `add-federated-and-passwordless-auth` 5.x; security tests in `add-account-security-hardening` 4.2; localization tests in `add-auth-localization-foundation` 3.x |

## Requirement Mapping

| Original requirement | Outcome | New home |
| --- | --- | --- |
| Visitor can create a password account | Stays | `bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md` |
| Email ownership is verified before password-account activation | Stays | `bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md` |
| Verified users can sign in and sign out with server-managed sessions | Stays | `bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md` |
| Google sign-in and Google One Tap link to one account per email | Moved | `add-federated-and-passwordless-auth/specs/federated-and-passwordless-auth/spec.md` |
| Users can sign in by magic link | Moved | `add-federated-and-passwordless-auth/specs/federated-and-passwordless-auth/spec.md` |
| Users can sign in with enrolled passkeys | Moved | `add-federated-and-passwordless-auth/specs/federated-and-passwordless-auth/spec.md` |
| Users can reset a forgotten password | Stays | `bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md` |
| Users can enable optional two-factor authentication | Moved | `add-account-security-hardening/specs/account-security-hardening/spec.md` |
| Protected application surfaces require an authenticated verified account | Stays | `bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md` |
| The web app supports localization across supported languages | Moved | `add-auth-localization-foundation/specs/auth-localization/spec.md` |
| Sign-in UX can hint the last successful login method | Moved | `add-federated-and-passwordless-auth/specs/federated-and-passwordless-auth/spec.md` |
| Users can permanently delete their account | Moved | `add-account-security-hardening/specs/account-security-hardening/spec.md` |

## Reconciliation Verdict

Every meaningful proposal item, design decision, task, and requirement from the preserved bootstrap snapshot maps to exactly one of these outcomes:

- stays in the reduced bootstrap
- moves to a named follow-up auth change
- moves to `add-web-meeting-processing`
- or is replaced only at the artifact-structure level by smaller capability names

No original product requirement was silently dropped in the split.
