# federated-and-passwordless-auth Specification

## Purpose

Defines sign-in methods that extend the `core-account-authentication` password-account foundation with federated and passwordless options: Google OAuth, Google One Tap, email-based magic-link sign-in, and passkey enrollment/sign-in. This capability owns the account-linking rules that attach these alternative credentials to an existing user while preserving the "one active account per normalized email" rule, and the last-login-method UX hint used to guide returning users toward their previously successful sign-in path without making that hint authoritative for authentication.

## Requirements

### Requirement: Google sign-in and Google One Tap link to one account per email
The system SHALL offer Google as a first-party sign-in method through both the standard Google OAuth flow and Google One Tap where the browser supports it. When Google returns a verified email address that is not yet associated with an account, the system MUST create a new verified account. When Google returns a verified email address that already belongs to an existing account, the system MUST sign into that account and record the Google identity link instead of creating a duplicate account.

#### Scenario: First-time Google sign-in creates a verified account
- **WHEN** a visitor completes Google sign-in with a verified email address that is not yet known to the system
- **THEN** the system creates a new verified account, links the Google identity, and creates an authenticated session

#### Scenario: Google sign-in matches an existing verified password account
- **WHEN** a visitor completes Google sign-in with a verified email address that already belongs to an existing verified password account
- **THEN** the system signs into that existing account and records the Google identity link without creating a duplicate account

#### Scenario: Google sign-in matches an existing unverified password account
- **WHEN** a visitor completes Google sign-in with a verified email address that already belongs to an existing unverified password account
- **THEN** the system links the Google identity, marks the existing account as verified, and signs into that account

#### Scenario: Google One Tap follows the same account-linking rules
- **WHEN** a visitor completes Google One Tap with a verified email address
- **THEN** the system applies the same create-or-link behavior as the standard Google sign-in flow

### Requirement: Users can sign in by magic link
The system SHALL offer email-based magic-link sign-in with single-use, time-limited links. Following a valid magic link SHALL count as proof of email ownership. When a magic link is used with a new email address, the system MUST create a new verified account. When a magic link is used with an existing account, the system MUST sign into that account and mark it verified if it was previously unverified.

#### Scenario: Magic-link request is submitted
- **WHEN** a visitor submits an email address for magic-link sign-in
- **THEN** the system returns a neutral response and sends a magic link to that address

#### Scenario: Magic-link sign-in creates a new verified account
- **WHEN** a visitor follows a valid magic link for an email address that is not yet associated with an account
- **THEN** the system creates a new verified account and an authenticated session

#### Scenario: Magic-link sign-in verifies an existing unverified account
- **WHEN** a visitor follows a valid magic link for an email address that already belongs to an existing unverified account
- **THEN** the system marks that account verified and signs into that existing account

#### Scenario: Magic-link is expired or already consumed
- **WHEN** a user follows an expired or previously used magic link
- **THEN** the system refuses to authenticate the user and offers a way to request another magic link

### Requirement: Users can sign in with enrolled passkeys
The system SHALL allow an authenticated user to enroll one or more passkeys on their account and SHALL allow a returning user to authenticate with an enrolled passkey. During this change, passkey enrollment MUST require an existing authenticated session rather than passkey-first onboarding. The system SHALL allow an authenticated user to list and remove their enrolled passkeys.

#### Scenario: Authenticated user enrolls a passkey
- **WHEN** an authenticated user adds a passkey to their account
- **THEN** the system stores the passkey on that account and allows future sign-in with it

#### Scenario: Returning user signs in with an enrolled passkey
- **WHEN** a returning user completes passkey authentication for a passkey already enrolled on their account
- **THEN** the system creates an authenticated session for that existing account

#### Scenario: Authenticated user removes a passkey
- **WHEN** an authenticated user deletes an enrolled passkey from their account
- **THEN** the system removes that passkey and no longer accepts it for future sign-in

### Requirement: Sign-in UX can hint the last successful login method
The system SHALL remember the last successful login method on the client and MAY use that information to label or prioritize sign-in options in later visits. This UX memory MUST not be required for authentication to succeed.

#### Scenario: Last login method is shown as a hint
- **WHEN** a user returns to the sign-in page after previously authenticating with Google, magic link, passkey, or email/password
- **THEN** the sign-in UI may hint that last-used method to improve wayfinding without hiding other available options

#### Scenario: Missing last-method memory does not block sign-in
- **WHEN** the system cannot read any stored last-login-method hint
- **THEN** the sign-in UI still renders normally and all supported sign-in methods remain available
