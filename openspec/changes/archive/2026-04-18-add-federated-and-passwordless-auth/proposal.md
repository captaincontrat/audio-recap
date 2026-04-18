## Why

The reduced bootstrap now establishes only the core password-account foundation. The product still requires the rest of its planned sign-in surface: Google OAuth, Google One Tap, magic links, passkeys, and lightweight sign-in wayfinding for returning users.

Splitting those flows into their own change keeps the bootstrap small while preserving a coherent implementation scope for alternative primary sign-in methods and account-linking rules.

## What Changes

- Add Google sign-in and Google One Tap as first-party sign-in options.
- Add email-based magic-link sign-in that can create or verify accounts by proving email ownership.
- Add passkey enrollment, list/delete management, and passkey sign-in for existing accounts.
- Add last-login-method UX hints so the sign-in surface can remember a user's previous successful method without making that memory authoritative.
- Extend the account model to support linkable credentials while preserving the one-account-per-email rule defined by the bootstrap.

## Capabilities

### New Capabilities
- `federated-and-passwordless-auth`: Google OAuth, Google One Tap, magic-link sign-in, passkey management/sign-in, last-login-method hints, and the account-linking rules that attach those flows to one account per normalized email.

### Modified Capabilities
- `core-account-authentication`: Gains linked-credential behavior on top of the bootstrap's password-account foundation.

## Impact

- Postgres must store Google identity links, magic-link tokens, and enrolled passkeys.
- The Better Auth integration grows to include the `magic-link`, `one-tap`, `passkey`, and `last-login-method` plugins.
- AWS SES-backed auth email delivery expands to include magic-link messages.
- The sign-in UI in `app/` gains multiple primary entry paths and passkey-management surfaces without reopening the core identity model.
