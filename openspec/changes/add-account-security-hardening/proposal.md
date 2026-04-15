## Why

The bootstrap and federated/passwordless auth changes establish how users sign in, but they intentionally leave out the extra protections and destructive account-lifecycle behavior that would make those foundation changes too large.

This change adds the security overlays that harden an established account system: opt-in two-factor authentication, backup codes, trusted devices, recent-auth protections, and permanent account deletion.

## What Changes

- Add optional two-factor authentication with TOTP, email OTP, backup codes, and trusted devices.
- Require recent authentication for sensitive security-management actions and permanent account deletion.
- Add permanent account deletion that revokes sessions, removes credentials and second-factor material, and enqueues cleanup of owned application data.
- Extend the auth email adapter to cover email OTP delivery for 2FA.

## Capabilities

### New Capabilities
- `account-security-hardening`: Two-factor authentication, backup-code recovery, trusted devices, recent-auth protections, and permanent account deletion for authenticated users.

### Modified Capabilities
- `core-account-authentication`: Gains recent-auth and destructive-action hardening rules.
- `federated-and-passwordless-auth`: Gains second-factor enforcement after successful primary sign-in flows.

## Impact

- Postgres must store two-factor enrollment state, recovery material, and trusted-device state.
- The Better Auth integration grows to include the `twoFactor` plugin and second-factor enforcement after primary sign-in.
- AWS SES-backed auth email delivery expands to include email OTP messages.
- Later transcript-focused changes must plug their owned-data cleanup into the deletion hook introduced here.
