## 1. Identity Model Extensions

- [x] 1.1 Add the Drizzle schema and migrations for Google identity links, magic-link tokens, and enrolled passkeys.
- [x] 1.2 Extend the account repositories/services so linked credentials attach to the existing user selected by the normalized-email rules established in the bootstrap.
- [x] 1.3 Extend the auth email adapter for magic-link delivery while preserving neutral request responses.

## 2. Better Auth Plugin Integration

- [x] 2.1 Configure Better Auth with the `magic-link`, `one-tap`, `passkey`, and `last-login-method` plugins on top of the core password-account foundation.
- [x] 2.2 Implement Google OAuth and Google One Tap callbacks that create or link accounts only when Google returns a verified email.
- [x] 2.3 Implement magic-link issuance and verification flows that create a verified account for a new email and verify/link an existing unverified account.

## 3. Passkey Flows

- [x] 3.1 Implement authenticated passkey enrollment, list, and delete flows for existing accounts.
- [x] 3.2 Implement returning-user passkey sign-in for previously enrolled passkeys without introducing passkey-first onboarding.

## 4. Sign-In UX

- [x] 4.1 Build the Next.js auth routes, screens, and states for Google sign-in, Google One Tap, magic link, and passkey sign-in.
- [x] 4.2 Add last-login-method hints that improve sign-in wayfinding without hiding or requiring any sign-in method.

## 5. Validation And Regression Coverage

- [x] 5.1 Add automated coverage for Google account creation/linking, including verified-account activation when Google matches an existing unverified password account.
- [x] 5.2 Add automated coverage for magic-link request and verification flows, including neutral responses and expired/consumed links.
- [x] 5.3 Add automated coverage for passkey enrollment, passkey sign-in, and passkey deletion.
- [x] 5.4 Add automated coverage for last-login-method hint behavior and the non-blocking fallback when no prior hint exists.
