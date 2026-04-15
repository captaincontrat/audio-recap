## 1. Security State And Persistence

- [ ] 1.1 Add the Drizzle schema and migrations for two-factor enrollment state, trusted devices, backup codes, and any supporting recent-auth timestamps or markers.
- [ ] 1.2 Extend the auth email adapter for email-OTP delivery used by the second-factor flow.
- [ ] 1.3 Add the account-deletion orchestration path that revokes sessions immediately and enqueues cleanup hooks for owned application data.

## 2. Two-Factor Enforcement

- [ ] 2.1 Configure Better Auth with the `twoFactor` plugin on top of the existing primary sign-in flows.
- [ ] 2.2 Implement TOTP enrollment, verification, recovery-code generation, and enable/disable flows.
- [ ] 2.3 Implement email-OTP as an alternate second factor and trusted-device behavior for future sign-ins.
- [ ] 2.4 Enforce second-factor completion after primary sign-in on untrusted devices before issuing full authenticated access.

## 3. Account Lifecycle Hardening

- [ ] 3.1 Implement recent-auth protections for managing two-factor settings and account deletion.
- [ ] 3.2 Implement permanent account deletion that removes password and provider credentials, enrolled passkeys, and two-factor recovery material before signing the user out.

## 4. Web UX And Regression Coverage

- [ ] 4.1 Build the Next.js routes, screens, and states for second-factor challenge, trusted-device selection, backup-code use, two-factor settings, and account deletion confirmation.
- [ ] 4.2 Add automated coverage for TOTP enrollment, second-factor sign-in on untrusted devices, backup-code recovery, trusted devices, recent-auth enforcement, and account deletion.
