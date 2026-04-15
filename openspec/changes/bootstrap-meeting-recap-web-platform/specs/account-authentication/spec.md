## ADDED Requirements

### Requirement: Visitor can create a password account
The system SHALL allow a visitor to create an account with a unique email address and a password that is at least 12 characters long. The system MUST normalize email addresses before uniqueness checks, MUST store only an Argon2id password hash, and MUST create the account in an unverified state until email ownership is confirmed. After successful sign-up, the system SHALL create a verification-pending session and send a verification email.

#### Scenario: Successful sign-up with a new email
- **WHEN** a visitor submits an unused email address and a valid password
- **THEN** the system creates an unverified account, stores only the password hash, creates a verification-pending session, and sends a verification email

#### Scenario: Sign-up uses an email that already belongs to an account
- **WHEN** a visitor submits an email address that is already associated with an existing account
- **THEN** the system refuses to create a second account and instructs the visitor to sign in or use password recovery

### Requirement: Email ownership is verified before password-account activation
The system SHALL require email verification before a password-based account can access protected meeting-processing or transcript-library features. Verification links MUST be single-use and time-limited. The system SHALL allow an authenticated unverified user to request another verification email.

#### Scenario: Verification link succeeds
- **WHEN** an authenticated unverified user follows a valid verification link
- **THEN** the system marks the account as verified and grants normal authenticated access

#### Scenario: Verification link is expired or already consumed
- **WHEN** a user follows an expired or previously used verification link
- **THEN** the system refuses to activate the account and offers a way to send a new verification email

#### Scenario: Unverified account attempts to access protected application features
- **WHEN** an authenticated but unverified password account requests a protected application route or API operation
- **THEN** the system redirects the user to the verification flow instead of granting full application access

### Requirement: Verified users can sign in and sign out with server-managed sessions
The system SHALL authenticate email/password accounts with server-managed sessions persisted in Postgres and represented in the browser by secure, HTTP-only cookies. The system MUST return the same generic authentication failure message for unknown email addresses and incorrect passwords. The system SHALL revoke the active session when the user signs out.

#### Scenario: Verified user signs in successfully
- **WHEN** a verified user submits the correct email address and password
- **THEN** the system creates a new authenticated session and grants access to protected application features

#### Scenario: Visitor submits invalid credentials
- **WHEN** a visitor submits an unknown email address or an incorrect password
- **THEN** the system denies access without revealing which field was incorrect

#### Scenario: Authenticated user signs out
- **WHEN** an authenticated user chooses to sign out
- **THEN** the system revokes the current session and returns the browser to an unauthenticated state

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

### Requirement: Users can reset a forgotten password
The system SHALL allow a visitor to request a password reset for password-based accounts. The system MUST return the same response whether or not the submitted email address belongs to an eligible account. Password-reset links MUST be single-use and time-limited. Completing a password reset MUST replace the stored password hash, invalidate outstanding reset tokens, and revoke all other active sessions.

#### Scenario: Password-reset request is submitted
- **WHEN** a visitor submits an email address on the forgot-password form
- **THEN** the system returns a neutral response and sends a reset email only if an eligible password-based account exists

#### Scenario: Password reset completes successfully
- **WHEN** a user follows a valid reset link and submits a new valid password
- **THEN** the system updates the password hash, invalidates prior reset tokens, revokes the user's other active sessions, and allows future sign-in with the new password

#### Scenario: Password-reset link is expired or already consumed
- **WHEN** a user follows an expired or previously used reset link
- **THEN** the system refuses to change the password and offers a way to start a new reset request

### Requirement: Users can enable optional two-factor authentication
The system SHALL allow an authenticated user to opt into two-factor authentication. The system SHALL support TOTP as a second factor, SHALL support email OTP as an alternate second factor, MUST generate backup codes for account recovery, and MAY remember trusted devices for a limited trust window. When a user with two-factor authentication enabled completes a primary sign-in flow, the system MUST require second-factor verification before granting full authenticated access unless the device is trusted.

#### Scenario: User enables TOTP-based 2FA
- **WHEN** an authenticated user enrolls in TOTP-based two-factor authentication and successfully verifies the initial TOTP code
- **THEN** the system marks two-factor authentication enabled and shows backup codes to the user

#### Scenario: User with 2FA enabled signs in and must verify a second factor
- **WHEN** a user with two-factor authentication enabled completes a primary sign-in flow on an untrusted device
- **THEN** the system pauses sign-in and requires TOTP or email-OTP verification before issuing full authenticated access

#### Scenario: User completes 2FA with a backup code
- **WHEN** a user submits a valid backup code during the second-factor step
- **THEN** the system completes sign-in and invalidates that backup code

#### Scenario: User trusts a device during 2FA verification
- **WHEN** a user successfully completes second-factor verification and chooses to trust the current device
- **THEN** the system remembers that device for the trust window and skips the second-factor prompt on later sign-ins during that window

### Requirement: Protected application surfaces require an authenticated verified account
The system SHALL require an active authenticated session for private application routes and API operations. The system SHALL distinguish between unauthenticated and unverified states: unauthenticated users MUST be sent to sign-in flows, while authenticated but unverified password accounts MUST be sent to email-verification flows. Public share URLs are outside the scope of this capability and MUST not rely on these authenticated-route rules.

#### Scenario: Unauthenticated browser requests a protected route
- **WHEN** a browser without an active session requests a protected application route
- **THEN** the system sends the user to the sign-in flow instead of rendering the protected route

#### Scenario: Authenticated but unverified password account calls a protected API
- **WHEN** an authenticated but unverified password account calls a protected API operation
- **THEN** the system denies the protected operation and directs the user to the verification flow

#### Scenario: Authenticated verified account requests a protected route
- **WHEN** an authenticated verified account requests a protected application route or API operation
- **THEN** the system allows the request to proceed

### Requirement: The web app supports localization across supported languages
The system SHALL support full-app localization for English, French, German, and Spanish. Authentication surfaces, shared application chrome, and Better Auth error messages MUST resolve from the same locale model. When the user's preferred locale is unsupported or unavailable, the system MUST fall back to English.

#### Scenario: Supported locale renders the app in that locale
- **WHEN** a user visits the web app with a supported preferred locale of French, German, or Spanish
- **THEN** the app renders localized UI content for that locale, including authentication surfaces and shared application chrome

#### Scenario: Auth errors use the same locale as the app
- **WHEN** an auth flow returns a Better Auth error while the app locale is French, German, or Spanish
- **THEN** the system returns the translated auth error message in that same locale

#### Scenario: Unsupported locale falls back to English
- **WHEN** a user visits the app with a preferred locale that is not one of the supported locales
- **THEN** the app falls back to English content and English Better Auth error messages

### Requirement: Sign-in UX can hint the last successful login method
The system SHALL remember the last successful login method on the client and MAY use that information to label or prioritize sign-in options in later visits. This UX memory MUST not be required for authentication to succeed.

#### Scenario: Last login method is shown as a hint
- **WHEN** a user returns to the sign-in page after previously authenticating with Google, magic link, passkey, or email/password
- **THEN** the sign-in UI may hint that last-used method to improve wayfinding without hiding other available options

#### Scenario: Missing last-method memory does not block sign-in
- **WHEN** the system cannot read any stored last-login-method hint
- **THEN** the sign-in UI still renders normally and all supported sign-in methods remain available

### Requirement: Users can permanently delete their account
The system SHALL allow an authenticated user to permanently delete their account after recent authentication and explicit confirmation. Account deletion MUST revoke all sessions, delete password and Google credentials, remove enrolled passkeys and two-factor secrets or recovery material, and enqueue deletion of owned application data defined by later capabilities.

#### Scenario: Recently authenticated user confirms account deletion
- **WHEN** a recently authenticated user explicitly confirms permanent account deletion
- **THEN** the system deletes the account credentials, revokes all sessions, enqueues owned-data deletion, and signs the user out

#### Scenario: User attempts account deletion without recent authentication
- **WHEN** an authenticated user tries to delete the account without a recent authentication check
- **THEN** the system requires re-authentication before allowing permanent deletion
